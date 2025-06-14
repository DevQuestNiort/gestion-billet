provider "google" {
  project = var.gcp_project_name
  region  = var.gcp_region
}

resource "google_project_service" "services" {
  for_each = toset([
    "datastore.googleapis.com",
    "certificatemanager.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "domains.googleapis.com",
    "run.googleapis.com",
    "storage.googleapis.com",
    "storage-component.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "iam.googleapis.com"
  ])

  service = each.value
}

# Service Account creation and configuration
resource "google_service_account" "accounts" {
  for_each = {
    function_account  = "cloudrun-function-sa"
    scheduler_account = "scheduler-sa"
  }
  account_id   = each.value
  display_name = "${title(replace(each.key, "_", " "))} Service Account"
}

resource "google_project_iam_member" "cloudrun_datastore_roles" {
  for_each = toset([
    "roles/datastore.user",
    "roles/datastore.owner",
    "roles/secretmanager.secretAccessor"
  ])
  project = var.gcp_project_name
  role    = each.key
  member  = "serviceAccount:${google_service_account.accounts["function_account"].email}"
}

resource "google_cloud_run_service_iam_member" "scheduler_cloud_run_invoker" {
  project  = var.gcp_project_name
  location = var.gcp_region
  service  = google_cloudfunctions2_function.sync_billet_web_function.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.accounts["scheduler_account"].email}"
}

# Upload functions code
resource "google_storage_bucket" "function_bucket" {
  name = "gestion-billet-function-bucket"
  location = var.gcp_region
  uniform_bucket_level_access = true
  force_destroy = true
}

variable "functions" {
  default = {
    split_ticket = "split-ticket"
  }
}

data "archive_file" "functions" {
  for_each    = var.functions
  type        = "zip"
  output_path = "/tmp/${each.value}.zip"
  source_dir  = "../functions/${each.value}/"
}

resource "google_storage_bucket_object" "functions" {
  for_each = var.functions
  name     = "${each.value}.zip"
  bucket   = google_storage_bucket.function_bucket.name
  source   = data.archive_file.functions[each.key].output_path
}

resource "google_cloudfunctions2_function" "split_ticket_function" {
  name        = "split_ticket-function"
  project     = var.gcp_project_name
  location    = var.gcp_region
  description = "Function used to split BilletWeb ticket"

  build_config {
    runtime     = "nodejs22"
    entry_point = "splitTicket" # Set the entry point
    source {
      storage_source {
        bucket = google_storage_bucket.function_bucket.name
        object = google_storage_bucket_object.functions["split_ticket"].name
      }
    }
  }
  service_config {
    max_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    service_account_email = google_service_account.accounts["function_account"].email
    environment_variables = {
      GCP_PROJECT_ID = var.gcp_project_id
    }
  }
}

# Schedule trigger for billet sync
resource "google_cloudfunctions2_function_iam_member" "scheduler_invoker" {
  project        = var.gcp_project_name
  location       = var.gcp_region
  cloud_function = google_cloudfunctions2_function.sync_billet_web_function.name
  role           = "roles/cloudfunctions.invoker"
  member         = "serviceAccount:${google_service_account.accounts["scheduler_account"].email}"
}

resource "google_cloud_scheduler_job" "sync_billet_web_scheduler" {
  name        = "sync-billet-web-scheduler"
  description = "Schedule the HTTPS trigger for billet sync sur l'app"
  schedule    = "0 * * * *"
  project     = var.gcp_project_name
  region      = var.gcp_region

  http_target {
    uri         = "${var.app_url}/sync-billet-web"
    http_method = "POST"
    oidc_token {
      audience              = var.app_url
      service_account_email = google_service_account.accounts["scheduler_account"].email
    }
  }
}

# Application

resource "google_cloud_run_service" "app" {
  name        = "billetterie-app"
  project     = var.gcp_project_name
  location    = var.gcp_region
  template {
    spec {
      containers {
        image = var.app_image_url
        ports {
          container_port = 8080
        }
        env {
          name  = "GCP_REGION"
          value = var.gcp_region
        }
      }
      service_account_name = google_service_account.accounts["function_account"].email
    }
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = "1"
      }
    }
  }
  metadata {
    annotations = {
      "run.googleapis.com/ingress" = "all"
    }
  }
  traffic {
    percent         = 100
    latest_revision = true
  }
}

# Autoriser l'accès non authentifié
resource "google_cloud_run_service_iam_member" "noauth" {
  service  = google_cloud_run_service.app.name
  location = google_cloud_run_service.app.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_domain_mapping" "app_domain" {
  name     = replace(var.app_url, "https://", "")
  location = var.gcp_region
  metadata {
    namespace = var.gcp_project_id
  }
  spec {
    route_name = google_cloud_run_service.app.name
  }
}

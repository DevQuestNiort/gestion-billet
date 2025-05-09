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
    sync_billet_web     = "sync-billet-web"
    get_commande_detail = "get-commande-detail"
    get_commande_by_email = "get-commande-by-email"
    update_billet_detail = "update-billet-detail"
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

resource "google_cloudfunctions2_function" "sync_billet_web_function" {
  name        = "sync-billet-web-function"
  project     = var.gcp_project_name
  location    = var.gcp_region
  description = "Function used to synchronise BilletWeb to DataStore"

  build_config {
    runtime     = "nodejs22"
    entry_point = "syncBilletWeb" # Set the entry point
    source {
      storage_source {
        bucket = google_storage_bucket.function_bucket.name
        object = google_storage_bucket_object.functions["sync_billet_web"].name
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
      GCP_PROJECT_NAME = var.gcp_project_name
      GCP_REGION = var.gcp_region
    }
  }
}

resource "google_cloudfunctions2_function" "get_commande_detail_function" {
  name        = "get_commande_detail-function"
  project     = var.gcp_project_name
  location    = var.gcp_region
  description = "Function used to synchronise BilletWeb to DataStore"

  build_config {
    runtime     = "nodejs22"
    entry_point = "getCommandDetails" # Set the entry point
    source {
      storage_source {
        bucket = google_storage_bucket.function_bucket.name
        object = google_storage_bucket_object.functions["get_commande_detail"].name
      }
    }
  }
  service_config {
    max_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    service_account_email = google_service_account.accounts["function_account"].email
  }
}

resource "google_cloudfunctions2_function" "update_billet_detail_function" {
  name        = "update_billet_detail-function"
  project     = var.gcp_project_name
  location    = var.gcp_region
  description = "Function used to synchronise BilletWeb to DataStore"

  build_config {
    runtime     = "nodejs22"
    entry_point = "updateBilletDetail" # Set the entry point
    source {
      storage_source {
        bucket = google_storage_bucket.function_bucket.name
        object = google_storage_bucket_object.functions["update_billet_detail"].name
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


resource "google_cloudfunctions2_function" "get_commande_by_email" {
  name        = "get_commande_by_email-function"
  project     = var.gcp_project_name
  location    = var.gcp_region
  description = "Function used to synchronise BilletWeb to DataStore"

  build_config {
    runtime     = "nodejs22"
    entry_point = "getCommandByEmail" # Set the entry point
    source {
      storage_source {
        bucket = google_storage_bucket.function_bucket.name
        object = google_storage_bucket_object.functions["get_commande_by_email"].name
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
  description = "Schedule the HTTPS trigger for cloud function"
  schedule    = "0 * * * *"
  project     = var.gcp_project_name
  region      = var.gcp_region

  http_target {
    uri         = google_cloudfunctions2_function.sync_billet_web_function.service_config[0].uri
    http_method = "POST"
    oidc_token {
      audience              = "${google_cloudfunctions2_function.sync_billet_web_function.service_config[0].uri}/"
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
  name     = "billetterie.devquest.fr"
  location = var.gcp_region
  metadata {
    namespace = var.gcp_project_id
  }
  spec {
    route_name = google_cloud_run_service.app.name
  }

}

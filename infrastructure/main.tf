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

#resource "google_cloud_run_domain_mapping" "app_domain" {
#  name     = replace(var.app_url, "https://", "")
#  location = var.gcp_region
#  metadata {
#    namespace = var.gcp_project_id
#  }
#  spec {
#    route_name = google_cloud_run_service.app.name
#  }
#}

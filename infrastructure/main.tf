provider "google" {
  project = var.gcp_project_name
  region  = var.gcp_region
}

resource "google_service_account" "function_account" {
  account_id   = "cloudrun-function-sa"
  display_name = "CloudRun Function Service account"
}

resource "google_service_account" "scheduler_account" {
  account_id   = "scheduler-sa"
  display_name = "Scheduler Service Account"
}

resource "google_project_service" "datastore" {
  project = var.gcp_project_name
  service = "datastore.googleapis.com"
}

resource "google_storage_bucket" "function_bucket" {
  name = "gestion-billet-function-bucket" # Every bucket name must be globally unique
  location = var.gcp_region
  uniform_bucket_level_access = true
}

data "archive_file" "sync_billet_web" {
  type        = "zip"
  output_path = "/tmp/sync-billet-web.zip"
  source_dir  = "../functions/sync-billet-web/"
}
resource "google_storage_bucket_object" "sync_billet_web_obj" {
  name   = "sync-billet-web.zip"
  bucket = google_storage_bucket.function_bucket.name
  source = data.archive_file.sync_billet_web.output_path
}

resource "google_project_iam_member" "cloudrun_datastore_roles" {
  for_each = toset([
    "roles/datastore.user",
    "roles/datastore.owner",
    "roles/secretmanager.secretAccessor"
  ])

  project = var.gcp_project_name
  role    = each.key
  member  = "serviceAccount:${google_service_account.function_account.email}"
}

resource "google_cloudfunctions2_function" "sync_billet_web_function" {
  name        = "sync-billet-web-function"
  location    = var.gcp_region
  description = "Function used to synchronise BilletWeb to DataStore"

  build_config {
    runtime     = "nodejs22"
    entry_point = "syncBilletWeb" # Set the entry point
    source {
      storage_source {
        bucket = google_storage_bucket.function_bucket.name
        object = google_storage_bucket_object.sync_billet_web_obj.name
      }
    }
  }
  service_config {
    max_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    service_account_email = google_service_account.function_account.email
    environment_variables = {
      GCP_PROJECT_ID = var.gcp_project_id
    }
  }
}

resource "google_cloudfunctions2_function_iam_member" "scheduler_invoker" {
  project        = var.gcp_project_name
  location       = var.gcp_region
  cloud_function = google_cloudfunctions2_function.sync_billet_web_function.name
  role           = "roles/cloudfunctions.invoker"
  member         = "serviceAccount:${google_service_account.scheduler_account.email}"
}

resource "google_cloud_run_service_iam_member" "scheduler_cloud_run_invoker" {
  project  = var.gcp_project_name
  location = var.gcp_region
  service  = google_cloudfunctions2_function.sync_billet_web_function.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler_account.email}"
}

resource "google_cloud_scheduler_job" "sync_billet_web_scheduler" {
  name        = "sync-billet-web-scheduler"
  description = "Schedule the HTTPS trigger for cloud function"
  schedule    = "0 * * * *"
  project     = var.gcp_project_name
  region      = "europe-west1"

  http_target {
    uri         = google_cloudfunctions2_function.sync_billet_web_function.service_config[0].uri
    http_method = "POST"
    oidc_token {
      audience              = "${google_cloudfunctions2_function.sync_billet_web_function.service_config[0].uri}/"
      service_account_email = google_service_account.scheduler_account.email
    }
  }
}
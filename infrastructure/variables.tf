variable "gcp_region" {
  type        = string
  description = "GCP region"
  default     = "europe-west9"
}

variable "gcp_project_name" {
  type        = string
  description = "GCP project name"
}

variable "gcp_project_id" {
  type        = string
  description = "GCP project ID"
}

variable "app_image_url" {
  type = string
  description = "App image url"
}

variable "app_url" {
  type        = string
  description = "URL publique de l'application Cloud Run (ex: https://mon-app-xxxx.a.run.app)"
}
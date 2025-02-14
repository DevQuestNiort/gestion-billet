terraform {
  backend "gcs" {
    bucket = "devquest-gestion-billet-tfstate"
  }
}
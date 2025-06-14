import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretmanagerClient = new SecretManagerServiceClient();

export async function getSecret(secretName: string): Promise<string> {
  const [version] = await secretmanagerClient.accessSecretVersion({ name: secretName });
  if (!version.payload?.data) throw new Error(`Secret ${secretName} manquant ou vide`);
  return Buffer.from(version.payload.data).toString('utf-8');
}

// Helpers pour les secrets connus
export const MAILJET_API_KEY_SECRET_NAME = `projects/${process.env.GCP_PROJECT_ID}/secrets/mailjet-api-key/versions/latest`;
export const MAILJET_API_SECRET_SECRET_NAME = `projects/${process.env.GCP_PROJECT_ID}/secrets/mailjet-api-secret/versions/latest`;
export const BILLET_WEB_SECRET_NAME = `projects/${process.env.GCP_PROJECT_ID}/secrets/billetweb-basic-token/versions/latest`;

export async function getMailjetApiKey(): Promise<string> {
  return getSecret(MAILJET_API_KEY_SECRET_NAME);
}

export async function getMailjetApiSecret(): Promise<string> {
  return getSecret(MAILJET_API_SECRET_SECRET_NAME);
}

export async function getBilletWebToken(): Promise<string> {
  return getSecret(BILLET_WEB_SECRET_NAME);
} 
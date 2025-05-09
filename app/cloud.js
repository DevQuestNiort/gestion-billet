
import { GoogleAuth } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();
const GCP_PROJECT_NAME = process.env.GOOGLE_CLOUD_PROJECT
const GCP_REGION = process.env.GCP_REGION

const FUNCTION_BASE_URL = `https://${GCP_REGION}-${GCP_PROJECT_NAME}.cloudfunctions.net`

export async function callCloudFunction(functionName, payload) {
    const auth = new GoogleAuth();
    const functionUrl = `${FUNCTION_BASE_URL}/${functionName}`;

    const client = await auth.getIdTokenClient(functionUrl);

    console.log('Payload envoyé:', JSON.stringify(payload));

    const response = await client.request({
      url: functionUrl,
      method: 'POST',
      data: payload,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.data;
}
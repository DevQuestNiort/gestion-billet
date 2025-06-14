import fetch from 'node-fetch';
import { getBilletWebToken } from './secrets.js';
import { BilletWebAttendee } from '../models.js';

const BILLET_WEB_BASE_URL = 'https://www.billetweb.fr/api/event/1220831';

export async function updateBilletWeb(ticket: any, lastname: string, firstname: string, email: string) {
  const billetWebToken = await getBilletWebToken();
  const updateResponse = await fetch(`${BILLET_WEB_BASE_URL}/update_product`, {
    method: "POST",
    body: JSON.stringify({
      data: [
        {
          id: ticket.id,
          name: lastname.toUpperCase(),
          firstname: firstname
        }
      ]
    }),
    headers: {
      "Authorization": `Basic ${billetWebToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!updateResponse.ok) {
    throw new Error('Impossible de mettre à jour le billet sur BilletWeb');
  }
}

export async function fetchBilletWebAttendees(full: boolean): Promise<BilletWebAttendee[]> {
  const billetWebToken = await getBilletWebToken();
  let url = `${BILLET_WEB_BASE_URL}/attendees?since=120`;
  if (full) {
    url = `${BILLET_WEB_BASE_URL}/attendees`;
  }
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${billetWebToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!response.ok) {
    throw new Error('Impossible de récupérer les participants BilletWeb');
  }
  return response.json() as Promise<BilletWebAttendee[]>;
} 
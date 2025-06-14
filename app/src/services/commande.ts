import { Request, Response } from 'express';
import {Datastore, Key} from '@google-cloud/datastore';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import mailjet from 'node-mailjet';
import fetch from 'node-fetch';
import path from 'path';
import ejs from 'ejs';
import { CommandeEntity, Ticket } from '../models.js';
import { updateBilletWeb } from './billetweb.js';
import { sendBilletEmail, sendCommandeLinkEmail } from './mail.js';

const datastore = new Datastore();
const secretmanagerClient = new SecretManagerServiceClient();
const KIND = "Commande";

const MAILJET_API_KEY_SECRET_NAME = `projects/${process.env.GCP_PROJECT_ID}/secrets/mailjet-api-key/versions/latest`;
const MAILJET_API_SECRET_SECRET_NAME = `projects/${process.env.GCP_PROJECT_ID}/secrets/mailjet-api-secret/versions/latest`;
const BILLET_WEB_SECRET_NAME = `projects/${process.env.GCP_PROJECT_ID}/secrets/billetweb-basic-token/versions/latest`;

const billetsTypeMapping: Record<string, string> = {
  '6119379': 'Billet 2 Jours',
  '6119377': 'Billet Jeudi',
  '6289969': 'Billet Jeudi',
  '6119378': 'Billet Vendredi',
  '6289970': 'Billet Vendredi',
  '6267785': 'Billet Speaker',
};

function decodeKey(commandId: string, datastore: Datastore): Key {
  try {
    return datastore.keyFromLegacyUrlsafe(commandId);
  } catch (error) {
    return datastore.keyFromLegacyUrlsafe(commandId);
  }
}

export async function getCommande(req: Request, res: Response) {
  const commandId = req.params.commandId;
  try {
    const key = decodeKey(commandId, datastore);
    const [commandEntity] = await datastore.get(key) as [CommandeEntity];
    if (!commandEntity) {
      throw new Error('Commande introuvable');
    }
    const billets = commandEntity.tickets
      .map(billet => ({
        ...billet,
        type: billetsTypeMapping[billet.type] || billet.type
      }))
      .sort((a, b) => a.type.localeCompare(b.type));
    ejs.renderFile(
      path.join(process.cwd(), 'app', 'views', 'commande.ejs'),
      {tickets: billets, commandId, encodeURIComponent},
      (err, str) => {
        if (err) return res.status(500).send('Erreur de rendu');
        res.render('layout', { title: '', body: str });
      }
    );
  } catch(e) {
    res.send('<p>Une erreur est survenu lors de la récupération de votre commande.</p>');
  }
}

export async function postTicket(req: Request, res: Response) {
  const {commandId, ticketId} = req.params;
  const {firstname, lastname, email, type} = req.body;
  try {
    const key = decodeKey(commandId, datastore);
    const [commandEntity] = await datastore.get(key) as [CommandeEntity];
    if (!commandEntity) {
      throw new Error('Commande introuvable');
    }
    const ticketIndex = commandEntity.tickets.findIndex(ticket => ticket.ticket_id === ticketId);
    if (ticketIndex === -1) {
      throw new Error('Ticket introuvable');
    }
    const ticket = commandEntity.tickets[ticketIndex];
    if (ticket.generated) {
      throw new Error('Le billet a déjà été généré');
    }
    commandEntity.tickets[ticketIndex] = {
      ...ticket,
      lastname,
      firstname,
      email,
      generated: true,
    };
    commandEntity.ticket_ids = commandEntity.tickets.map(t => t.ticket_id);
    const [billet_web_token] = await secretmanagerClient.accessSecretVersion({name: BILLET_WEB_SECRET_NAME});
    if (!billet_web_token.payload?.data) throw new Error('Token BilletWeb manquant');
    // Mise à jour du billet sur BilletWeb
    await updateBilletWeb(ticket, lastname, firstname, email);
    const attachementResponse = await fetch(ticket.ticket_url);
    const pdfBuffer = await attachementResponse.buffer();
    await sendBilletEmail(commandEntity, key, datastore, pdfBuffer);
    await datastore.save({
      key: key,
      data: commandEntity,
    });
    return res.send(`
      <tr>
        <td>${ticketId}</td>
        <td>${type}</td>
        <td><input type="text" name="lastname" value="${lastname}" required disabled/></td>
        <td><input type="text" name="firstname" value="${firstname}" required disabled/></td>
        <td><input type="email" name="email" value="${email}" required disabled/></td>
        <td>
            <div>Votre place vous a été envoyé par mail</div>
        </td>
      </tr>
    `);
  } catch(err) {
    res.send(`
      <tr>
        <td>${ticketId}</td>
        <td>${type}</td>
        <td><input type="text" name="lastname" value="${lastname}" required /></td>
        <td><input type="text" name="firstname" value="${firstname}" required /></td>
        <td><input type="email" name="email" value="${email}" required /></td>
        <td>
            <div>Une erreur est survenu lors de la mise à jour de votre billet.</div>
        </td>
      </tr>
      `);
  }
}

export async function postGetCommandeByEmail(req: Request, res: Response) {
  const email = req.body.email || 'inconnu';
  try {
    const query = datastore
      .createQuery(KIND)
      .filter("acheteur_email", '=', email)
      .limit(1);
    const [resultatsRaw] = await datastore.runQuery(query);
    const resultats = resultatsRaw as CommandeEntity[];
    if (!resultats || resultats.length == 0) {
      return res.send(`<p class="error">Aucun commande n'a été trouvé avec l'adresse: ${email}.</p>`);
    }
    const entity = resultats[0];
    const key = (entity as any)[datastore.KEY];
    if (!entity.notified || req.body.force) {
      await sendCommandeLinkEmail(entity, key, datastore, email);
    }
    res.send(`<p>Un email avec le lien de connexion vous a été envoyé à l'adresse: ${email}.</p>`);
  } catch(error) {
    res.send(`<p>Une erreur s'est produite lors de la récupération de votre commande. Vous pouvez nous contacter par mail: bureau@devquest.fr</p>`);
  }
}

/**
 * Fonction utilitaire pour récupérer une commande par email (hors Express)
 */
export async function getCommandeByEmail(email: string): Promise<CommandeEntity | null> {
  const query = datastore
    .createQuery(KIND)
    .filter("acheteur_email", '=', email)
    .limit(1);
  const [resultatsRaw] = await datastore.runQuery(query);
  const resultats = resultatsRaw as CommandeEntity[];
  if (!resultats || resultats.length == 0) {
    return null;
  }
  return resultats[0];
} 
import { Request, Response } from 'express';
import {Datastore, Key} from '@google-cloud/datastore';
import { fetchBilletWebAttendees } from './billetweb.js';
import { sendBilletEmail } from './mail.js';
import { groupCommandByAcheteur } from '../utils/groupCommandByAcheteur.js';
import { CommandeEntity } from '../models.js';

const datastore = new Datastore();
const KIND = "Commande";

export async function syncBilletWeb(req: Request, res: Response) {
  console.log("Received Sync billet web request");
  const {full} = req.body;
  try {
    // Récupération des participants BilletWeb
    const commandes = await fetchBilletWebAttendees(full);
    const commandeByAcheteur: Record<string, CommandeEntity> = groupCommandByAcheteur(commandes);
    for (const acheteur in commandeByAcheteur) {
      const acheteurKey = datastore.key([KIND, acheteur]);
      const [commande] = await datastore.get(acheteurKey);
      if (commande) {
        // supprime les doublons
        commande.tickets = [...new Map(
          [...commandeByAcheteur[acheteur].tickets, ...commande.tickets].map(ticket => [ticket.ticket_id, ticket])
        ).values()];
        await datastore.save({key: acheteurKey, data: commande});
      } else {
        await datastore.save({key: acheteurKey, data: commandeByAcheteur[acheteur]});
      }
      await sendBilletEmail(commandeByAcheteur[acheteur], acheteurKey, datastore);
    }
    console.log('new billets stored in datastore');
    res.send(`Sync done!`);
  } catch (err) {
    console.log('Erreur lors du sync billet web', err);
    res.status(500).send('Erreur lors du sync billet web');
  }
} 
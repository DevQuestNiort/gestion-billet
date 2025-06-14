import mailjet from 'node-mailjet';
import { Datastore, Key } from '@google-cloud/datastore';
import { CommandeEntity } from '../models.js';
import { getMailjetApiKey, getMailjetApiSecret } from './secrets.js';

interface MailAttachment {
  ContentType: string;
  Filename: string;
  Base64Content: string;
}

export async function sendMail({
  toEmail,
  toName,
  subject,
  templateId,
  variables,
  attachments
}: {
  toEmail: string;
  toName: string;
  subject: string;
  templateId: number;
  variables: Record<string, any>;
  attachments?: MailAttachment[];
}) {
  const apiKey = await getMailjetApiKey();
  const apiSecret = await getMailjetApiSecret();
  const mailClient = mailjet.apiConnect(apiKey, apiSecret);
  const mailData = {
    Messages: [
      {
        From: {
          Email: 'bureau@devquest.fr',
          Name: 'DevQuest'
        },
        To: [
          {
            Email: toEmail,
            Name: toName
          }
        ],
        Subject: subject,
        TemplateID: templateId,
        TemplateLanguage: true,
        Variables: variables,
        Attachments: attachments || []
      }
    ]
  };
  await mailClient.post('send', { version: 'v3.1' }).request(mailData);
}

export async function sendBilletEmail(
  entity: CommandeEntity,
  key: Key,
  datastore: Datastore,
  pdfBuffer?: Buffer
) {
  const urlSafeKey = await datastore.keyToLegacyUrlSafe(key);
  await sendMail({
    toEmail: entity.acheteur_email,
    toName: `${entity.acheteur_firstname} ${entity.acheteur_lastname}`,
    subject: 'Votre billet DevQuest 2025',
    templateId: 6885538,
    variables: { billetLink: entity.tickets[0]?.ticket_url || '' },
    attachments: pdfBuffer
      ? [{
          ContentType: 'application/pdf',
          Filename: 'billet.pdf',
          Base64Content: pdfBuffer.toString('base64'),
        }]
      : []
  });
  await datastore.save({key: key, data: {...entity, notified: true}});
}

export async function sendCommandeLinkEmail(
  entity: CommandeEntity,
  key: Key,
  datastore: Datastore,
  email: string
) {
  const urlSafeKey = await datastore.keyToLegacyUrlSafe(key);
  await sendMail({
    toEmail: email,
    toName: `${entity.acheteur_firstname} ${entity.acheteur_lastname}`,
    subject: 'Dernière étape avant de recevoir vos billets DevQuest 2025',
    templateId: 6885501,
    variables: { billetterieLink: `https://billetterie.devquest.fr/commande/${urlSafeKey}` },
  });
  await datastore.save({key: key, data: {...entity, notified: true}});
} 
const functions = require('@google-cloud/functions-framework');
const {Datastore} = require('@google-cloud/datastore');
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager').v1;
const mailjet = require('node-mailjet');
const fetch = require("node-fetch");

const KIND = "Commande";

const datastore = new Datastore();
const secretmanagerClient = new SecretManagerServiceClient();

const MAILJET_API_KEY_SECRET_NAME = `projects/${process.env.GCP_PROJECT_ID}/secrets/mailjet-api-key/versions/latest`;
const MAILJET_API_SECRET_SECRET_NAME = `projects/${process.env.GCP_PROJECT_ID}/secrets/mailjet-api-secret/versions/latest`;
const BILLET_WEB_SECRET_NAME = `projects/${process.env.GCP_PROJECT_ID}/secrets/billetweb-basic-token/versions/latest`;

functions.http('splitTicket', async (req, res) => {

  const {commandId, ticketId} = req.body;
  console.log(`Received a query on Ticket ${ticketId}`);

  try {

    const key = datastore.keyFromLegacyUrlsafe(commandId);
    const [commandEntity] = await datastore.get(key);

    if (!commandEntity) {
      return res.status(404).json({error: "Command not found"});
    }

    const ticketIndex = commandEntity.tickets.findIndex(ticket => ticket.ticket_id === ticketId);
    if (ticketIndex === -1) {
      return res.status(404).send({error: "Ticket not found"});
    }
    const ticket = commandEntity.tickets[ticketIndex]
    if (ticket.generated) {
      return res.status(400).send({error: "Ticket has already been generated"});
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

    // update billet web
    const updateResponse = await fetch("https://www.billetweb.fr/api/event/1220831/update_product", {
        method: "POST",
        body: {
          data: [
            {
              id: ticket.id,
              name: lastname.toUpperCase(),
              firstname: firstname,
              email: email
            }
          ]
        },
        headers: {
          "Authorization": `Basic ${billet_web_token.payload.data.toString('utf8')}`,
          "Content-Type": "application/json"
        }
    });

    if (!updateResponse.ok) {
      return res.status(500).send({error: "unable to update billet on BilletWeb"});
    }

    const attachementResponse = await fetch(ticket.ticket_url);
    const pdfBuffer = await attachementResponse.buffer();

    // Send mail 
    const [apiKey] = await secretmanagerClient.accessSecretVersion({name: MAILJET_API_KEY_SECRET_NAME});
    const [apiSecret] = await secretmanagerClient.accessSecretVersion({name: MAILJET_API_SECRET_SECRET_NAME});

    const mailClient = mailjet.apiConnect(
      apiKey.payload.data.toString('utf8'),
      apiSecret.payload.data.toString('utf8')
    );

    const mailData = {
      Messages: [
        {
          From: {
            Email: 'bureau@devquest.fr',
            Name: 'DevQuest'
          },
          To: [
            {
              Email: email,
              Name: `${commandEntity.acheteur_firstname} ${commandEntity.acheteur_lastname}`
            }
          ],
          Subject: 'Votre billet DevQuest 2025',
          TemplateID: 6885538,
          TemplateLanguage: true,
          Variables: {
            billetLink: ticket.ticket_url
          },
          Attachments: [
            {
              ContentType: 'application/pdf',
              Filename: 'billet.pdf',
              Base64Content: pdfBuffer.toString('base64'),
            },
          ],
        }
      ]
    };

    await mailClient.post('send', { version: 'v3.1' }).request(mailData);
    console.log('email send');

    await datastore.save({
      key: key,
      data: commandEntity,
    });

    res.status(200).json(commandEntity);
  } catch(err) {
    console.log(`Error occured while update ticket ${ticketId} in command ${commandId}`, err);
    res.status(500).send({error: 'An error occured whiled updated ticket'});
  }
});

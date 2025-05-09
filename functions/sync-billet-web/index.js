const functions = require('@google-cloud/functions-framework');
const {Datastore} = require('@google-cloud/datastore');
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager').v1;
const fetch = require("node-fetch");
const {GoogleAuth} = require('google-auth-library');


const KIND = "Commande"; 
const BILLET_WEB_SECRET_NAME = `projects/${process.env.GCP_PROJECT_ID}/secrets/billetweb-basic-token/versions/latest`;
const GCP_PROJECT_NAME = process.env.GCP_PROJECT_NAME
const GCP_REGION = process.env.GCP_REGION

const FUNCTION_BASE_URL = `https://${GCP_REGION}-${GCP_PROJECT_NAME}.cloudfunctions.net/get_commande_by_email-function`

const auth = new GoogleAuth();

functions.http('syncBilletWeb', async (req, res) => {
  console.log("Received Sync billet web request");

  const {full} = req.body;

  const secretmanagerClient = new SecretManagerServiceClient();
  const [billet_web_token] = await secretmanagerClient.accessSecretVersion({name: BILLET_WEB_SECRET_NAME});
  let url = "https://www.billetweb.fr/api/event/1220831/attendees?since=120";
  if (full) {
    url = "https://www.billetweb.fr/api/event/1220831/attendees"
  }

  const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${billet_web_token.payload.data.toString('utf8')}`,
        "Content-Type": "application/json"
      }
  });

  const commandes = await response.json();
  console.log(`Found ${commandes.length} new billets`);

  const commandeByAcheteur = groupCommandByAcheteur(commandes);

  console.log('Init datastore connection');
  const datastore = new Datastore();

  const functionClient = await auth.getIdTokenClient(FUNCTION_BASE_URL);

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
    await functionClient.request({
      url: FUNCTION_BASE_URL,
      method: 'POST',
      data: {email: commandeByAcheteur[acheteur].acheteur_email},
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }


  console.log('new billets stored in datastore');
  res.send(`Sync done!`);
});


function groupCommandByAcheteur(commandes) {
  const commandeByAcheteur = {};

  for (const ticket of commandes) {
    const acheteur = ticket.order_email;
    if (!commandeByAcheteur[acheteur]) {
      commandeByAcheteur[acheteur] = {
        acheteur_email: acheteur,
        acheteur_firstname: ticket.order_firstname,
        acheteur_lastname: ticket.order_name,
        tickets: []
      };
    }

    commandeByAcheteur[acheteur].tickets.push({
      ticket_id: ticket.ext_id,
      id: ticket.id,
      order_id: ticket.order_ext_id,
      type: ticket.ticket_id,
      ticket_url: ticket.product_download
    });
  }
  return commandeByAcheteur;
}


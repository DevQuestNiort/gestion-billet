const functions = require('@google-cloud/functions-framework');
const {Datastore} = require('@google-cloud/datastore');
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager').v1;
const mailjet = require('node-mailjet');

const KIND = "Commande";

const datastore = new Datastore();
const secretmanagerClient = new SecretManagerServiceClient();

const MAILJET_API_KEY_SECRET_NAME = `projects/${process.env.GCP_PROJECT_ID}/secrets/mailjet-api-key/versions/latest`;
const MAILJET_API_SECRET_SECRET_NAME = `projects/${process.env.GCP_PROJECT_ID}/secrets/mailjet-api-secret/versions/latest`;

functions.http('getCommandByEmail', async (req, res) => {
  
  const {email, force} = req.body;
  console.log(`Received a query on email ${email}`);

  const query = datastore
  .createQuery(KIND)
    .filter("acheteur_email", '=', email)
    .limit(1);

  const [resultats] = await datastore.runQuery(query);

  if (!resultats || resultats.length == 0) {
    return res.status(404).json({error: "Command not found"});
  }
  
  console.log(`Command has been found for email ${email}`);
  
  const entity = resultats[0];
  const key = entity[datastore.KEY];

  // Encoder la clé au format legacy URL-safe
  const urlSafeKey = await datastore.keyToLegacyUrlSafe(key);

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
            Name: `${entity.acheteur_firstname} ${entity.acheteur_lastname}`
          }
        ],
        Subject: 'Dernière étape avant de recevoir vos billets DevQuest 2025',
        TemplateID: 6885501,
        TemplateLanguage: true,
        Variables: {
          billetterieLink: `https://billetterie.devquest.fr/commande/${urlSafeKey}`
        }
    }
    ]
  };

  if (!entity.notified || force) {
      const response = await mailClient.post('send', { version: 'v3.1' }).request(mailData);
      console.log('email send', response.body);
      await datastore.save({key: key, data: {...entity, notified: true}});
    }
  return res.status(200).json({result: "ok"});
});

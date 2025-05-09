import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';

import { callCloudFunction } from './cloud.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const billetsTypeMapping = {
  '6119379': 'Billet 2 Jours',
  '6119377': 'Billet Jeudi',
  '6289969': 'Billet Jeudi',
  '6119378': 'Billet Vendredi',
  '6289970': 'Billet Vendredi',
  '6267785': 'Billet Speaker',
};

function renderWithLayout(res, view, options = {}) {
  ejs.renderFile(
    path.join(__dirname, 'views', view),
    options,
    (err, str) => {
      if (err) return res.status(500).send('Erreur de rendu');
      res.render('layout', { title: options.title || '', body: str });
    }
  );
}

app.get('/', (req, res) => {
  renderWithLayout(res, 'index.ejs', { title: 'Accueil' });
});

app.get('/commande/:commandId', async (req, res) => {
  const commandId = req.params.commandId;
  console.log(`Querying command ${commandId}`);
  try {
    const rawBillets = await callCloudFunction("get_commande_detail-function", {commandId});
    const billets = rawBillets.tickets
      .map(billet => ({
        ...billet,
        type: billetsTypeMapping[billet.type] || billet.type
      }))
      .sort((a, b) => a.type.localeCompare(b.type));
    renderWithLayout(res, 'commande.ejs', {tickets: billets, commandId, encodeURIComponent})
  } catch(e) {
    console.log(`Error while querrying commande ${commandId}`, e);
    res.send('<p>Une erreur est survenu lors de la récupération de votre commande.</p>');
  }
});

app.post('/:commandId/ticket/:ticketId', async(req, res) => {

  const {commandId, ticketId} = req.params;
  console.log(commandId, ticketId);
  const {firstname, lastname, email, type} = req.body;
  console.log(`Updating ticket ${ticketId} for ${email}`);

  try {
    await callCloudFunction('update_billet_detail-function', {commandId, ticketId, firstname, lastname, email})
    return res.send(`
      <td>${ticketId}</td>
      <td>${type}</td>
      <td><input type="text" name="lastname" value="${lastname}" required disabled/></td>
      <td><input type="text" name="firstname" value="${firstname}" required disabled/></td>
      <td><input type="email" name="email" value="${email}" required disabled/></td>
      <td>
          <div>Votre place vous a été envoyé par mail</div>
      </td>
    `);
  } catch(err) {
    console.log(`An error occured while updating ticket ${ticketId} on command ${commandId}`);
    res.send(`
      <td>${ticketId}</td>
      <td>${type}</td>
      <td><input type="text" name="lastname" value="${lastname}" required /></td>
      <td><input type="text" name="firstname" value="${firstname}" required /></td>
      <td><input type="email" name="email" value="${email}" required /></td>
      <td>
          <div>Une erreur est survenu lors de la mise à jour de votre billet.</div>
      </td>
      `);
  }

});


app.post('/get-commande-by-email', async (req, res) => {
  const email = req.body.email || 'inconnu';
  try {
    const response = await callCloudFunction("get_commande_by_email-function", {email, force: true});
    if (response.error) {
        res.send(`<p class="error">Aucun commande n'a été trouvé avec l'adresse: ${email}.</p>`)
    } else {
        res.send(`<p>Un email avec le lien de connexion vous a été envoyé à l'adresse: ${email}.</p>`);
    }
  } catch(error) {
    res.send(`<p>Une erreur s'est produite lors de la récupération de votre commande. Vous pouvez nous contacter par mail: bureau@devquest.fr</p>`)
  }

  
});

app.listen(PORT, () => {
  console.log(`Serveur dispo sur http://localhost:${PORT}`);
});
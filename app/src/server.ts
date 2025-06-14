import express, { Express } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import commandeRoutes from './routes/commande.js';
import syncRoutes from './routes/sync.js';
import indexRoutes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app: Express = express();
const PORT = process.env.PORT || 8080;

app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, '../views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(__dirname, '../public')));

app.use('/', indexRoutes);
app.use('/', commandeRoutes);
app.use('/', syncRoutes);

app.listen(PORT, () => {
  console.log(`Serveur dispo sur http://localhost:${PORT}`);
});
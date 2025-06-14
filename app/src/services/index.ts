import { fileURLToPath } from 'url';
import path from 'path';
import ejs from 'ejs';
import { Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function renderAccueil(req: Request, res: Response) {
  ejs.renderFile(
    path.resolve(__dirname, '../../views/index.ejs'),
    { title: 'Accueil' },
    (err, str) => {
      if (err) {
        console.error('Erreur EJS:', err);
        return res.status(500).send('Erreur de rendu');
      }
      res.render('layout', { title: 'Accueil', body: str });
    }
  );
} 
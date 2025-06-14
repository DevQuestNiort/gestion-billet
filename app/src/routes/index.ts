import express, { Router } from 'express';
import { renderAccueil } from '../services/index.js';

const router: Router = express.Router();

router.get('/', renderAccueil);

export default router; 
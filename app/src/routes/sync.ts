import express, { Router } from 'express';
import { syncBilletWeb } from '../services/sync.js';

const router: Router = express.Router();

router.post('/sync-billet-web', syncBilletWeb);

export default router; 
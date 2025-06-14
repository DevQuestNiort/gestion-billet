import express, { Router, Request, Response, NextFunction } from 'express';
import { getCommande, postTicket, postGetCommandeByEmail } from '../services/commande.js';

const router: Router = express.Router();

function asyncHandler(fn: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

router.get('/commande/:commandId', asyncHandler(getCommande));
router.post('/:commandId/ticket/:ticketId', asyncHandler(postTicket));
router.post('/get-commande-by-email', asyncHandler(postGetCommandeByEmail));

export default router; 
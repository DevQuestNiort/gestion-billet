import { CommandeEntity, Ticket, BilletWebAttendee } from '../models.js';

export function groupCommandByAcheteur(commandes: BilletWebAttendee[]): Record<string, CommandeEntity> {
  const commandeByAcheteur: Record<string, CommandeEntity> = {};
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
    } as Ticket);
  }
  return commandeByAcheteur;
} 
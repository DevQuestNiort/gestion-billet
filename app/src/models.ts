export interface Ticket {
  ticket_id: string;
  id: string;
  order_id: string;
  type: string;
  ticket_url: string;
  lastname?: string;
  firstname?: string;
  email?: string;
  generated?: boolean;
}

export interface CommandeEntity {
  acheteur_email: string;
  acheteur_firstname: string;
  acheteur_lastname: string;
  tickets: Ticket[];
  ticket_ids?: string[];
  notified?: boolean;
  [key: string]: any;
}

export interface BilletWebAttendee {
  ext_id: string;
  id: string;
  order_ext_id: string;
  ticket_id: string;
  product_download: string;
  order_email: string;
  order_firstname: string;
  order_name: string;
} 
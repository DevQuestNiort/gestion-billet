import { describe, it, expect } from 'vitest';
import { groupCommandByAcheteur } from '../../src/utils/groupCommandByAcheteur.js';
import { BilletWebAttendee } from '../../src/models.js';

describe('groupCommandByAcheteur', () => {
  it('regroupe les tickets par acheteur', () => {
    const attendees: BilletWebAttendee[] = [
      {
        ext_id: '1',
        id: 'a',
        order_ext_id: 'o1',
        ticket_id: 't1',
        product_download: 'url1',
        order_email: 'test@example.com',
        order_firstname: 'John',
        order_name: 'Doe'
      },
      {
        ext_id: '2',
        id: 'b',
        order_ext_id: 'o2',
        ticket_id: 't2',
        product_download: 'url2',
        order_email: 'test@example.com',
        order_firstname: 'John',
        order_name: 'Doe'
      }
    ];
    const grouped = groupCommandByAcheteur(attendees);
    expect(Object.keys(grouped)).toHaveLength(1);
    expect(grouped['test@example.com'].tickets).toHaveLength(2);
  });
}); 
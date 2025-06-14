import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as billetweb from '../../src/services/billetweb.js';
import * as secrets from '../../src/services/secrets.js';

vi.mock('../../src/services/secrets.js');
vi.mock('node-fetch', () => {
  return { default: vi.fn() };
});
import fetch from 'node-fetch';

describe('fetchBilletWebAttendees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne un tableau de participants', async () => {
    (secrets.getBilletWebToken as any).mockResolvedValue('token');
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [{ ext_id: '1', id: 'a', order_ext_id: 'o1', ticket_id: 't1', product_download: 'url', order_email: 'a@b.com', order_firstname: 'A', order_name: 'B' }]
    });

    const result = await billetweb.fetchBilletWebAttendees(false);
    expect(result).toHaveLength(1);
    expect(result[0].order_email).toBe('a@b.com');
  });

  it('lève une erreur si la réponse est nok', async () => {
    (secrets.getBilletWebToken as any).mockResolvedValue('token');
    (fetch as any).mockResolvedValue({ ok: false });
    await expect(billetweb.fetchBilletWebAttendees(false)).rejects.toThrow();
  });
}); 
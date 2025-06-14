import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mail from '../../src/services/mail.js';
import * as secrets from '../../src/services/secrets.js';

vi.mock('../../src/services/secrets.js');

vi.mock('node-mailjet', () => {
  const mockApiConnect = vi.fn().mockReturnValue({
    post: vi.fn().mockReturnThis(),
    request: vi.fn().mockResolvedValue(undefined)
  });
  return { default: { apiConnect: mockApiConnect }, apiConnect: mockApiConnect, __mockApiConnect: mockApiConnect };
});

import * as mailjetModule from 'node-mailjet';

describe('sendMail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envoie un mail avec le bon sujet et destinataire', async () => {
    (secrets.getMailjetApiKey as any).mockResolvedValue('key');
    (secrets.getMailjetApiSecret as any).mockResolvedValue('secret');
    await mail.sendMail({
      toEmail: 'a@b.com',
      toName: 'A B',
      subject: 'Sujet',
      templateId: 123,
      variables: { foo: 'bar' }
    });
    expect((mailjetModule as any).__mockApiConnect).toHaveBeenCalledWith('key', 'secret');
  });
}); 
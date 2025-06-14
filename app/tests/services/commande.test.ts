import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as commande from '../../src/services/commande.js';
import * as secrets from '../../src/services/secrets.js';

vi.mock('../../src/services/secrets.js');

vi.mock('@google-cloud/datastore', () => {
  const mockRunQuery = vi.fn();
  // Mock de la query chaînable
  class MockQuery {
    filter() { return this; }
    limit() { return this; }
  }
  // Mock du Datastore
  const mockDatastore = vi.fn(() => ({
    createQuery: vi.fn(() => new MockQuery()),
    runQuery: mockRunQuery
  }));
  return { Datastore: mockDatastore, __mockRunQuery: mockRunQuery, __mockDatastore: mockDatastore };
});
import * as datastoreModule from '@google-cloud/datastore';

describe('getCommandeByEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne la commande pour un email donné', async () => {
    const mockRunQuery = (datastoreModule as any).__mockRunQuery;
    mockRunQuery.mockResolvedValue([[{ email: 'a@b.com', id: '1' }]]);
    const result = await commande.getCommandeByEmail('a@b.com');
    expect(result).toEqual({ email: 'a@b.com', id: '1' });
  });

  it('retourne null si aucune commande', async () => {
    const mockRunQuery = (datastoreModule as any).__mockRunQuery;
    mockRunQuery.mockResolvedValue([[]]);
    const result = await commande.getCommandeByEmail('notfound@b.com');
    expect(result).toBeNull();
  });
});

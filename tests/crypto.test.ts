import { describe, it, expect } from 'vitest';
import { encryptBackup, decryptBackup } from '../src/services/crypto';
import { LinkItem } from '../src/types';

describe('AES-GCM 256 Encrypted Backup Suite', () => {
  const sampleLinks: LinkItem[] = [
    {
      id: 'sec-1',
      url: 'https://example.com/confidential-research',
      title: 'Confidential AI Strategy Document',
      notes: 'Secret internal team notes and benchmarks',
      platform: 'article',
      category: 'Research & Papers',
      tags: ['ai', 'security', 'benchmarks'],
      summary: { tldr: 'High value internal doc' },
      isFavorite: true,
      isArchived: false,
      readStatus: 'reading',
      createdAt: '2026-01-15T12:00:00.000Z',
      updatedAt: '2026-01-15T12:00:00.000Z',
    },
  ];

  it('encrypts and decrypts repository payload with correct passphrase', async () => {
    const passphrase = 'SuperSecretMasterKey!2026';
    const encrypted = await encryptBackup(sampleLinks, passphrase);

    expect(encrypted.version).toBe(1);
    expect(encrypted.totalCount).toBe(1);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.salt).toBeDefined();

    // Verify ciphertext does not contain plaintext strings
    expect(encrypted.ciphertext).not.toContain('Confidential AI Strategy');

    // Decrypt
    const restored = await decryptBackup(encrypted, passphrase);
    expect(restored.length).toBe(1);
    expect(restored[0].title).toBe('Confidential AI Strategy Document');
    expect(restored[0].notes).toBe('Secret internal team notes and benchmarks');
  });

  it('rejects decryption when given incorrect passphrase', async () => {
    const passphrase = 'CorrectPassphrase123';
    const wrongPassphrase = 'WrongPassword456';
    const encrypted = await encryptBackup(sampleLinks, passphrase);

    await expect(decryptBackup(encrypted, wrongPassphrase)).rejects.toThrow();
  });
});

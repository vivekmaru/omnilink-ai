import { EncryptedBackupData, LinkItem } from '../types';

/**
 * Derives an AES-GCM key from a user passphrase and salt using PBKDF2
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypts links collection into a secure AES-GCM encrypted backup package
 */
export async function encryptBackup(
  links: LinkItem[],
  passphrase: string
): Promise<EncryptedBackupData> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const enc = new TextEncoder();
  const plainData = JSON.stringify({
    version: 1,
    links,
    exportedAt: new Date().toISOString(),
  });

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plainData)
  );

  return {
    version: 1,
    iv: arrayBufferToBase64(iv.buffer),
    salt: arrayBufferToBase64(salt.buffer),
    ciphertext: arrayBufferToBase64(ciphertext),
    timestamp: new Date().toISOString(),
    totalCount: links.length,
  };
}

/**
 * Decrypts an encrypted backup package using the user's passphrase
 */
export async function decryptBackup(
  backup: EncryptedBackupData,
  passphrase: string
): Promise<LinkItem[]> {
  try {
    const salt = new Uint8Array(base64ToArrayBuffer(backup.salt));
    const iv = new Uint8Array(base64ToArrayBuffer(backup.iv));
    const ciphertext = base64ToArrayBuffer(backup.ciphertext);

    const key = await deriveKey(passphrase, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const jsonStr = dec.decode(decrypted);
    const parsed = JSON.parse(jsonStr);

    if (Array.isArray(parsed.links)) {
      return parsed.links;
    }
    throw new Error('Invalid backup structure: links array not found');
  } catch (err: any) {
    if (err.name === 'OperationError') {
      throw new Error('Incorrect passphrase or corrupted backup file.');
    }
    throw err;
  }
}

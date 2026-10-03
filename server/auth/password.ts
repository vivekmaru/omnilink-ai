import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/** Issuer recorded on `users` rows created by the built-in password provider. */
export const PASSWORD_ISSUER = 'urn:omnilink:password';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 256;
const EMAIL_MAX_LENGTH = 254;
const NAME_MAX_LENGTH = 120;

// scrypt N=2^15, r=8, p=1 needs ~32 MiB; maxmem leaves headroom for Node's check.
const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1 } as const;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export class PasswordPolicyError extends Error {}

function scryptAsync(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/** Hash a password into a self-describing `scrypt$N$r$p$salt$key` string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const { N, r, p } = SCRYPT_PARAMS;
  const key = await scryptAsync(password, salt, KEY_LENGTH, { N, r, p, maxmem: SCRYPT_MAXMEM });
  return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

/** Constant-time comparison against a stored hash. Malformed hashes never verify. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((value) => Number.isInteger(value) && value > 0) || N > 2 ** 20) return false;
  const salt = Buffer.from(parts[4], 'base64url');
  const expected = Buffer.from(parts[5], 'base64url');
  if (salt.length === 0 || expected.length === 0) return false;
  try {
    const actual = await scryptAsync(password, salt, expected.length, { N, r, p, maxmem: SCRYPT_MAXMEM * 4 });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Lowercase and validate an email address; returns null when it is unusable. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX_LENGTH) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizeDisplayName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const name = value.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX_LENGTH);
  return name || undefined;
}

/** Enforce the new-password policy. Login attempts only check type and maximum length. */
export function assertAcceptablePassword(password: unknown, email: string): asserts password is string {
  if (typeof password !== 'string') throw new PasswordPolicyError('A password is required.');
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new PasswordPolicyError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new PasswordPolicyError(`Use at most ${PASSWORD_MAX_LENGTH} characters.`);
  }
  if (password.trim().toLowerCase() === email) throw new PasswordPolicyError('The password must not be your email address.');
}

/**
 * Fixed-window failure counter for unauthenticated password endpoints. It is
 * per-process and in-memory, which matches the single-node SQLite deployment.
 */
export class AttemptLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
    private readonly now: () => number = Date.now,
  ) {}

  isBlocked(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (entry.resetAt <= this.now()) {
      this.entries.delete(key);
      return false;
    }
    return entry.count >= this.maxAttempts;
  }

  record(key: string): void {
    const now = this.now();
    const entry = this.entries.get(key);
    if (entry && entry.resetAt > now) {
      entry.count += 1;
      return;
    }
    if (this.entries.size >= this.maxKeys) this.prune(now);
    this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
  }

  /** Undo one earlier record(), e.g. an attempt reserved before it turned out to succeed. */
  release(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count <= 0) this.entries.delete(key);
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
    // Still full of live entries: drop the oldest so memory stays bounded.
    while (this.entries.size >= this.maxKeys) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

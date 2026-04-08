import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, needsRehash } from '../../server/auth/password.js';

describe('Password Hashing', () => {
  it('hashes password successfully', async () => {
    const hash = await hashPassword('SecureP@ssw0rd!');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('verifies correct password', async () => {
    const hash = await hashPassword('SecureP@ssw0rd!');
    const valid = await verifyPassword('SecureP@ssw0rd!', hash);
    expect(valid).toBe(true);
  });

  it('rejects incorrect password', async () => {
    const hash = await hashPassword('SecureP@ssw0rd!');
    const valid = await verifyPassword('WrongPassword', hash);
    expect(valid).toBe(false);
  });

  it('checks if rehash is needed', async () => {
    const hash = await hashPassword('SecureP@ssw0rd!');
    // Should be false since it was just generated with current options
    expect(needsRehash(hash)).toBe(false);
  });

  describe('DoS Protection', () => {
    it('throws error if password is empty', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password must be between 1 and 128 characters');
    });

    it('throws error if password is undefined', async () => {
      await expect(hashPassword()).rejects.toThrow('Password must be between 1 and 128 characters');
    });

    it('throws error if password is over 128 characters', async () => {
      const longPassword = 'a'.repeat(129);
      await expect(hashPassword(longPassword)).rejects.toThrow('Password must be between 1 and 128 characters');
    });
  });
});

import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 47104,    // 46 MB (OWASP min)
  timeCost: 2,          // 2 iterations
  parallelism: 2,       // 2 threads
  hashLength: 32        // 256 bits
};

export async function hashPassword(password) {
  if (!password || password.length > 128) {
    throw new Error('Password must be between 1 and 128 characters');
  }
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(password, hash) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// Check if hash needs rehashing (after config changes)
export function needsRehash(hash) {
  return argon2.needsRehash(hash, ARGON2_OPTIONS);
}

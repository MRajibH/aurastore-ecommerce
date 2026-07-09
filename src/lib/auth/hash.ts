import { scrypt, randomBytes, timingSafeEqual } from 'crypto';

// Custom Scrypt configuration matching standard OWASP recommendation
const SCRYPT_PARAMS = {
  N: 16384, // CPU/memory cost parameter
  r: 8,     // block size parameter
  p: 1      // parallelization parameter
};

/**
 * Custom Promise-based wrapper for Node's scrypt function.
 */
function scryptPromise(password: string, salt: string, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Hashes a plaintext password using scrypt and returns salt.hash format.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hashBuffer = await scryptPromise(password, salt, 64);
  return `${salt}.${hashBuffer.toString('hex')}`;
}

/**
 * Verifies a password against a stored salt.hash value using constant-time comparison.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('.');
    if (parts.length !== 2) return false;
    
    const [salt, hash] = parts;
    const keyBuffer = Buffer.from(hash, 'hex');
    
    const derivedKey = await scryptPromise(password, salt, 64);
    
    // Use timingSafeEqual to prevent timing attacks
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch (error) {
    return false;
  }
}

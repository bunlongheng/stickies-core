import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const SCRYPT_KEYLEN = 32;
const SALT_LEN = 16;

// Async scrypt: the KDF is deliberately CPU-heavy, and running it synchronously
// would block the event loop for every caller while one passcode is hashed.
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Hash a passcode as `salt$scrypt(passcode, salt)` in hex.
 *
 * Byte-for-byte the format the full app writes and reads, because both apps
 * share one `stickies` table: a note locked here has to open there, and a
 * different KDF or a different salt length would lock the owner out of their
 * own note with no way back.
 */
export async function hashLockPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scryptAsync(plain, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}$${key.toString("hex")}`;
}

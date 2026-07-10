/**
 * Simple ULID generator using crypto.randomUUID() as entropy source.
 * ULID format: 26 characters, Crockford base32 (0-9A-HJKMNP-TV-Z).
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

export function ulid(seedTime?: number): string {
  const time = seedTime ?? Date.now();
  const timePart = encodeTime(time, TIME_LEN);

  // Use crypto.randomUUID() for entropy (128 bits → 16 random chars)
  const uuid = crypto.randomUUID().replace(/-/g, '');
  const randomBytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    randomBytes[i] = parseInt(uuid.slice(i * 2, i * 2 + 2), 16);
  }
  const randomPart = encodeRandom(randomBytes, RANDOM_LEN);

  return timePart + randomPart;
}

function encodeTime(time: number, length: number): string {
  let str = '';
  for (let i = length - 1; i >= 0; i--) {
    const mod = time % ENCODING_LEN;
    str = ENCODING.charAt(mod) + str;
    time = (time - mod) / ENCODING_LEN;
  }
  return str;
}

function encodeRandom(bytes: Uint8Array, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += ENCODING.charAt(bytes[i] % ENCODING_LEN);
  }
  return str;
}

export function isValidUlid(value: string): boolean {
  if (value.length !== 26) return false;
  for (const char of value) {
    if (!ENCODING.includes(char)) return false;
  }
  return true;
}

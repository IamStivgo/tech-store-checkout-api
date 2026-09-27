import { randomBytes, randomUUID } from 'node:crypto';

import type { IdGenerator } from '../../domain/id-generator.port';

export const CROCKFORD_BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// 256 is a multiple of 32, so keeping the low 5 bits of each byte is unbiased.
const BASE32_MASK = 0b11111;

export class CryptoIdGenerator implements IdGenerator {
  uuid(): string {
    return randomUUID();
  }

  randomBase32(length: number): string {
    return Array.from(randomBytes(length), (byte) =>
      CROCKFORD_BASE32_ALPHABET.charAt(byte & BASE32_MASK),
    ).join('');
  }
}

import { CROCKFORD_BASE32_ALPHABET, CryptoIdGenerator } from './crypto-id-generator';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('CryptoIdGenerator', () => {
  const generator = new CryptoIdGenerator();

  it('generates distinct UUID v4 values', () => {
    const first = generator.uuid();

    expect(first).toMatch(UUID_V4);
    expect(generator.uuid()).not.toBe(first);
  });

  it('generates Crockford Base32 strings of the requested length', () => {
    expect(generator.randomBase32(10)).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
    expect(generator.randomBase32(0)).toBe('');
  });

  it('never uses the ambiguous letters I, L, O and U', () => {
    expect(CROCKFORD_BASE32_ALPHABET).toHaveLength(32);
    expect(generator.randomBase32(2_000)).not.toMatch(/[ILOU]/);
  });
});

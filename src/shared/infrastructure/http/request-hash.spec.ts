import { hashRequestBody } from './request-hash';

describe('hashRequestBody', () => {
  it('returns a hex SHA-256 digest', () => {
    expect(hashRequestBody({ quantity: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ignores the order of object keys at every level', () => {
    const original = { productId: 'p-1', address: { city: '05001', line1: 'Calle 1' } };
    const reordered = { address: { line1: 'Calle 1', city: '05001' }, productId: 'p-1' };

    expect(hashRequestBody(reordered)).toBe(hashRequestBody(original));
  });

  it('distinguishes different values', () => {
    expect(hashRequestBody({ quantity: 2 })).not.toBe(hashRequestBody({ quantity: 1 }));
  });

  it('keeps the order of array items', () => {
    expect(hashRequestBody({ items: [1, 2] })).not.toBe(hashRequestBody({ items: [2, 1] }));
  });

  it('canonicalizes objects inside arrays', () => {
    expect(hashRequestBody([{ b: 1, a: 2 }])).toBe(hashRequestBody([{ a: 2, b: 1 }]));
  });

  it('hashes a missing body like null', () => {
    expect(hashRequestBody(undefined)).toBe(hashRequestBody(null));
  });
});

import { FakeIdGenerator } from '../../../../test/fakes/fake-id-generator';

import { newTransactionReference } from './transaction-reference';

describe('newTransactionReference', () => {
  const ids = new FakeIdGenerator(['unused-uuid']);

  it('joins the prefix, the purchase date and 10 random Base32 characters', () => {
    expect(newTransactionReference('CKT', new Date('2026-09-24T20:15:00.000Z'), ids)).toBe(
      'CKT-20260924-AAAAAAAAAA',
    );
  });

  it('uses the date in Colombia, not in UTC', () => {
    // 02:00 UTC on the 25th is still the 24th in Bogotá (UTC-5).
    expect(newTransactionReference('CKT', new Date('2026-09-25T02:00:00.000Z'), ids)).toBe(
      'CKT-20260924-AAAAAAAAAA',
    );
  });
});

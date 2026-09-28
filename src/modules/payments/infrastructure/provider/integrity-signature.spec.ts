import { unwrap } from '../../../../../test/builders/unwrap';
import { Money } from '../../../../shared/domain/money.vo';

import { integritySignature } from './integrity-signature';

describe('integritySignature', () => {
  it('hashes reference, amount in cents, currency and secret in that order', () => {
    // printf '%s' "CKT-20260924-7K3M9Q2PXA5090000COPintegrity_secret_for_tests" | sha256sum
    expect(
      integritySignature(
        'CKT-20260924-7K3M9Q2PXA',
        unwrap(Money.create(5_090_000)),
        'integrity_secret_for_tests',
      ),
    ).toBe('f9c3500541d5cdbc630b911c698dd0bae5a05f97a28205c464628d036871923c');
  });

  it('changes when the amount changes', () => {
    const signature = (cents: number) =>
      integritySignature('CKT-1', unwrap(Money.create(cents)), 'secret');

    expect(signature(5_090_000)).not.toBe(signature(5_090_100));
  });
});

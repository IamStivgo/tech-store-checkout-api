import { createHash } from 'node:crypto';

import type { Money } from '../../../../shared/domain/money.vo';

/**
 * Integrity signature of a payment: SHA-256 of reference + amount in cents + currency + secret,
 * in that order. The provider rejects a payment whose amount or reference does not match it.
 */
export const integritySignature = (reference: string, amount: Money, secret: string): string =>
  createHash('sha256')
    .update(`${reference}${amount.amountInCents}${amount.currency}${secret}`)
    .digest('hex');

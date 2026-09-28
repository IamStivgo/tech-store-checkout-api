import { createHash, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import { err, ok, type Result } from '../../../../shared/domain/result';
import { InvalidEventSignatureError } from '../../domain/payment-gateway.errors';
import type { ProviderPayment } from '../../domain/provider-payment';

import { toProviderPayment } from './provider-payment.mapper';
import { transactionSchema } from './provider-schemas';

export interface PaymentEventsOptions {
  /** Events secret of the merchant. */
  readonly secret: string;
  /** `test` for the sandbox, `prod` for real payments: events of the other one are ignored. */
  readonly environment: string;
}

const TRANSACTION_UPDATED = 'transaction.updated';

const envelopeSchema = z.object({
  event: z.string(),
  data: z.record(z.string(), z.unknown()),
  environment: z.string(),
  signature: z.object({
    properties: z.array(z.string().min(1)),
    checksum: z.string().regex(/^[0-9a-fA-F]{64}$/),
  }),
  timestamp: z.number().int(),
});

const transactionEventSchema = z.object({ transaction: transactionSchema });

// Signed properties are paths inside `data`, e.g. "transaction.status".
const valueAt = (data: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        typeof value === 'object' && value !== null
          ? (value as Record<string, unknown>)[key]
          : undefined,
      data,
    );

const sameChecksum = (expected: string, received: string): boolean =>
  timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received.toLowerCase(), 'hex'));

/**
 * Verifies a payment provider event: SHA-256 of the signed properties' values, the timestamp and
 * the events secret, compared in constant time. Only then is its content trusted.
 */
export const verifyPaymentEvent = (
  event: unknown,
  { secret, environment }: PaymentEventsOptions,
): Result<ProviderPayment | null, InvalidEventSignatureError> => {
  const envelope = envelopeSchema.safeParse(event);
  if (!envelope.success) {
    return err(new InvalidEventSignatureError());
  }
  const { data, signature, timestamp } = envelope.data;
  const signed = signature.properties.map((property) => String(valueAt(data, property))).join('');
  const expected = createHash('sha256').update(`${signed}${timestamp}${secret}`).digest('hex');
  if (!sameChecksum(expected, signature.checksum)) {
    return err(new InvalidEventSignatureError());
  }

  if (envelope.data.event !== TRANSACTION_UPDATED || envelope.data.environment !== environment) {
    return ok(null);
  }
  const payload = transactionEventSchema.safeParse(data);
  return payload.success
    ? toProviderPayment(payload.data.transaction).match({
        ok: (payment): Result<ProviderPayment | null, InvalidEventSignatureError> => ok(payment),
        err: () => ok(null),
      })
    : ok(null);
};

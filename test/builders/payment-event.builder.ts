import { createHash } from 'node:crypto';

const SIGNED_PROPERTIES = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
const TIMESTAMP = 1_790_566_893;

export interface EventTransaction {
  readonly id: string;
  readonly reference: string;
  readonly status: string;
  readonly amount_in_cents: number;
  readonly currency: string;
}

export const anEventTransaction = (
  overrides: Partial<EventTransaction> = {},
): EventTransaction => ({
  id: '15113-1790566893-12345',
  reference: 'CKT-20260924-7K3M9Q2PXA',
  status: 'APPROVED',
  amount_in_cents: 5_090_000,
  currency: 'COP',
  ...overrides,
});

/** A provider event signed like the provider does: SHA-256 of the values, timestamp and secret. */
export const aSignedEvent = (
  secret: string,
  {
    transaction = anEventTransaction(),
    event = 'transaction.updated',
    environment = 'test',
  }: { transaction?: EventTransaction; event?: string; environment?: string } = {},
) => {
  const values = SIGNED_PROPERTIES.map(
    (property) => transaction[property.split('.')[1] as keyof EventTransaction],
  ).join('');
  return {
    event,
    data: { transaction },
    environment,
    signature: {
      properties: SIGNED_PROPERTIES,
      checksum: createHash('sha256').update(`${values}${TIMESTAMP}${secret}`).digest('hex'),
    },
    timestamp: TIMESTAMP,
    sent_at: '2026-09-24T20:17:00.000Z',
  };
};

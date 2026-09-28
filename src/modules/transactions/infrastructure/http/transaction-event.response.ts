import type { TransactionEventSource, TransactionEventType } from '../../domain/transaction-event';
import type { StoredTransactionEvent } from '../../domain/transaction-event.repository.port';
import type { TransactionStatus } from '../../domain/transaction-status';

export interface TransactionEventResponse {
  readonly id: string;
  readonly type: TransactionEventType;
  readonly source: TransactionEventSource;
  readonly fromStatus?: TransactionStatus;
  readonly toStatus?: TransactionStatus;
  readonly providerTransactionId?: string;
  readonly providerStatus?: string;
  readonly amountInCents?: number;
  readonly details?: Readonly<Record<string, string | number>>;
  readonly requestId: string;
  readonly occurredAt: string;
}

export interface TransactionEventListResponse {
  readonly data: TransactionEventResponse[];
  readonly meta: { readonly count: number };
}

export const toTransactionEventListResponse = (
  events: readonly StoredTransactionEvent[],
): TransactionEventListResponse => ({
  data: events.map(({ transactionId: _transactionId, occurredAt, ...event }) => ({
    ...event,
    occurredAt: occurredAt.toISOString(),
  })),
  meta: { count: events.length },
});

import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';

import type { TransactionEvent } from './transaction-event';

/** An event as it was stored: with its id and the request that caused it. */
export interface StoredTransactionEvent extends TransactionEvent {
  readonly id: string;
  readonly requestId: string;
}

/** Append-only audit trail (ADR-012): events are added, never changed or deleted. */
export interface TransactionEventRepository {
  append(events: readonly TransactionEvent[]): ResultAsync<void, PersistenceError>;
  /** The timeline of a transaction, oldest first. */
  listFor(transactionId: string): ResultAsync<StoredTransactionEvent[], PersistenceError>;
}

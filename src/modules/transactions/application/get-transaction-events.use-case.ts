import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';
import type {
  StoredTransactionEvent,
  TransactionEventRepository,
} from '../domain/transaction-event.repository.port';
import type { TransactionNotFoundError } from '../domain/transaction.errors';
import type { TransactionRepository } from '../domain/transaction.repository.port';

import { findTransaction } from './find-transaction';

/** The audit timeline of an existing transaction, oldest first (ADR-012). */
export class GetTransactionEvents {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly events: TransactionEventRepository,
  ) {}

  execute(
    transactionId: string,
  ): ResultAsync<StoredTransactionEvent[], TransactionNotFoundError | PersistenceError> {
    return findTransaction(this.transactions, transactionId).andThen(({ id }) =>
      this.events.listFor(id),
    );
  }
}

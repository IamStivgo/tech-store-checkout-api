import type { Clock } from '../../../shared/domain/clock.port';
import type { PersistenceError } from '../../../shared/domain/persistence-error';
import { err, ok, type ResultAsync } from '../../../shared/domain/result';
import type { CheckoutUnitOfWork } from '../domain/checkout-unit-of-work.port';
import type { Transaction } from '../domain/transaction.entity';
import {
  TransactionNotCancellableError,
  type TransactionNotFoundError,
} from '../domain/transaction.errors';
import type { TransactionRepository } from '../domain/transaction.repository.port';

import { findTransaction } from './find-transaction';

export type CancelTransactionError =
  TransactionNotFoundError | TransactionNotCancellableError | PersistenceError;

/** The buyer gives up before paying: the transaction is CANCELLED and its stock released. */
export class CancelTransaction {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly checkout: CheckoutUnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(id: string): ResultAsync<Transaction, CancelTransactionError> {
    return findTransaction(this.transactions, id)
      .andThen((transaction) => transaction.cancel(this.clock.now()))
      .andThen((cancelled) =>
        this.checkout
          .closeAndReleaseStock(cancelled)
          .andThen((outcome) => (outcome === 'applied' ? ok(cancelled) : this.alreadyFinal(id))),
      );
  }

  // A payment result or the expiry closed it first: report its real state.
  private alreadyFinal(id: string): ResultAsync<never, CancelTransactionError> {
    return findTransaction(this.transactions, id).andThen((current) =>
      err(new TransactionNotCancellableError(current.status)),
    );
  }
}

import type { PersistenceError } from '../../../shared/domain/persistence-error';
import { err, ok, type ResultAsync } from '../../../shared/domain/result';
import type { Transaction } from '../domain/transaction.entity';
import { TransactionNotFoundError } from '../domain/transaction.errors';
import type { TransactionRepository } from '../domain/transaction.repository.port';

export const findTransaction = (
  transactions: TransactionRepository,
  id: string,
): ResultAsync<Transaction, TransactionNotFoundError | PersistenceError> =>
  transactions
    .findById(id)
    .andThen((transaction) =>
      transaction ? ok(transaction) : err(new TransactionNotFoundError()),
    );

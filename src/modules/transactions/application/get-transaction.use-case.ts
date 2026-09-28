import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';
import type { Transaction } from '../domain/transaction.entity';
import type { TransactionNotFoundError } from '../domain/transaction.errors';
import type { TransactionRepository } from '../domain/transaction.repository.port';

import { findTransaction } from './find-transaction';

export class GetTransaction {
  constructor(private readonly transactions: TransactionRepository) {}

  execute(id: string): ResultAsync<Transaction, TransactionNotFoundError | PersistenceError> {
    return findTransaction(this.transactions, id);
  }
}

import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';

import type { Transaction } from './transaction.entity';

export interface TransactionRepository {
  findById(id: string): ResultAsync<Transaction | null, PersistenceError>;
}

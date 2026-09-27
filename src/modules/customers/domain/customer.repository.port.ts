import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';

import type { Customer } from './customer.entity';

export interface CustomerRepository {
  create(customer: Customer): ResultAsync<void, PersistenceError>;
  findById(id: string): ResultAsync<Customer | null, PersistenceError>;
}

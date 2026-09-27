import type { Customer } from '../../src/modules/customers/domain/customer.entity';
import type { CustomerRepository } from '../../src/modules/customers/domain/customer.repository.port';
import type { PersistenceError } from '../../src/shared/domain/persistence-error';
import { errAsync, okAsync, type ResultAsync } from '../../src/shared/domain/result';

export class InMemoryCustomerRepository implements CustomerRepository {
  readonly customers = new Map<string, Customer>();
  private failure: PersistenceError | undefined;

  constructor(customers: readonly Customer[] = []) {
    customers.forEach((customer) => this.customers.set(customer.id, customer));
  }

  failWith(error: PersistenceError): this {
    this.failure = error;
    return this;
  }

  create(customer: Customer): ResultAsync<void, PersistenceError> {
    if (this.failure) {
      return errAsync(this.failure);
    }
    this.customers.set(customer.id, customer);
    return okAsync(undefined);
  }

  findById(id: string): ResultAsync<Customer | null, PersistenceError> {
    return this.failure ? errAsync(this.failure) : okAsync(this.customers.get(id) ?? null);
  }
}

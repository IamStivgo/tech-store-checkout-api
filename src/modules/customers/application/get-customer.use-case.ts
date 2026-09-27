import type { PersistenceError } from '../../../shared/domain/persistence-error';
import { err, ok, type ResultAsync } from '../../../shared/domain/result';
import { CustomerNotFoundError } from '../domain/customer.errors';
import type { CustomerRepository } from '../domain/customer.repository.port';

import { toCustomerView, type CustomerView } from './customer.views';

export class GetCustomer {
  constructor(private readonly customers: CustomerRepository) {}

  execute(id: string): ResultAsync<CustomerView, CustomerNotFoundError | PersistenceError> {
    return this.customers
      .findById(id)
      .andThen((customer) =>
        customer ? ok(toCustomerView(customer)) : err(new CustomerNotFoundError()),
      );
  }
}

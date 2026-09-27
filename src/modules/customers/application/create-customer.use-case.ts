import type { Clock } from '../../../shared/domain/clock.port';
import type { IdGenerator } from '../../../shared/domain/id-generator.port';
import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';
import type { ValidationError } from '../../../shared/domain/validation-error';
import { Customer, type CustomerData } from '../domain/customer.entity';
import type { CustomerRepository } from '../domain/customer.repository.port';

import { toCustomerView, type CustomerView } from './customer.views';

export type CreateCustomerCommand = CustomerData;

/** Always creates a new customer: there is no lookup by email, so customers cannot be enumerated. */
export class CreateCustomer {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  execute(
    command: CreateCustomerCommand,
  ): ResultAsync<CustomerView, ValidationError | PersistenceError> {
    return Customer.create(this.ids.uuid(), command, this.clock.now()).asyncAndThen((customer) =>
      this.customers.create(customer).map(() => toCustomerView(customer)),
    );
  }
}

import { DomainError } from '../../../shared/domain/domain-error';

export class CustomerNotFoundError extends DomainError {
  readonly code = 'CUSTOMER_NOT_FOUND';

  constructor() {
    super('The customer does not exist.');
  }
}

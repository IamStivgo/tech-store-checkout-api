import { DomainError } from '../../../shared/domain/domain-error';

/** Unknown delivery, or a transaction that was not approved (so it has none). */
export class DeliveryNotFoundError extends DomainError {
  readonly code = 'DELIVERY_NOT_FOUND';

  constructor() {
    super('The delivery does not exist.');
  }
}

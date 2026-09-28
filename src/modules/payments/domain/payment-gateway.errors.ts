import { DomainError } from '../../../shared/domain/domain-error';

/** The provider refused the request (4xx): e.g. a used acceptance token or an invalid card token. */
export class PaymentRejectedByProviderError extends DomainError {
  readonly code = 'PAYMENT_REJECTED_BY_PROVIDER';

  /** @param field Request field the provider complained about, when it says so. */
  constructor(field?: string) {
    super(
      'The payment provider rejected the payment request. Review the card data or try again.',
      field ? { field } : {},
    );
  }
}

/** The provider answered 5xx, an unexpected body, or could not be reached. */
export class PaymentProviderUnavailableError extends DomainError {
  readonly code = 'PAYMENT_PROVIDER_UNAVAILABLE';

  constructor(readonly cause?: unknown) {
    super('The payment provider is not available. Try again in a few minutes.');
  }
}

export class PaymentProviderTimeoutError extends DomainError {
  readonly code = 'PAYMENT_PROVIDER_TIMEOUT';

  constructor() {
    super('The payment provider did not answer in time.');
  }
}

/** A payment event whose checksum does not match: never trusted (it may be forged). */
export class InvalidEventSignatureError extends DomainError {
  readonly code = 'INVALID_EVENT_SIGNATURE';

  constructor() {
    super('The event signature is not valid.');
  }
}

export type PaymentGatewayError =
  PaymentRejectedByProviderError | PaymentProviderUnavailableError | PaymentProviderTimeoutError;

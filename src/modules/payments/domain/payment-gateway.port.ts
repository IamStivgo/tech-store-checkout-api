import type { Result, ResultAsync } from '../../../shared/domain/result';

import type { AcceptanceTokens } from './acceptance-tokens';
import type { CardPaymentRequest } from './card-payment-request';
import type { InvalidEventSignatureError, PaymentGatewayError } from './payment-gateway.errors';
import type { ProviderPayment } from './provider-payment';

export interface PaymentGateway {
  getAcceptanceTokens(): ResultAsync<AcceptanceTokens, PaymentGatewayError>;
  /** RSA public key (PEM) the browser uses to encrypt the card before tokenizing it. */
  getTokenizationKey(): ResultAsync<string, PaymentGatewayError>;
  createCardPayment(request: CardPaymentRequest): ResultAsync<ProviderPayment, PaymentGatewayError>;
  getPayment(providerTransactionId: string): ResultAsync<ProviderPayment, PaymentGatewayError>;
  /** Finds the payment of a reference, e.g. after a timeout while creating it. */
  findPaymentByReference(
    reference: string,
  ): ResultAsync<ProviderPayment | null, PaymentGatewayError>;
  /**
   * Verifies a payment event sent by the provider (webhook). Null when it is valid but not about
   * a payment of this environment, so it is acknowledged and ignored.
   */
  parsePaymentEvent(event: unknown): Result<ProviderPayment | null, InvalidEventSignatureError>;
}

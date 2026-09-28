import type { ResultAsync } from '../../../shared/domain/result';

import type { AcceptanceTokens } from './acceptance-tokens';
import type { CardPaymentRequest } from './card-payment-request';
import type { PaymentGatewayError } from './payment-gateway.errors';
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
}

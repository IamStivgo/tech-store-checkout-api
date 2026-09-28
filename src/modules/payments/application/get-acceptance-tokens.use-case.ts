import type { ResultAsync } from '../../../shared/domain/result';
import type { AcceptanceTokens } from '../domain/acceptance-tokens';
import type { PaymentGatewayError } from '../domain/payment-gateway.errors';
import type { PaymentGateway } from '../domain/payment-gateway.port';

/**
 * Fresh acceptance tokens for one payment attempt. They are single-use, so they are never
 * cached: the web asks again when it opens the payment and on every retry.
 */
export class GetAcceptanceTokens {
  constructor(private readonly gateway: PaymentGateway) {}

  execute(): ResultAsync<AcceptanceTokens, PaymentGatewayError> {
    return this.gateway.getAcceptanceTokens();
  }
}

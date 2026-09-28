import type { ResultAsync } from '../../../shared/domain/result';
import type { PaymentGatewayError } from '../domain/payment-gateway.errors';
import type { PaymentGateway } from '../domain/payment-gateway.port';

/**
 * The key the browser encrypts the card with. The provider does not allow reading it from
 * another origin (CORS), so the API serves it on the store's own origin.
 */
export class GetTokenizationKey {
  constructor(private readonly gateway: PaymentGateway) {}

  execute(): ResultAsync<string, PaymentGatewayError> {
    return this.gateway.getTokenizationKey();
  }
}

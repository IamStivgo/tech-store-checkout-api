import {
  PaymentProviderTimeoutError,
  PaymentProviderUnavailableError,
  PaymentRejectedByProviderError,
} from './payment-gateway.errors';
import { isFinalPaymentStatus } from './provider-payment';

describe('payment gateway errors', () => {
  it('names the field the provider rejected, when known', () => {
    expect(new PaymentRejectedByProviderError('acceptance_token').context).toEqual({
      field: 'acceptance_token',
    });
    expect(new PaymentRejectedByProviderError().context).toEqual({});
  });

  it('uses the stable error codes of the API', () => {
    expect(new PaymentRejectedByProviderError().code).toBe('PAYMENT_REJECTED_BY_PROVIDER');
    expect(new PaymentProviderUnavailableError().code).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
    expect(new PaymentProviderTimeoutError().code).toBe('PAYMENT_PROVIDER_TIMEOUT');
  });
});

describe('isFinalPaymentStatus', () => {
  it.each([
    ['PENDING', false],
    ['APPROVED', true],
    ['DECLINED', true],
    ['VOIDED', true],
    ['ERROR', true],
  ] as const)('%s is final: %s', (status, final) => {
    expect(isFinalPaymentStatus(status)).toBe(final);
  });
});

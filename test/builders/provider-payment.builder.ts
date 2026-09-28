import type { ProviderPayment } from '../../src/modules/payments/domain/provider-payment';

import { cop } from './pricing.builder';

/** Final result of the E1 transaction as the payment gateway reports it. */
export const aProviderPayment = (overrides: Partial<ProviderPayment> = {}): ProviderPayment => ({
  providerTransactionId: '15113-1790566893-12345',
  reference: 'CKT-20260924-7K3M9Q2PXA',
  status: 'APPROVED',
  amount: cop(50_900),
  statusMessage: null,
  cardBrand: 'VISA',
  cardLastFour: '4242',
  ...overrides,
});

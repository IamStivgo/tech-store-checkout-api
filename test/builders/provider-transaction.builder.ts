/** A transaction body as the payment provider returns it (sandbox, SPIKE-01). */
export const aProviderTransaction = (overrides: Record<string, unknown> = {}) => ({
  id: '15113-1790566893-12345',
  created_at: '2026-09-28T03:21:34.000Z',
  amount_in_cents: 5_090_000,
  reference: 'CKT-20260924-7K3M9Q2PXA',
  customer_email: 'ana.gomez@example.com',
  currency: 'COP',
  payment_method_type: 'CARD',
  payment_method: {
    type: 'CARD',
    extra: { brand: 'VISA', last_four: '4242', card_holder: 'ANA MARIA GOMEZ' },
    installments: 1,
  },
  status: 'APPROVED',
  status_message: null,
  ...overrides,
});

import { unwrap } from '../../../../../test/builders/unwrap';
import { Money } from '../../../../shared/domain/money.vo';
import type { CardPaymentRequest } from '../../domain/card-payment-request';

import { FakePaymentGateway } from './fake-payment-gateway';

const request = (cardToken: string, reference = 'CKT-1'): CardPaymentRequest => ({
  reference,
  amount: unwrap(Money.create(5_090_000)),
  customerEmail: 'ana.gomez@example.com',
  cardToken,
  installments: 1,
  endUserPolicyToken: 'terms',
  personalDataAuthToken: 'data',
  customer: {
    fullName: 'Ana María Gómez',
    phone: '3001234567',
    legalIdType: 'CC',
    legalId: '1020304050',
  },
  shippingAddress: {
    recipientName: 'Ana María Gómez',
    phone: '3001234567',
    addressLine1: 'Calle 100 # 10-20',
    addressLine2: null,
    city: 'Bogotá, D.C.',
    region: 'Bogotá, D.C.',
    postalCode: null,
  },
});

describe('FakePaymentGateway', () => {
  it('issues new acceptance tokens every time', async () => {
    const gateway = new FakePaymentGateway();

    const first = unwrap(await gateway.getAcceptanceTokens());
    const second = unwrap(await gateway.getAcceptanceTokens());

    expect(first.endUserPolicy.token).not.toBe(second.endUserPolicy.token);
    expect(first.personalDataAuth.permalink).toMatch(/^https:\/\//);
  });

  it.each([
    ['tok_fake_approved_1', 'APPROVED', null],
    ['tok_fake_declined_1', 'DECLINED', 'Transacción rechazada por la pasarela de prueba local'],
    ['tok_other', 'ERROR', null],
  ] as const)('creates a pending payment that %s turns into %s', async (token, status, message) => {
    const gateway = new FakePaymentGateway();

    const created = unwrap(await gateway.createCardPayment(request(token)));
    const read = unwrap(await gateway.getPayment(created.providerTransactionId));

    expect(created.status).toBe('PENDING');
    expect(read).toMatchObject({ status, statusMessage: message, reference: 'CKT-1' });
  });

  it('reports the last four digits the web wrote in the token', async () => {
    const gateway = new FakePaymentGateway();

    const declined = unwrap(await gateway.createCardPayment(request('tok_fake_declined_1111_3')));
    const other = unwrap(await gateway.createCardPayment(request('tok_other', 'CKT-9')));

    expect(declined.cardLastFour).toBe('1111');
    expect(other.cardLastFour).toBe('0000');
  });

  it('finds a payment by its reference', async () => {
    const gateway = new FakePaymentGateway();
    await gateway.createCardPayment(request('tok_fake_approved_1', 'CKT-2'));

    expect(unwrap(await gateway.findPaymentByReference('CKT-2'))?.status).toBe('APPROVED');
    expect(unwrap(await gateway.findPaymentByReference('CKT-3'))).toBeNull();
  });

  it('rejects a repeated reference and an unknown payment like the provider', async () => {
    const gateway = new FakePaymentGateway();
    await gateway.createCardPayment(request('tok_fake_approved_1'));

    const repeated = await gateway.createCardPayment(request('tok_fake_approved_2'));
    const unknown = await gateway.getPayment('fake-99');

    expect(repeated.isErr && repeated.error.context).toEqual({ field: 'reference' });
    expect(unknown.isErr && unknown.error.code).toBe('PAYMENT_REJECTED_BY_PROVIDER');
  });
});

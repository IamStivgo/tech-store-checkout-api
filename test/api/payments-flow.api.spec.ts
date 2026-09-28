import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { CUSTOMER_REPOSITORY } from '../../src/modules/customers/infrastructure/customer-repository.token';
import { FakePaymentGateway } from '../../src/modules/payments/infrastructure/fake/fake-payment-gateway';
import { PAYMENT_GATEWAY } from '../../src/modules/payments/infrastructure/payment-gateway.token';
import { PRODUCT_REPOSITORY } from '../../src/modules/products/infrastructure/product-repository.token';
import {
  CHECKOUT_UNIT_OF_WORK,
  TRANSACTION_EVENT_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from '../../src/modules/transactions/infrastructure/transaction-tokens';
import { okAsync } from '../../src/shared/domain/result';
import { IDEMPOTENCY_RECORD_REPOSITORY } from '../../src/shared/infrastructure/idempotency/idempotency-record-repository.token';
import { ID_GENERATOR } from '../../src/shared/infrastructure/system/id-generator.token';
import { SLEEPER } from '../../src/shared/infrastructure/system/sleeper.token';
import { aCustomer } from '../builders/customer.builder';
import { cop } from '../builders/pricing.builder';
import { aProduct } from '../builders/product.builder';
import { aProviderPayment } from '../builders/provider-payment.builder';
import { aTransaction, PRODUCT_ID, TRANSACTION_ID } from '../builders/transaction.builder';
import { FakeIdGenerator } from '../fakes/fake-id-generator';
import { FakeSleeper } from '../fakes/fake-sleeper';
import { InMemoryCheckoutStore } from '../fakes/in-memory-checkout.store';
import { InMemoryCustomerRepository } from '../fakes/in-memory-customer.repository';
import { InMemoryIdempotencyRepository } from '../fakes/in-memory-idempotency.repository';
import { InMemoryProductRepository } from '../fakes/in-memory-product.repository';

import { createTestApp } from './create-test-app';

const PAY_PATH = `/api/v1/transactions/${TRANSACTION_ID}/payment`;
const KEY = '5b0c1a2e-3d4f-4a5b-8c6d-7e8f9a0b1c2d';
const body = (cardToken = 'tok_fake_approved_4242_1') => ({
  cardToken,
  installments: 1,
  acceptanceToken: 'fake.endUserPolicy.1',
  personalDataAuthToken: 'fake.personalDataAuth.1',
});

describe('Transaction payment API', () => {
  let app: NestExpressApplication;
  let store: InMemoryCheckoutStore;
  let gateway: FakePaymentGateway;

  const pay = (payload: object = body(), key = KEY) =>
    request(app.getHttpServer()).post(PAY_PATH).set('Idempotency-Key', key).send(payload);

  beforeEach(async () => {
    store = new InMemoryCheckoutStore().withStock(PRODUCT_ID, 29);
    store.stock.set(PRODUCT_ID, { available: 29, reserved: 1, sold: 0 });
    // Created at the fake clock's time, so its stock reservation is still valid.
    store.transactions.set(
      TRANSACTION_ID,
      aTransaction({ createdAt: new Date('2026-09-24T20:15:00.000Z') }),
    );
    gateway = new FakePaymentGateway();
    app = await createTestApp({
      providers: [
        {
          provide: PRODUCT_REPOSITORY,
          useValue: new InMemoryProductRepository([
            aProduct({ id: PRODUCT_ID, price: cop(39_900) }),
          ]),
        },
        { provide: CUSTOMER_REPOSITORY, useValue: new InMemoryCustomerRepository([aCustomer()]) },
        { provide: TRANSACTION_REPOSITORY, useValue: store },
        { provide: CHECKOUT_UNIT_OF_WORK, useValue: store },
        { provide: TRANSACTION_EVENT_REPOSITORY, useValue: store },
        { provide: IDEMPOTENCY_RECORD_REPOSITORY, useValue: new InMemoryIdempotencyRepository() },
        { provide: ID_GENERATOR, useValue: new FakeIdGenerator(['attempt-1', 'delivery-1']) },
        { provide: PAYMENT_GATEWAY, useValue: gateway },
        { provide: SLEEPER, useValue: new FakeSleeper() },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('keeps the audit timeline of the payment, never with personal data', async () => {
    await pay();

    const response = await request(app.getHttpServer()).get(
      `/api/v1/transactions/${TRANSACTION_ID}/events`,
    );

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const { data, meta } = response.body as {
      data: { type: string; source: string; toStatus?: string }[];
      meta: { count: number };
    };
    expect(data.map(({ type, source }) => `${type}/${source}`)).toEqual([
      'PAYMENT_SUBMITTED/CHECKOUT_API',
      'STATUS_CHANGED/SHORT_POLL',
      'STOCK_CONFIRMED/SHORT_POLL',
      'DELIVERY_ASSIGNED/SHORT_POLL',
    ]);
    expect(data[1]).toMatchObject({ fromStatus: 'PENDING', toStatus: 'APPROVED' });
    expect(meta.count).toBe(4);
    expect(JSON.stringify(data)).not.toMatch(/Ana|3001234567|tok_|fake\.endUserPolicy/);
  });

  it('answers 404 for the timeline of an unknown transaction', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/transactions/00000000-0000-4000-8000-000000000000/events',
    );

    expect(response.status).toBe(404);
  });

  it('answers 200 with the approved transaction and its delivery', async () => {
    const response = await pay();

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      status: 'APPROVED',
      deliveryId: 'delivery-1',
      payment: { status: 'APPROVED', method: 'CARD', cardLastFour: '4242', installments: 1 },
    });
    expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 29, reserved: 0, sold: 1 });
  });

  it('answers 200 DECLINED for a declined card', async () => {
    const response = await pay(body('tok_fake_declined_1111_1'));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'DECLINED', deliveryId: null });
  });

  it('answers 202 with Location and Retry-After while the payment is pending', async () => {
    jest
      .spyOn(gateway, 'getPayment')
      .mockReturnValue(
        okAsync(aProviderPayment({ status: 'PENDING', providerTransactionId: 'fake-1' })),
      );

    const response = await pay();

    expect(response.status).toBe(202);
    expect(response.headers.location).toBe(`/api/v1/transactions/${TRANSACTION_ID}`);
    expect(response.headers['retry-after']).toBe('2');
    expect(response.body).toMatchObject({ status: 'PENDING' });
  });

  it('refuses a second payment of the same transaction', async () => {
    await pay();

    const again = await pay(body(), '9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b');

    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ code: 'TRANSACTION_NOT_PAYABLE' });
  });

  it('validates the card and acceptance tokens', async () => {
    const response = await pay({
      ...body('4242424242424242'),
      installments: 37,
      acceptanceToken: 'x',
    });

    expect(response.status).toBe(400);
    expect(
      (response.body as { errors: { field: string }[] }).errors.map(({ field }) => field),
    ).toEqual(['cardToken', 'installments', 'acceptanceToken']);
  });
});

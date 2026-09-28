import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import {
  FAKE_EVENTS,
  FakePaymentGateway,
} from '../../src/modules/payments/infrastructure/fake/fake-payment-gateway';
import { PAYMENT_GATEWAY } from '../../src/modules/payments/infrastructure/payment-gateway.token';
import {
  CHECKOUT_UNIT_OF_WORK,
  TRANSACTION_REPOSITORY,
} from '../../src/modules/transactions/infrastructure/transaction-tokens';
import { aSignedEvent, anEventTransaction } from '../builders/payment-event.builder';
import { aTransaction, PRODUCT_ID, TRANSACTION_ID } from '../builders/transaction.builder';
import { InMemoryCheckoutStore } from '../fakes/in-memory-checkout.store';

import { createTestApp } from './create-test-app';

const PATH = '/api/v1/webhooks/payment-events';

describe('Payment events webhook', () => {
  let app: NestExpressApplication;
  let store: InMemoryCheckoutStore;

  beforeEach(async () => {
    store = new InMemoryCheckoutStore();
    store.stock.set(PRODUCT_ID, { available: 29, reserved: 1, sold: 0 });
    store.transactions.set(TRANSACTION_ID, aTransaction());
    app = await createTestApp({
      providers: [
        { provide: TRANSACTION_REPOSITORY, useValue: store },
        { provide: CHECKOUT_UNIT_OF_WORK, useValue: store },
        { provide: PAYMENT_GATEWAY, useValue: new FakePaymentGateway() },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('applies a signed final result and acknowledges it', async () => {
    const response = await request(app.getHttpServer())
      .post(PATH)
      .send(aSignedEvent(FAKE_EVENTS.secret));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true, outcome: 'applied' });
    expect(store.transactions.get(TRANSACTION_ID)?.status).toBe('APPROVED');
  });

  it('acknowledges an unknown reference so the provider does not retry it', async () => {
    const response = await request(app.getHttpServer())
      .post(PATH)
      .send(
        aSignedEvent(FAKE_EVENTS.secret, {
          transaction: anEventTransaction({ reference: 'CKT-20260924-UNKNOWN000' }),
        }),
      );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true, outcome: 'ignored' });
  });

  it('answers 401 to a forged event', async () => {
    const response = await request(app.getHttpServer()).post(PATH).send(aSignedEvent('forged'));

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'INVALID_EVENT_SIGNATURE' });
    expect(store.transactions.get(TRANSACTION_ID)?.status).toBe('PENDING');
  });
});

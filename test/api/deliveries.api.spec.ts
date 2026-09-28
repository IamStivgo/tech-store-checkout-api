import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { COVERAGE_REPOSITORY } from '../../src/modules/coverage/infrastructure/coverage-repository.token';
import { Delivery } from '../../src/modules/deliveries/domain/delivery.entity';
import { DELIVERY_REPOSITORY } from '../../src/modules/deliveries/infrastructure/delivery-repository.token';
import { TRANSACTION_REPOSITORY } from '../../src/modules/transactions/infrastructure/transaction-tokens';
import { aZone } from '../builders/pricing.builder';
import { aStoredTransaction, aTransaction, TRANSACTION_ID } from '../builders/transaction.builder';
import { InMemoryCheckoutStore } from '../fakes/in-memory-checkout.store';
import { InMemoryCoverageRepository } from '../fakes/in-memory-coverage.repository';
import { InMemoryDeliveryRepository } from '../fakes/in-memory-delivery.repository';

import { createTestApp } from './create-test-app';

const DELIVERY_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const OTHER_TRANSACTION_ID = '6f1e2d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f';

describe('Deliveries API', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const store = new InMemoryCheckoutStore();
    const approved = aStoredTransaction({ status: 'APPROVED', deliveryId: DELIVERY_ID });
    store.transactions.set(TRANSACTION_ID, approved);
    store.transactions.set(OTHER_TRANSACTION_ID, aTransaction({ id: OTHER_TRANSACTION_ID }));
    const delivery = Delivery.assignFor(approved, DELIVERY_ID, new Date('2026-09-24T20:17:00Z'));
    app = await createTestApp({
      providers: [
        { provide: TRANSACTION_REPOSITORY, useValue: store },
        {
          provide: DELIVERY_REPOSITORY,
          useValue: new InMemoryDeliveryRepository(new Map([[DELIVERY_ID, delivery]])),
        },
        {
          provide: COVERAGE_REPOSITORY,
          useValue: new InMemoryCoverageRepository(
            [{ code: '11001', name: 'Bogotá, D.C.', departmentCode: '11', zone: aZone('LOCAL') }],
            [{ code: '11', name: 'Bogotá, D.C.' }],
          ),
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('shows a delivery with the recipient and the address masked', async () => {
    const response = await request(app.getHttpServer()).get(`/api/v1/deliveries/${DELIVERY_ID}`);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      id: DELIVERY_ID,
      transactionId: TRANSACTION_ID,
      status: 'ASSIGNED',
      product: { name: 'Cable USB-C a USB-C 2 m (100 W)' },
      quantity: 1,
      recipientName: 'Ana M. G.',
      address: {
        addressLine1: 'Calle 100 …',
        cityName: 'Bogotá, D.C.',
        departmentName: 'Bogotá, D.C.',
      },
      zone: 'LOCAL',
      deliveryFee: { amountInCents: 800_000, currency: 'COP' },
    });
  });

  it('finds the delivery of an approved transaction', async () => {
    const response = await request(app.getHttpServer()).get(
      `/api/v1/transactions/${TRANSACTION_ID}/delivery`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: DELIVERY_ID });
  });

  it('answers 404 for a transaction that was not approved and 400 for a malformed id', async () => {
    const pending = await request(app.getHttpServer()).get(
      `/api/v1/transactions/${OTHER_TRANSACTION_ID}/delivery`,
    );
    const malformed = await request(app.getHttpServer()).get('/api/v1/deliveries/not-a-uuid');

    expect(pending.status).toBe(404);
    expect(pending.body).toMatchObject({ code: 'DELIVERY_NOT_FOUND' });
    expect(malformed.status).toBe(400);
  });
});

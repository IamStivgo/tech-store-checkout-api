import type { NestExpressApplication } from '@nestjs/platform-express';
import request, { type Response } from 'supertest';

import { CUSTOMER_REPOSITORY } from '../../src/modules/customers/infrastructure/customer-repository.token';
import { PRODUCT_REPOSITORY } from '../../src/modules/products/infrastructure/product-repository.token';
import {
  CHECKOUT_UNIT_OF_WORK,
  TRANSACTION_REPOSITORY,
} from '../../src/modules/transactions/infrastructure/transaction-tokens';
import type { FieldError } from '../../src/shared/domain/validation-error';
import { IDEMPOTENCY_RECORD_REPOSITORY } from '../../src/shared/infrastructure/idempotency/idempotency-record-repository.token';
import { ID_GENERATOR } from '../../src/shared/infrastructure/system/id-generator.token';
import { aCustomer, CUSTOMER_ID } from '../builders/customer.builder';
import { cop } from '../builders/pricing.builder';
import { aProduct } from '../builders/product.builder';
import { aShippingAddressData, PRODUCT_ID, TRANSACTION_ID } from '../builders/transaction.builder';
import { FakeIdGenerator } from '../fakes/fake-id-generator';
import { InMemoryCheckoutStore } from '../fakes/in-memory-checkout.store';
import { InMemoryCustomerRepository } from '../fakes/in-memory-customer.repository';
import { InMemoryIdempotencyRepository } from '../fakes/in-memory-idempotency.repository';
import { InMemoryProductRepository } from '../fakes/in-memory-product.repository';

import { createTestApp } from './create-test-app';

const TRANSACTIONS_PATH = '/api/v1/transactions';
const KEY = '5b0c1a2e-3d4f-4a5b-8c6d-7e8f9a0b1c2d';
const cents = (pesos: number) => ({ amountInCents: pesos * 100, currency: 'COP' });
const fieldErrorsOf = (response: Response): FieldError[] =>
  (response.body as { errors: FieldError[] }).errors;

const body = (overrides: Record<string, unknown> = {}) => ({
  productId: PRODUCT_ID,
  quantity: 1,
  customerId: CUSTOMER_ID,
  shippingAddress: aShippingAddressData(),
  ...overrides,
});

describe('Transactions API', () => {
  let app: NestExpressApplication;
  let store: InMemoryCheckoutStore;

  const create = (payload: object, key = KEY) =>
    request(app.getHttpServer()).post(TRANSACTIONS_PATH).set('Idempotency-Key', key).send(payload);
  const cancel = (
    contentType = 'application/merge-patch+json',
    payload: object = { status: 'CANCELLED' },
  ) =>
    request(app.getHttpServer())
      .patch(`${TRANSACTIONS_PATH}/${TRANSACTION_ID}`)
      .set('Content-Type', contentType)
      .send(JSON.stringify(payload));

  beforeEach(async () => {
    store = new InMemoryCheckoutStore().withStock(PRODUCT_ID, 30);
    app = await createTestApp({
      providers: [
        {
          provide: PRODUCT_REPOSITORY,
          useValue: new InMemoryProductRepository([
            aProduct({ id: PRODUCT_ID, price: cop(39_900), weightGrams: 150 }),
          ]),
        },
        { provide: CUSTOMER_REPOSITORY, useValue: new InMemoryCustomerRepository([aCustomer()]) },
        { provide: TRANSACTION_REPOSITORY, useValue: store },
        { provide: CHECKOUT_UNIT_OF_WORK, useValue: store },
        { provide: IDEMPOTENCY_RECORD_REPOSITORY, useValue: new InMemoryIdempotencyRepository() },
        { provide: ID_GENERATOR, useValue: new FakeIdGenerator([TRANSACTION_ID]) },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /transactions', () => {
    it('creates the E1 transaction with server-side amounts and reserves the stock', async () => {
      const response = await create(body());

      expect(response.status).toBe(201);
      expect(response.headers.location).toBe(`${TRANSACTIONS_PATH}/${TRANSACTION_ID}`);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toEqual({
        id: TRANSACTION_ID,
        reference: 'CKT-20260924-AAAAAAAAAA',
        status: 'PENDING',
        product: { id: PRODUCT_ID, sku: 'TEC-CBL-USBC', name: 'Cable USB-C a USB-C 2 m (100 W)' },
        quantity: 1,
        amounts: {
          productAmount: cents(39_900),
          serviceFee: cents(3_000),
          deliveryFee: cents(8_000),
          total: cents(50_900),
          vat: { ratePercent: 19, base: cents(33_529), amount: cents(6_371) },
        },
        delivery: { zone: 'LOCAL', estimatedBusinessDays: { min: 1, max: 1 } },
        payment: null,
        deliveryId: null,
        reservationExpiresAt: '2026-09-24T20:30:00.000Z',
        finalizedAt: null,
        createdAt: '2026-09-24T20:15:00.000Z',
        updatedAt: '2026-09-24T20:15:00.000Z',
      });
      expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 29, reserved: 1, sold: 0 });
    });

    it('replays a retried request without reserving twice', async () => {
      await create(body());

      const retry = await create(body());

      expect(retry.status).toBe(201);
      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 29, reserved: 1, sold: 0 });
    });

    it('never accepts amounts from the client', async () => {
      const response = await create(body({ total: cents(1) }));

      expect(response.status).toBe(400);
      expect(fieldErrorsOf(response)).toEqual([
        { field: 'total', message: 'total is not allowed' },
      ]);
    });

    it('reports every invalid field of the request', async () => {
      const response = await create(
        body({
          productId: 'x',
          quantity: 0,
          shippingAddress: { ...aShippingAddressData(), cityCode: '1', unknown: 'y' },
        }),
      );

      expect(response.status).toBe(400);
      expect(fieldErrorsOf(response).map(({ field }) => field)).toEqual([
        'productId',
        'quantity',
        'unknown',
      ]);
    });

    it('validates the delivery address rules', async () => {
      const response = await create(
        body({ shippingAddress: aShippingAddressData({ cityCode: '1' }) }),
      );

      expect(response.status).toBe(400);
      expect(fieldErrorsOf(response)).toEqual([
        { field: 'shippingAddress.cityCode', message: 'cityCode must be a 5-digit DIVIPOLA code' },
      ]);
    });

    it.each([
      [
        'an unknown customer',
        body({ customerId: '8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d' }),
        422,
        'CUSTOMER_NOT_FOUND',
      ],
      ['more units than allowed', body({ quantity: 6 }), 422, 'QUANTITY_LIMIT_EXCEEDED'],
      [
        'a city of another department',
        body({ shippingAddress: aShippingAddressData({ departmentCode: '05' }) }),
        422,
        'CITY_NOT_SUPPORTED',
      ],
      [
        'an unknown product',
        body({ productId: '00000000-0000-4000-8000-000000000000' }),
        404,
        'PRODUCT_NOT_FOUND',
      ],
    ])('rejects %s', async (_case, payload, status, code) => {
      const response = await create(payload);

      expect(response.status).toBe(status);
      expect(response.body).toMatchObject({ code });
    });

    it('answers 409 when another buyer took the last units', async () => {
      store.stock.set(PRODUCT_ID, { available: 0, reserved: 30, sold: 0 });

      const response = await create(body());

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        code: 'INSUFFICIENT_STOCK',
        context: { availableUnits: 0 },
      });
    });
  });

  describe('GET /transactions/{transactionId}', () => {
    it('returns the transaction and never lets it be cached', async () => {
      await create(body());

      const response = await request(app.getHttpServer()).get(
        `${TRANSACTIONS_PATH}/${TRANSACTION_ID}`,
      );

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toMatchObject({ id: TRANSACTION_ID, status: 'PENDING' });
    });

    it.each([
      [TRANSACTION_ID, 404, 'TRANSACTION_NOT_FOUND'],
      ['not-a-uuid', 400, 'VALIDATION_ERROR'],
    ])('answers %s with %i', async (id, status, code) => {
      const response = await request(app.getHttpServer()).get(`${TRANSACTIONS_PATH}/${id}`);

      expect(response.status).toBe(status);
      expect(response.body).toMatchObject({ code });
    });
  });

  describe('PATCH /transactions/{transactionId}', () => {
    it('cancels with JSON Merge Patch and releases the stock', async () => {
      await create(body());

      const response = await cancel();

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'CANCELLED',
        finalizedAt: '2026-09-24T20:15:00.000Z',
      });
      expect(store.stock.get(PRODUCT_ID)).toEqual({ available: 30, reserved: 0, sold: 0 });
    });

    it('also accepts plain JSON and refuses a second cancellation', async () => {
      await create(body());
      await cancel('application/json');

      const again = await cancel('application/json');

      expect(again.status).toBe(409);
      expect(again.body).toMatchObject({
        code: 'TRANSACTION_NOT_CANCELLABLE',
        context: { status: 'CANCELLED' },
      });
    });

    it('only allows the change to CANCELLED', async () => {
      await create(body());

      const response = await cancel('application/merge-patch+json', { status: 'APPROVED' });

      expect(response.status).toBe(400);
      expect(fieldErrorsOf(response)).toEqual([
        { field: 'status', message: 'status can only be changed to CANCELLED' },
      ]);
    });

    it('answers 404 for an unknown transaction', async () => {
      expect((await cancel()).status).toBe(404);
    });
  });
});

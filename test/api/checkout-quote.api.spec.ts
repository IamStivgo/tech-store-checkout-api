import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';

import { PRODUCT_REPOSITORY } from '../../src/modules/products/infrastructure/product-repository.token';
import { cop } from '../builders/pricing.builder';
import { aProduct, aStock } from '../builders/product.builder';
import { InMemoryProductRepository } from '../fakes/in-memory-product.repository';

import { createTestApp } from './create-test-app';

// Seed catalog items used by the worked examples of the business rules (§5).
const CATALOG = {
  cable: aProduct({
    id: '7d094266-0b4e-4789-9522-96e1cd7ffa60',
    price: cop(39_900),
    weightGrams: 150,
  }),
  charger: aProduct({
    id: '2f6a0b1c-8d3e-4a5f-9b7c-1e2d3f4a5b6c',
    price: cop(129_900),
    weightGrams: 200,
  }),
  stand: aProduct({
    id: '9c8b7a6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    price: cop(99_900),
    weightGrams: 1_100,
  }),
  hub: aProduct({
    id: '4e5f6a7b-8c9d-4e0f-a1b2-c3d4e5f6a7b8',
    price: cop(149_900),
    weightGrams: 120,
  }),
  monitorArm: aProduct({
    id: '0b9a1c47-5e8d-4f2a-b3c6-7d8e9f0a1b2c',
    price: cop(139_900),
    weightGrams: 3_200,
  }),
  headphones: aProduct({
    id: '6a7b8c9d-0e1f-4a2b-9c3d-4e5f6a7b8c9d',
    price: cop(289_900),
    weightGrams: 350,
  }),
  powerBank: aProduct({
    id: '5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f8a',
    price: cop(139_900),
    weightGrams: 450,
    stock: aStock({ available: 3 }),
  }),
};
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

const cents = (pesos: number) => ({ amountInCents: pesos * 100, currency: 'COP' });

describe('Checkout quote API', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp({
      providers: [
        {
          provide: PRODUCT_REPOSITORY,
          useValue: new InMemoryProductRepository(Object.values(CATALOG)),
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const quote = (query: Record<string, string | number>) =>
    request(app.getHttpServer()).get('/api/v1/checkout/quote').query(query);

  it('returns the example E2 breakdown with the contract shape', async () => {
    const response = await quote({
      productId: CATALOG.monitorArm.id,
      quantity: 1,
      cityCode: '05001',
    });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      productId: CATALOG.monitorArm.id,
      quantity: 1,
      unitPrice: cents(139_900),
      productAmount: cents(139_900),
      serviceFee: cents(3_000),
      deliveryFee: cents(17_500),
      total: cents(160_400),
      delivery: {
        zone: 'NATIONAL_MAIN',
        billableWeightKg: 4,
        freeShippingApplied: false,
        freeShippingThreshold: cents(150_000),
        estimatedBusinessDays: { min: 2, max: 3 },
      },
      calculatedAt: '2026-09-24T20:15:00.000Z',
    });
  });

  it.each([
    ['E1 cable to Bogotá', CATALOG.cable, 1, '11001', 'LOCAL', 8_000, 50_900],
    ['E4 three stands to Leticia', CATALOG.stand, 3, '91001', 'SPECIAL_ROUTE', 56_000, 358_700],
    [
      'E5 hub to Girardot (department default)',
      CATALOG.hub,
      1,
      '25307',
      'NATIONAL_REGIONAL',
      25_000,
      177_900,
    ],
    ['E6 charger to Soacha', CATALOG.charger, 1, '25754', 'METRO', 12_000, 144_900],
    ['E7 headphones to Bogotá', CATALOG.headphones, 1, '11001', 'LOCAL', 0, 292_900],
  ])('%s', async (_example, product, quantity, cityCode, zone, deliveryFee, total) => {
    const response = await quote({ productId: product.id, quantity, cityCode });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      deliveryFee: cents(deliveryFee),
      total: cents(total),
      delivery: { zone, freeShippingApplied: deliveryFee === 0 },
    });
  });

  it('answers 400 with every invalid field', async () => {
    const response = await quote({ productId: 'abc', quantity: 0, cityCode: '5001' });

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(response.body).toMatchObject({
      errors: expect.arrayContaining([
        expect.objectContaining({ field: 'productId' }),
        expect.objectContaining({ field: 'quantity' }),
        expect.objectContaining({ field: 'cityCode' }),
      ]) as unknown,
    });
  });

  it.each([['1.5'], ['dos'], ['']])('rejects the quantity %p', async (quantity) => {
    const response = await quote({ productId: CATALOG.cable.id, quantity, cityCode: '11001' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      errors: [expect.objectContaining({ field: 'quantity' })] as unknown,
    });
  });

  it('answers 404 for an unknown product', async () => {
    const response = await quote({ productId: UNKNOWN_ID, quantity: 1, cityCode: '11001' });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });

  it('answers 422 above the units the product allows, with the limit', async () => {
    const response = await quote({
      productId: CATALOG.powerBank.id,
      quantity: 4,
      cityCode: '11001',
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      code: 'QUANTITY_LIMIT_EXCEEDED',
      context: { maxUnitsPerOrder: 3 },
    });
  });

  it('answers 422 for a city outside the coverage', async () => {
    const response = await quote({ productId: CATALOG.cable.id, quantity: 1, cityCode: '99999' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: 'CITY_NOT_SUPPORTED' });
  });
});

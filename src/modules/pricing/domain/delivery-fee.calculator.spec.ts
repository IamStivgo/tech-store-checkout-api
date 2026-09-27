import { aPricingPolicy, aZone, cop } from '../../../../test/builders/pricing.builder';
import { unwrap } from '../../../../test/builders/unwrap';

import { DeliveryFeeCalculator } from './delivery-fee.calculator';

describe('DeliveryFeeCalculator', () => {
  const calculator = new DeliveryFeeCalculator(aPricingPolicy());

  it.each([
    ['1 g', 1, 1, 1],
    ['exactly 3 kg', 3_000, 1, 3],
    ['3.001 kg', 3_001, 1, 4],
    ['several units', 1_100, 3, 4],
  ])('rounds %s up to whole billable kilograms', (_case, unitWeightGrams, quantity, kg) => {
    const charge = unwrap(
      calculator.calculate({
        zone: aZone('LOCAL'),
        unitWeightGrams,
        quantity,
        productAmount: cop(10_000),
      }),
    );

    expect(charge.billableWeightKg).toBe(kg);
  });

  it('charges only the base rate up to the included weight', () => {
    const charge = unwrap(
      calculator.calculate({
        zone: aZone('NATIONAL_MAIN'),
        unitWeightGrams: 3_000,
        quantity: 1,
        productAmount: cop(10_000),
      }),
    );

    expect(charge.fee).toEqual(cop(15_000));
  });

  it('adds the zone rate for each extra kilogram', () => {
    const charge = unwrap(
      calculator.calculate({
        zone: aZone('NATIONAL_MAIN'),
        unitWeightGrams: 3_001,
        quantity: 1,
        productAmount: cop(10_000),
      }),
    );

    expect(charge.fee).toEqual(cop(17_500));
  });

  it('ships for free when the product amount equals the threshold', () => {
    const charge = unwrap(
      calculator.calculate({
        zone: aZone('NATIONAL_REGIONAL'),
        unitWeightGrams: 5_000,
        quantity: 1,
        productAmount: cop(150_000),
      }),
    );

    expect(charge).toMatchObject({ fee: cop(0), freeShippingApplied: true, billableWeightKg: 5 });
  });

  it('charges shipping one peso below the threshold', () => {
    const charge = unwrap(
      calculator.calculate({
        zone: aZone('LOCAL'),
        unitWeightGrams: 120,
        quantity: 1,
        productAmount: cop(149_999),
      }),
    );

    expect(charge).toMatchObject({ fee: cop(8_000), freeShippingApplied: false });
  });

  it('never ships special routes for free', () => {
    const charge = unwrap(
      calculator.calculate({
        zone: aZone('SPECIAL_ROUTE'),
        unitWeightGrams: 100,
        quantity: 1,
        productAmount: cop(500_000),
      }),
    );

    expect(charge).toMatchObject({ fee: cop(50_000), freeShippingApplied: false });
  });
});

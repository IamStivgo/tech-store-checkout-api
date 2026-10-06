import { aPricingPolicy, aZone, cop } from '../../../../test/builders/pricing.builder';
import { unwrap } from '../../../../test/builders/unwrap';
import type { ZoneCode } from '../../coverage/domain/zone-code';

import { CheckoutPricingService } from './checkout-pricing.service';
import { DeliveryFeeCalculator } from './delivery-fee.calculator';

const policy = aPricingPolicy();
const pricing = new CheckoutPricingService(policy, new DeliveryFeeCalculator(policy));

describe('CheckoutPricingService', () => {
  // Worked examples of the business rules (§5), in pesos: price, weight (g), quantity, zone,
  // product amount, billable kg, delivery fee, total.
  it.each<[string, number, number, number, ZoneCode, number, number, number, number]>([
    ['E1 cable to Bogotá', 39_900, 150, 1, 'LOCAL', 39_900, 1, 8_000, 50_900],
    ['E2 monitor arm to Medellín', 139_900, 3_200, 1, 'NATIONAL_MAIN', 139_900, 4, 17_500, 160_400],
    ['E3 two mice to Cali', 119_900, 150, 2, 'NATIONAL_MAIN', 239_800, 1, 0, 242_800],
    ['E4 three stands to Leticia', 99_900, 1_100, 3, 'SPECIAL_ROUTE', 299_700, 4, 56_000, 358_700],
    ['E5 hub to Girardot', 149_900, 120, 1, 'NATIONAL_REGIONAL', 149_900, 1, 25_000, 177_900],
    ['E6 charger to Soacha', 129_900, 200, 1, 'METRO', 129_900, 1, 12_000, 144_900],
    ['E7 headphones to Bogotá', 289_900, 350, 1, 'LOCAL', 289_900, 1, 0, 292_900],
  ])(
    '%s',
    (_example, price, weightGrams, quantity, zone, productAmount, kg, deliveryFee, total) => {
      const breakdown = unwrap(
        pricing.quote({ price: cop(price), weightGrams }, quantity, aZone(zone)),
      );

      expect(breakdown).toMatchObject({
        unitPrice: cop(price),
        productAmount: cop(productAmount),
        serviceFee: cop(3_000),
        deliveryFee: cop(deliveryFee),
        total: cop(total),
        delivery: { zone, billableWeightKg: kg, freeShippingApplied: deliveryFee === 0 },
      });
    },
  );

  // VAT is extracted from the product amount only: fees carry none and the total is unchanged.
  it.each<[string, number, number, number, number, number, number]>([
    ['E1 cable to Bogotá', 39_900, 1, 33_529, 6_371, 8_000, 50_900],
    ['one mouse to Bogotá', 119_900, 1, 100_756, 19_144, 8_000, 130_900],
    ['E3 two mice to Cali (free shipping)', 119_900, 2, 201_513, 38_287, 0, 242_800],
    ['one hub to Bogotá', 149_900, 1, 125_966, 23_934, 8_000, 160_900],
  ])('%s: VAT only on the products', (_example, price, quantity, base, vat, deliveryFee, total) => {
    const zone = deliveryFee === 0 ? 'NATIONAL_MAIN' : 'LOCAL';
    const breakdown = unwrap(
      pricing.quote({ price: cop(price), weightGrams: 150 }, quantity, aZone(zone)),
    );

    expect(breakdown.vat.toJSON()).toEqual({
      ratePercent: 19,
      base: cop(base).toJSON(),
      amount: cop(vat).toJSON(),
    });
    expect(breakdown.vat.gross()).toEqual(breakdown.productAmount);
    expect(breakdown.serviceFee).toEqual(cop(3_000));
    expect(breakdown.deliveryFee).toEqual(cop(deliveryFee));
    expect(breakdown.total).toEqual(cop(total));
  });

  it('uses the VAT rate of the policy', () => {
    const noVatPolicy = aPricingPolicy({ vatRatePercent: 0 });
    const noVat = new CheckoutPricingService(noVatPolicy, new DeliveryFeeCalculator(noVatPolicy));

    const breakdown = unwrap(
      noVat.quote({ price: cop(39_900), weightGrams: 150 }, 1, aZone('LOCAL')),
    );

    expect(breakdown.vat.amount).toEqual(cop(0));
    expect(breakdown.total).toEqual(cop(50_900));
  });

  it('reports the threshold and the estimated delivery days of the zone', () => {
    const breakdown = unwrap(
      pricing.quote({ price: cop(39_900), weightGrams: 150 }, 1, aZone('NATIONAL_REGIONAL')),
    );

    expect(breakdown.delivery).toMatchObject({
      freeShippingThreshold: cop(150_000),
      estimatedBusinessDays: { min: 3, max: 5 },
    });
  });

  it.each([0, -1, 1.5])('rejects %p units', (quantity) => {
    const field = pricing
      .quote({ price: cop(39_900), weightGrams: 150 }, quantity, aZone('LOCAL'))
      .match({ ok: () => undefined, err: (error) => error.fieldErrors[0]?.field });

    expect(field).toBe('quantity');
  });
});

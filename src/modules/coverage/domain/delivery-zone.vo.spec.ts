import { unwrap } from '../../../../test/builders/unwrap';
import { Money } from '../../../shared/domain/money.vo';

import { DeliveryZone, type BusinessDaysRange } from './delivery-zone.vo';

const zoneWith = (estimatedBusinessDays: BusinessDaysRange) =>
  DeliveryZone.create({
    code: 'METRO',
    baseRate: unwrap(Money.create(1_200_000)),
    extraKgRate: unwrap(Money.create(200_000)),
    freeShippingEligible: true,
    estimatedBusinessDays,
  });

describe('DeliveryZone', () => {
  it('keeps its rates, free shipping eligibility and delivery estimate', () => {
    const zone = unwrap(zoneWith({ min: 1, max: 2 }));

    expect(zone).toMatchObject({
      code: 'METRO',
      freeShippingEligible: true,
      estimatedBusinessDays: { min: 1, max: 2 },
    });
    expect(zone.baseRate.amountInCents).toBe(1_200_000);
    expect(zone.extraKgRate.amountInCents).toBe(200_000);
  });

  it.each([
    ['a minimum above the maximum', { min: 3, max: 2 }],
    ['fractional days', { min: 1.5, max: 2 }],
    ['negative days', { min: -1, max: 2 }],
  ])('rejects %s', (_case, estimatedBusinessDays) => {
    const result = zoneWith(estimatedBusinessDays);

    expect(result.isErr && result.error.fieldErrors[0]?.field).toBe('estimatedBusinessDays');
  });
});

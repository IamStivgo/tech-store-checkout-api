import { DeliveryZone } from '../../src/modules/coverage/domain/delivery-zone.vo';
import type { ZoneCode } from '../../src/modules/coverage/domain/zone-code';
import type { PricingPolicy } from '../../src/modules/pricing/domain/pricing-policy';
import { Money } from '../../src/shared/domain/money.vo';

import { unwrap } from './unwrap';

export const cop = (pesos: number): Money => unwrap(Money.create(pesos * 100));

/** Zone table of the business rules (§2.2), in pesos. */
const ZONE_TABLE: Readonly<Record<ZoneCode, readonly [number, number, boolean, number, number]>> = {
  LOCAL: [8_000, 1_500, true, 1, 1],
  METRO: [12_000, 2_000, true, 1, 2],
  NATIONAL_MAIN: [15_000, 2_500, true, 2, 3],
  NATIONAL_REGIONAL: [25_000, 3_500, true, 3, 5],
  SPECIAL_ROUTE: [50_000, 6_000, false, 5, 10],
};

export const aZone = (code: ZoneCode): DeliveryZone => {
  const [baseRate, extraKgRate, freeShippingEligible, min, max] = ZONE_TABLE[code];
  return unwrap(
    DeliveryZone.create({
      code,
      baseRate: cop(baseRate),
      extraKgRate: cop(extraKgRate),
      freeShippingEligible,
      estimatedBusinessDays: { min, max },
    }),
  );
};

export const aPricingPolicy = (overrides: Partial<PricingPolicy> = {}): PricingPolicy => ({
  serviceFee: cop(3_000),
  freeShippingThreshold: cop(150_000),
  includedWeightKg: 3,
  vatRatePercent: 19,
  ...overrides,
});

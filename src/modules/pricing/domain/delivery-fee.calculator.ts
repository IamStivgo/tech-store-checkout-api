import { Money } from '../../../shared/domain/money.vo';
import { ok, type Result } from '../../../shared/domain/result';
import type { ValidationError } from '../../../shared/domain/validation-error';
import type { DeliveryZone } from '../../coverage/domain/delivery-zone.vo';

import type { PricingPolicy } from './pricing-policy';

const GRAMS_PER_KG = 1000;

export interface DeliveryFeeInput {
  readonly zone: DeliveryZone;
  readonly unitWeightGrams: number;
  readonly quantity: number;
  readonly productAmount: Money;
}

export interface DeliveryCharge {
  readonly fee: Money;
  /** Total weight rounded up to whole kilograms. */
  readonly billableWeightKg: number;
  readonly freeShippingApplied: boolean;
}

/** Delivery fee by destination zone and weight, with free shipping above the threshold (BR-03..BR-05). */
export class DeliveryFeeCalculator {
  constructor(private readonly policy: PricingPolicy) {}

  calculate({
    zone,
    unitWeightGrams,
    quantity,
    productAmount,
  }: DeliveryFeeInput): Result<DeliveryCharge, ValidationError> {
    const billableWeightKg = Math.ceil((unitWeightGrams * quantity) / GRAMS_PER_KG);
    const freeShippingApplied =
      zone.freeShippingEligible &&
      productAmount.amountInCents >= this.policy.freeShippingThreshold.amountInCents;

    if (freeShippingApplied) {
      return ok({ fee: Money.zero(), billableWeightKg, freeShippingApplied });
    }

    const extraKg = Math.max(0, billableWeightKg - this.policy.includedWeightKg);
    return zone.extraKgRate.multiply(extraKg).map((extraFee) => ({
      fee: zone.baseRate.add(extraFee),
      billableWeightKg,
      freeShippingApplied,
    }));
  }
}

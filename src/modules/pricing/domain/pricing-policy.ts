import type { Money } from '../../../shared/domain/money.vo';

export interface PricingPolicy {
  /** Fixed fee added to every order, regardless of the payment method (BR-02). */
  readonly serviceFee: Money;
  /** Orders whose product amount reaches this value ship for free in eligible zones (BR-05). */
  readonly freeShippingThreshold: Money;
  /** Weight covered by a zone's base rate; each extra kilogram is charged (BR-04). */
  readonly includedWeightKg: number;
}

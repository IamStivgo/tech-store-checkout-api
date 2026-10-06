import type { Money } from '../../../shared/domain/money.vo';
import { err, type Result } from '../../../shared/domain/result';
import { ValidationError } from '../../../shared/domain/validation-error';
import type { BusinessDaysRange, DeliveryZone } from '../../coverage/domain/delivery-zone.vo';
import type { ZoneCode } from '../../coverage/domain/zone-code';

import type { DeliveryFeeCalculator } from './delivery-fee.calculator';
import { IncludedVat } from './included-vat.vo';
import type { PricingPolicy } from './pricing-policy';

/** What pricing needs from a product: its current price and shipping weight. */
export interface PricedItem {
  readonly price: Money;
  readonly weightGrams: number;
}

export interface PriceBreakdown {
  readonly unitPrice: Money;
  readonly productAmount: Money;
  /** VAT included in productAmount; the fees carry none. */
  readonly vat: IncludedVat;
  readonly serviceFee: Money;
  readonly deliveryFee: Money;
  readonly total: Money;
  readonly delivery: {
    readonly zone: ZoneCode;
    readonly billableWeightKg: number;
    readonly freeShippingApplied: boolean;
    readonly freeShippingThreshold: Money;
    readonly estimatedBusinessDays: BusinessDaysRange;
  };
}

/**
 * total = product amount + service fee + delivery fee, always computed on the server in
 * integer cents (BR-01, BR-12). The VAT is extracted from the product amount, not added (BR-16).
 */
export class CheckoutPricingService {
  constructor(
    private readonly policy: PricingPolicy,
    private readonly deliveryFees: DeliveryFeeCalculator,
  ) {}

  quote(
    item: PricedItem,
    quantity: number,
    zone: DeliveryZone,
  ): Result<PriceBreakdown, ValidationError> {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      return err(ValidationError.forField('quantity', 'quantity must be a positive integer'));
    }

    return item.price.multiply(quantity).andThen((productAmount) =>
      IncludedVat.fromGross(productAmount, this.policy.vatRatePercent).andThen((vat) =>
        this.deliveryFees
          .calculate({ zone, unitWeightGrams: item.weightGrams, quantity, productAmount })
          .map((delivery) => ({
            unitPrice: item.price,
            productAmount,
            vat,
            serviceFee: this.policy.serviceFee,
            deliveryFee: delivery.fee,
            total: productAmount.add(this.policy.serviceFee).add(delivery.fee),
            delivery: {
              zone: zone.code,
              billableWeightKg: delivery.billableWeightKg,
              freeShippingApplied: delivery.freeShippingApplied,
              freeShippingThreshold: this.policy.freeShippingThreshold,
              estimatedBusinessDays: zone.estimatedBusinessDays,
            },
          })),
      ),
    );
  }
}

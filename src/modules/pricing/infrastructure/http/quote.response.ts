import type { MoneyJson } from '../../../../shared/domain/money.vo';
import type { BusinessDaysRange } from '../../../coverage/domain/delivery-zone.vo';
import type { ZoneCode } from '../../../coverage/domain/zone-code';
import type { CheckoutQuote } from '../../application/quote-checkout.use-case';
import type { IncludedVatJson } from '../../domain/included-vat.vo';

export interface DeliveryQuoteResponse {
  readonly zone: ZoneCode;
  readonly billableWeightKg: number;
  readonly freeShippingApplied: boolean;
  readonly freeShippingThreshold: MoneyJson;
  readonly estimatedBusinessDays: BusinessDaysRange;
}

export interface QuoteResponse {
  readonly productId: string;
  readonly quantity: number;
  readonly unitPrice: MoneyJson;
  readonly productAmount: MoneyJson;
  readonly vat: IncludedVatJson;
  readonly serviceFee: MoneyJson;
  readonly deliveryFee: MoneyJson;
  readonly total: MoneyJson;
  readonly delivery: DeliveryQuoteResponse;
  readonly calculatedAt: string;
}

export const toQuoteResponse = (quote: CheckoutQuote): QuoteResponse => ({
  productId: quote.productId,
  quantity: quote.quantity,
  unitPrice: quote.unitPrice.toJSON(),
  productAmount: quote.productAmount.toJSON(),
  vat: quote.vat.toJSON(),
  serviceFee: quote.serviceFee.toJSON(),
  deliveryFee: quote.deliveryFee.toJSON(),
  total: quote.total.toJSON(),
  delivery: {
    zone: quote.delivery.zone,
    billableWeightKg: quote.delivery.billableWeightKg,
    freeShippingApplied: quote.delivery.freeShippingApplied,
    freeShippingThreshold: quote.delivery.freeShippingThreshold.toJSON(),
    estimatedBusinessDays: quote.delivery.estimatedBusinessDays,
  },
  calculatedAt: quote.calculatedAt.toISOString(),
});

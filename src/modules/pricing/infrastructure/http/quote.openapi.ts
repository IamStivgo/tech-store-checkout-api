import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { MoneySchema } from '../../../../shared/infrastructure/http/openapi/common.openapi';
import type { BusinessDaysRange } from '../../../coverage/domain/delivery-zone.vo';
import { ZONE_CODES, type ZoneCode } from '../../../coverage/domain/zone-code';

import type { DeliveryQuoteResponse, QuoteResponse } from './quote.response';

@ApiSchema({ name: 'BusinessDaysRange' })
export class BusinessDaysRangeSchema implements BusinessDaysRange {
  @ApiProperty({ example: 2 })
  readonly min!: number;

  @ApiProperty({ example: 3 })
  readonly max!: number;
}

@ApiSchema({ name: 'DeliveryQuote' })
export class DeliveryQuoteSchema implements DeliveryQuoteResponse {
  @ApiProperty({ enum: ZONE_CODES, example: 'NATIONAL_MAIN' })
  readonly zone!: ZoneCode;

  @ApiProperty({ description: 'Total weight rounded up to whole kilograms.', example: 4 })
  readonly billableWeightKg!: number;

  @ApiProperty({ example: false })
  readonly freeShippingApplied!: boolean;

  @ApiProperty({ type: MoneySchema, description: 'Product amount from which shipping is free.' })
  readonly freeShippingThreshold!: MoneySchema;

  @ApiProperty({
    type: BusinessDaysRangeSchema,
    description: 'Estimated delivery, in business days.',
  })
  readonly estimatedBusinessDays!: BusinessDaysRangeSchema;
}

@ApiSchema({ name: 'CheckoutQuote' })
export class QuoteSchema implements QuoteResponse {
  @ApiProperty({ format: 'uuid' })
  readonly productId!: string;

  @ApiProperty({ example: 1 })
  readonly quantity!: number;

  @ApiProperty({ type: MoneySchema })
  readonly unitPrice!: MoneySchema;

  @ApiProperty({ type: MoneySchema, description: 'unitPrice × quantity.' })
  readonly productAmount!: MoneySchema;

  @ApiProperty({ type: MoneySchema, description: 'Fixed fee per order.' })
  readonly serviceFee!: MoneySchema;

  @ApiProperty({ type: MoneySchema, description: 'Zero when free shipping applies.' })
  readonly deliveryFee!: MoneySchema;

  @ApiProperty({ type: MoneySchema, description: 'productAmount + serviceFee + deliveryFee.' })
  readonly total!: MoneySchema;

  @ApiProperty({ type: DeliveryQuoteSchema })
  readonly delivery!: DeliveryQuoteSchema;

  @ApiProperty({ format: 'date-time' })
  readonly calculatedAt!: string;
}

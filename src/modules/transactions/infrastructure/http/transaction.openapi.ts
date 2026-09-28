import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { MoneySchema } from '../../../../shared/infrastructure/http/openapi/common.openapi';
import type { BusinessDaysRange } from '../../../coverage/domain/delivery-zone.vo';
import { ZONE_CODES, type ZoneCode } from '../../../coverage/domain/zone-code';
import { BusinessDaysRangeSchema } from '../../../pricing/infrastructure/http/quote.openapi';
import { TRANSACTION_STATUSES, type TransactionStatus } from '../../domain/transaction-status';

import type { TransactionPaymentResponse, TransactionResponse } from './transaction.response';

@ApiSchema({ name: 'ShippingAddressRequest' })
export class ShippingAddressRequestSchema {
  @ApiProperty({ description: 'Same rules as the customer full name.', example: 'Ana María Gómez' })
  readonly recipientName!: string;

  @ApiProperty({
    description: 'Colombian mobile or landline; +57 accepted.',
    example: '3001234567',
  })
  readonly phone!: string;

  @ApiProperty({
    description: '5-120 letters, digits, spaces or # - . , °',
    example: 'Calle 100 # 10-20',
  })
  readonly addressLine1!: string;

  @ApiPropertyOptional({ maxLength: 120, example: 'Apto 501, Torre 2' })
  readonly addressLine2?: string;

  @ApiProperty({ description: 'Two-digit DIVIPOLA department code.', example: '11' })
  readonly departmentCode!: string;

  @ApiProperty({
    description: 'Five-digit DIVIPOLA municipality code of that department.',
    example: '11001',
  })
  readonly cityCode!: string;

  @ApiPropertyOptional({ description: 'Six digits.', example: '110111' })
  readonly postalCode?: string;

  @ApiPropertyOptional({ maxLength: 200, example: 'Portería 24 horas' })
  readonly notes?: string;
}

@ApiSchema({ name: 'CreateTransactionRequest' })
export class CreateTransactionRequestSchema {
  @ApiProperty({ format: 'uuid' })
  readonly productId!: string;

  @ApiProperty({ minimum: 1, example: 1, description: 'Up to min(stock, units per order).' })
  readonly quantity!: number;

  @ApiProperty({ format: 'uuid' })
  readonly customerId!: string;

  @ApiProperty({ type: ShippingAddressRequestSchema })
  readonly shippingAddress!: ShippingAddressRequestSchema;
}

@ApiSchema({ name: 'PayTransactionRequest' })
export class PayTransactionRequestSchema {
  @ApiProperty({
    description: 'Card token from the payment provider (tokenized in the browser).',
    example: 'tok_test_4242',
  })
  readonly cardToken!: string;

  @ApiProperty({ minimum: 1, maximum: 36, example: 1 })
  readonly installments!: number;

  @ApiProperty({
    description: 'Single-use token of the accepted terms (GET /payments/acceptance-tokens).',
  })
  readonly acceptanceToken!: string;

  @ApiProperty({ description: 'Single-use token of the accepted personal data processing.' })
  readonly personalDataAuthToken!: string;
}

@ApiSchema({ name: 'UpdateTransactionRequest' })
export class UpdateTransactionRequestSchema {
  @ApiProperty({ enum: ['CANCELLED'], description: 'The only change allowed.' })
  readonly status!: 'CANCELLED';
}

@ApiSchema({ name: 'TransactionProduct' })
export class TransactionProductSchema {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'TEC-CBL-USBC' })
  readonly sku!: string;

  @ApiProperty({ example: 'Cable USB-C a USB-C 2 m (100 W)' })
  readonly name!: string;
}

@ApiSchema({ name: 'TransactionAmounts' })
export class TransactionAmountsSchema {
  @ApiProperty({ type: MoneySchema })
  readonly productAmount!: MoneySchema;

  @ApiProperty({ type: MoneySchema })
  readonly serviceFee!: MoneySchema;

  @ApiProperty({ type: MoneySchema })
  readonly deliveryFee!: MoneySchema;

  @ApiProperty({ type: MoneySchema })
  readonly total!: MoneySchema;
}

@ApiSchema({ name: 'TransactionDelivery' })
export class TransactionDeliverySchema {
  @ApiProperty({ enum: ZONE_CODES, example: 'LOCAL' })
  readonly zone!: ZoneCode;

  @ApiProperty({ type: BusinessDaysRangeSchema })
  readonly estimatedBusinessDays!: BusinessDaysRange;
}

@ApiSchema({ name: 'TransactionPayment' })
export class TransactionPaymentSchema implements TransactionPaymentResponse {
  @ApiProperty({ type: String, nullable: true, example: 'APPROVED' })
  readonly status!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  readonly statusMessage!: string | null;

  @ApiProperty({ enum: ['CARD'] })
  readonly method!: 'CARD';

  @ApiProperty({ type: String, nullable: true, example: 'VISA' })
  readonly cardBrand!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '4242' })
  readonly cardLastFour!: string | null;

  @ApiProperty({ example: 1 })
  readonly installments!: number;

  @ApiProperty({ format: 'date-time' })
  readonly submittedAt!: string;
}

@ApiSchema({ name: 'Transaction' })
export class TransactionSchema implements TransactionResponse {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'CKT-20260924-7K3M9Q2PXA' })
  readonly reference!: string;

  @ApiProperty({ enum: TRANSACTION_STATUSES, example: 'PENDING' })
  readonly status!: TransactionStatus;

  @ApiProperty({ type: TransactionProductSchema })
  readonly product!: TransactionProductSchema;

  @ApiProperty({ example: 1 })
  readonly quantity!: number;

  @ApiProperty({ type: TransactionAmountsSchema })
  readonly amounts!: TransactionAmountsSchema;

  @ApiProperty({ type: TransactionDeliverySchema })
  readonly delivery!: TransactionDeliverySchema;

  @ApiProperty({ type: TransactionPaymentSchema, nullable: true, description: 'Null until paid.' })
  readonly payment!: TransactionPaymentSchema | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Once approved.' })
  readonly deliveryId!: string | null;

  @ApiProperty({ format: 'date-time', description: 'Stock reserved until then if not paid.' })
  readonly reservationExpiresAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readonly finalizedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  readonly updatedAt!: string;
}

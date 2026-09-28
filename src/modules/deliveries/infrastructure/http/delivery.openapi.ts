import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { MoneySchema } from '../../../../shared/infrastructure/http/openapi/common.openapi';
import { ZONE_CODES, type ZoneCode } from '../../../coverage/domain/zone-code';
import type { DeliveryStatus } from '../../domain/delivery.entity';

import type { DeliveryResponse } from './delivery.response';

@ApiSchema({ name: 'DeliveryProduct' })
class DeliveryProductSchema {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'Cable USB-C a USB-C 2 m (100 W)' })
  readonly name!: string;
}

@ApiSchema({ name: 'DeliveryAddress' })
class DeliveryAddressSchema {
  @ApiProperty({ description: 'First 10 characters only.', example: 'Calle 100 …' })
  readonly addressLine1!: string;

  @ApiProperty({ example: 'Bogotá, D.C.' })
  readonly cityName!: string;

  @ApiProperty({ example: 'Bogotá, D.C.' })
  readonly departmentName!: string;
}

@ApiSchema({ name: 'Delivery' })
export class DeliverySchema implements DeliveryResponse {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ format: 'uuid' })
  readonly transactionId!: string;

  @ApiProperty({ enum: ['ASSIGNED'], example: 'ASSIGNED' })
  readonly status!: DeliveryStatus;

  @ApiProperty({ type: DeliveryProductSchema })
  readonly product!: DeliveryProductSchema;

  @ApiProperty({ example: 1 })
  readonly quantity!: number;

  @ApiProperty({ description: 'Masked: first name and initials.', example: 'Ana M. G.' })
  readonly recipientName!: string;

  @ApiProperty({ type: DeliveryAddressSchema })
  readonly address!: DeliveryAddressSchema;

  @ApiProperty({ enum: ZONE_CODES, example: 'LOCAL' })
  readonly zone!: ZoneCode;

  @ApiProperty({ type: MoneySchema })
  readonly deliveryFee!: MoneySchema;

  @ApiProperty({ format: 'date', example: '2026-09-25' })
  readonly estimatedDeliveryDate!: string;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: string;
}

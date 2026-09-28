import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ListMetaSchema } from '../../../../shared/infrastructure/http/openapi/common.openapi';
import {
  TRANSACTION_EVENT_SOURCES,
  TRANSACTION_EVENT_TYPES,
  type TransactionEventSource,
  type TransactionEventType,
} from '../../domain/transaction-event';
import { TRANSACTION_STATUSES, type TransactionStatus } from '../../domain/transaction-status';

import type {
  TransactionEventListResponse,
  TransactionEventResponse,
} from './transaction-event.response';

@ApiSchema({ name: 'TransactionEvent' })
export class TransactionEventSchema implements TransactionEventResponse {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ enum: TRANSACTION_EVENT_TYPES, example: 'STATUS_CHANGED' })
  readonly type!: TransactionEventType;

  @ApiProperty({
    enum: TRANSACTION_EVENT_SOURCES,
    example: 'SHORT_POLL',
    description:
      'Path that caused the event: the checkout, the payment polling, the status sync, the webhook or the reconciliation.',
  })
  readonly source!: TransactionEventSource;

  @ApiPropertyOptional({ enum: TRANSACTION_STATUSES, example: 'PENDING' })
  readonly fromStatus?: TransactionStatus;

  @ApiPropertyOptional({ enum: TRANSACTION_STATUSES, example: 'APPROVED' })
  readonly toStatus?: TransactionStatus;

  @ApiPropertyOptional({ example: '15113-1790566893-12345' })
  readonly providerTransactionId?: string;

  @ApiPropertyOptional({ example: 'APPROVED' })
  readonly providerStatus?: string;

  @ApiPropertyOptional({ example: 5_090_000 })
  readonly amountInCents?: number;

  @ApiPropertyOptional({
    description:
      'Extra data without personal data, e.g. `{ quantity }`, `{ deliveryId }` or `{ result }`.',
    example: { quantity: 1 },
  })
  readonly details?: Record<string, string | number>;

  @ApiProperty({
    description: 'Id of the request (or scheduled run) that caused it, as in the logs.',
  })
  readonly requestId!: string;

  @ApiProperty({ format: 'date-time' })
  readonly occurredAt!: string;
}

@ApiSchema({ name: 'TransactionEventList' })
export class TransactionEventListSchema implements TransactionEventListResponse {
  @ApiProperty({ type: [TransactionEventSchema] })
  readonly data!: TransactionEventSchema[];

  @ApiProperty({ type: ListMetaSchema })
  readonly meta!: ListMetaSchema;
}

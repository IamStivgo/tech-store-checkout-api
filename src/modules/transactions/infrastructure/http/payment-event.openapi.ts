import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'PaymentEventSignature' })
class PaymentEventSignatureSchema {
  @ApiProperty({ example: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] })
  readonly properties!: string[];

  @ApiProperty({
    description: 'SHA-256 of the signed values, the timestamp and the events secret.',
  })
  readonly checksum!: string;
}

@ApiSchema({ name: 'PaymentEvent' })
export class PaymentEventSchema {
  @ApiProperty({ example: 'transaction.updated' })
  readonly event!: string;

  @ApiProperty({
    description: 'Event data, e.g. `{ transaction: { id, reference, status, ... } }`.',
  })
  readonly data!: Record<string, unknown>;

  @ApiProperty({ example: 'test' })
  readonly environment!: string;

  @ApiProperty({ type: PaymentEventSignatureSchema })
  readonly signature!: PaymentEventSignatureSchema;

  @ApiProperty({ example: 1_790_566_893 })
  readonly timestamp!: number;
}

@ApiSchema({ name: 'PaymentEventAck' })
export class PaymentEventAckSchema {
  @ApiProperty({ example: true })
  readonly received!: boolean;

  @ApiProperty({ enum: ['applied', 'ignored'] })
  readonly outcome!: 'applied' | 'ignored';
}

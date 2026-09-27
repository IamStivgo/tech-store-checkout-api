import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import type { CreateCustomerCommand } from '../../application/create-customer.use-case';
import { LEGAL_ID_TYPES, type LegalIdType } from '../../domain/legal-id.vo';

import type { CustomerResponse } from './customer.response';

@ApiSchema({ name: 'CreateCustomerRequest' })
export class CreateCustomerRequestSchema implements CreateCustomerCommand {
  @ApiProperty({
    description:
      '3 to 80 characters: letters (accents and ñ included), spaces, apostrophes, hyphens and dots; at least two words.',
    example: 'Ana María Gómez',
  })
  readonly fullName!: string;

  @ApiProperty({
    description: 'Up to 254 characters; stored in lower case.',
    example: 'ana.gomez@example.com',
  })
  readonly email!: string;

  @ApiProperty({
    description:
      '10 digits starting with 3 (mobile) or 60 (landline); +57, spaces and hyphens are accepted.',
    example: '3001234567',
  })
  readonly phone!: string;

  @ApiProperty({ enum: LEGAL_ID_TYPES, example: 'CC' })
  readonly legalIdType!: LegalIdType;

  @ApiProperty({
    description:
      'CC: 5-10 digits; CE: 6-10 letters or digits; NIT: 9 digits and an optional check digit; PP: 6-12 letters or digits.',
    example: '1020304050',
  })
  readonly legalId!: string;
}

@ApiSchema({ name: 'Customer', description: 'Customer with its personal data masked.' })
export class CustomerSchema implements CustomerResponse {
  @ApiProperty({ format: 'uuid', example: '2f9d4c1a-7b3e-4d5f-8a6b-9c0d1e2f3a4b' })
  readonly id!: string;

  @ApiProperty({ example: 'Ana M. G.' })
  readonly fullName!: string;

  @ApiProperty({ example: 'a***@example.com' })
  readonly email!: string;

  @ApiProperty({ example: '******4567' })
  readonly phone!: string;

  @ApiProperty({ enum: LEGAL_ID_TYPES, example: 'CC' })
  readonly legalIdType!: LegalIdType;

  @ApiProperty({ example: '******4050' })
  readonly legalId!: string;

  @ApiProperty({ format: 'date-time', example: '2026-09-24T20:15:00.000Z' })
  readonly createdAt!: string;
}

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import type {
  AcceptanceTokenResponse,
  AcceptanceTokensResponse,
} from './acceptance-tokens.response';

@ApiSchema({ name: 'AcceptanceToken' })
export class AcceptanceTokenSchema implements AcceptanceTokenResponse {
  @ApiProperty({ description: 'Signed, single-use token to send with the payment.' })
  readonly acceptanceToken!: string;

  @ApiProperty({ format: 'uri', description: 'Document the buyer accepts (PDF).' })
  readonly permalink!: string;
}

@ApiSchema({ name: 'AcceptanceTokens' })
export class AcceptanceTokensSchema implements AcceptanceTokensResponse {
  @ApiProperty({ type: AcceptanceTokenSchema, description: 'Terms and privacy policy.' })
  readonly endUserPolicy!: AcceptanceTokenSchema;

  @ApiProperty({ type: AcceptanceTokenSchema, description: 'Personal data processing.' })
  readonly personalDataAuth!: AcceptanceTokenSchema;
}

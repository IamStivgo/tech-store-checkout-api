import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import type { TokenizationKeyResponse } from './tokenization-key.response';

@ApiSchema({ name: 'TokenizationKey' })
export class TokenizationKeySchema implements TokenizationKeyResponse {
  @ApiProperty({
    description: 'RSA public key (PEM) to encrypt the card (JWE, RSA-OAEP-256 + A256GCM).',
    example: '-----BEGIN PUBLIC KEY----- MIIBIjANBgkq... -----END PUBLIC KEY-----',
  })
  readonly publicKey!: string;
}

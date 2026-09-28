import { Controller, Get, Header, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiProblemResponses } from '../../../../shared/infrastructure/http/openapi/problem-details.openapi';
import { toHttpResponse } from '../../../../shared/infrastructure/http/to-http-response';
import { GetAcceptanceTokens } from '../../application/get-acceptance-tokens.use-case';
import { GetTokenizationKey } from '../../application/get-tokenization-key.use-case';

import { AcceptanceTokensSchema } from './acceptance-tokens.openapi';
import {
  toAcceptanceTokensResponse,
  type AcceptanceTokensResponse,
} from './acceptance-tokens.response';
import { TokenizationKeySchema } from './tokenization-key.openapi';
import type { TokenizationKeyResponse } from './tokenization-key.response';

@ApiTags('Payments')
@ApiProblemResponses(HttpStatus.INTERNAL_SERVER_ERROR)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly getAcceptanceTokens: GetAcceptanceTokens,
    private readonly getTokenizationKey: GetTokenizationKey,
  ) {}

  @Get('acceptance-tokens')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get the documents the buyer must accept, with fresh single-use tokens',
    description:
      'Each token can be used in one payment only: request new ones for every payment attempt.',
  })
  @ApiOkResponse({ type: AcceptanceTokensSchema })
  @ApiProblemResponses(HttpStatus.BAD_GATEWAY, HttpStatus.GATEWAY_TIMEOUT)
  async acceptanceTokens(): Promise<AcceptanceTokensResponse> {
    return toAcceptanceTokensResponse(await toHttpResponse(this.getAcceptanceTokens.execute()));
  }

  @Get('tokenization-key')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({
    summary: 'Get the public key the browser encrypts the card with before tokenizing it',
    description:
      'Served from the store origin because the payment provider does not allow reading it from the browser (CORS).',
  })
  @ApiOkResponse({ type: TokenizationKeySchema })
  @ApiProblemResponses(HttpStatus.BAD_GATEWAY, HttpStatus.GATEWAY_TIMEOUT)
  async tokenizationKey(): Promise<TokenizationKeyResponse> {
    return { publicKey: await toHttpResponse(this.getTokenizationKey.execute()) };
  }
}

import { Controller, Get, Header, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiProblemResponses } from '../../../../shared/infrastructure/http/openapi/problem-details.openapi';
import { toHttpResponse } from '../../../../shared/infrastructure/http/to-http-response';
import { GetAcceptanceTokens } from '../../application/get-acceptance-tokens.use-case';

import { AcceptanceTokensSchema } from './acceptance-tokens.openapi';
import {
  toAcceptanceTokensResponse,
  type AcceptanceTokensResponse,
} from './acceptance-tokens.response';

@ApiTags('Payments')
@ApiProblemResponses(HttpStatus.INTERNAL_SERVER_ERROR)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly getAcceptanceTokens: GetAcceptanceTokens) {}

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
}

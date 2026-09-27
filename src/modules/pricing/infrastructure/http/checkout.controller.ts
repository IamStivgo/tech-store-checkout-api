import { Controller, Get, Header, HttpStatus, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { ApiProblemResponses } from '../../../../shared/infrastructure/http/openapi/problem-details.openapi';
import { toHttpResponse } from '../../../../shared/infrastructure/http/to-http-response';
import { QuoteCheckout } from '../../application/quote-checkout.use-case';

import { parseQuoteQuery } from './quote-query';
import { QuoteSchema } from './quote.openapi';
import { toQuoteResponse, type QuoteResponse } from './quote.response';

@ApiTags('Checkout')
@ApiProblemResponses(HttpStatus.INTERNAL_SERVER_ERROR)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly quoteCheckout: QuoteCheckout) {}

  @Get('quote')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Quote an order: product amount, service fee, delivery fee and total',
    description:
      'Informative quote computed on the server. The charged total is recalculated when the transaction is created.',
  })
  @ApiQuery({ name: 'productId', format: 'uuid', description: 'Product id.' })
  @ApiQuery({ name: 'quantity', type: 'integer', minimum: 1, example: 1 })
  @ApiQuery({
    name: 'cityCode',
    description: 'Five-digit DIVIPOLA municipality code.',
    example: '05001',
  })
  @ApiOkResponse({ type: QuoteSchema })
  @ApiProblemResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY,
  )
  async quote(@Query() query: Record<string, unknown>): Promise<QuoteResponse> {
    return toQuoteResponse(
      await toHttpResponse(this.quoteCheckout.execute(parseQuoteQuery(query))),
    );
  }
}

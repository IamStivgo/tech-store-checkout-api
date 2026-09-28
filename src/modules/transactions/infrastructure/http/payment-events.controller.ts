import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiProblemResponses } from '../../../../shared/infrastructure/http/openapi/problem-details.openapi';
import { toHttpResponse } from '../../../../shared/infrastructure/http/to-http-response';
import { HandlePaymentEvent } from '../../application/handle-payment-event.use-case';

import { PaymentEventAckSchema, PaymentEventSchema } from './payment-event.openapi';

@ApiTags('Webhooks')
@ApiProblemResponses(HttpStatus.INTERNAL_SERVER_ERROR)
@Controller('webhooks')
export class PaymentEventsController {
  constructor(private readonly handlePaymentEvent: HandlePaymentEvent) {}

  @Post('payment-events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive a payment event from the payment provider',
    description:
      'Verified with the events checksum; events of another environment or unknown references are acknowledged and ignored.',
  })
  @ApiBody({ type: PaymentEventSchema })
  @ApiOkResponse({ type: PaymentEventAckSchema })
  @ApiProblemResponses(HttpStatus.UNAUTHORIZED)
  async receive(@Body() body: unknown): Promise<PaymentEventAckSchema> {
    const outcome = await toHttpResponse(this.handlePaymentEvent.execute(body));
    return { received: true, outcome };
  }
}

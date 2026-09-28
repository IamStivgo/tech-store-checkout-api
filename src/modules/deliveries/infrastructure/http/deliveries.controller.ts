import { Controller, Get, Header, HttpStatus, Inject, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ApiProblemResponses } from '../../../../shared/infrastructure/http/openapi/problem-details.openapi';
import { parseUuidParam } from '../../../../shared/infrastructure/http/parse-uuid-param';
import { toHttpResponse } from '../../../../shared/infrastructure/http/to-http-response';
import type { CoverageRepository } from '../../../coverage/domain/coverage.repository.port';
import { COVERAGE_REPOSITORY } from '../../../coverage/infrastructure/coverage-repository.token';
import { GetDelivery, GetDeliveryByTransaction } from '../../application/get-delivery.use-case';

import { DeliverySchema } from './delivery.openapi';
import { toDeliveryResponse, type DeliveryResponse } from './delivery.response';

@ApiTags('Deliveries')
@ApiProblemResponses(HttpStatus.INTERNAL_SERVER_ERROR)
@Controller()
export class DeliveriesController {
  constructor(
    private readonly getDelivery: GetDelivery,
    private readonly getDeliveryByTransaction: GetDeliveryByTransaction,
    @Inject(COVERAGE_REPOSITORY) private readonly coverage: CoverageRepository,
  ) {}

  @Get('deliveries/:deliveryId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get a delivery, with the recipient and the address masked' })
  @ApiParam({ name: 'deliveryId', format: 'uuid' })
  @ApiOkResponse({ type: DeliverySchema })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async detail(
    @Param('deliveryId', parseUuidParam('deliveryId')) deliveryId: string,
  ): Promise<DeliveryResponse> {
    return toDeliveryResponse(
      await toHttpResponse(this.getDelivery.execute(deliveryId)),
      this.coverage,
    );
  }

  @Get('transactions/:transactionId/delivery')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get the delivery of a transaction',
    description: 'Only an APPROVED transaction has a delivery (404 DELIVERY_NOT_FOUND otherwise).',
  })
  @ApiParam({ name: 'transactionId', format: 'uuid' })
  @ApiOkResponse({ type: DeliverySchema })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async ofTransaction(
    @Param('transactionId', parseUuidParam('transactionId')) transactionId: string,
  ): Promise<DeliveryResponse> {
    return toDeliveryResponse(
      await toHttpResponse(this.getDeliveryByTransaction.execute(transactionId)),
      this.coverage,
    );
  }
}

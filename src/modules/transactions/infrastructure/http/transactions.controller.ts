import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import {
  DEFAULT_API_VERSION,
  GLOBAL_PREFIX,
} from '../../../../shared/infrastructure/http/configure-app';
import { Idempotent } from '../../../../shared/infrastructure/http/idempotent.decorator';
import { ApiProblemResponses } from '../../../../shared/infrastructure/http/openapi/problem-details.openapi';
import { parseUuidParam } from '../../../../shared/infrastructure/http/parse-uuid-param';
import { toHttpResponse } from '../../../../shared/infrastructure/http/to-http-response';
import { CancelTransaction } from '../../application/cancel-transaction.use-case';
import { CreateTransaction } from '../../application/create-transaction.use-case';
import { GetTransaction } from '../../application/get-transaction.use-case';

import { parseCreateTransactionBody, parseUpdateTransactionBody } from './transaction-requests';
import {
  CreateTransactionRequestSchema,
  TransactionSchema,
  UpdateTransactionRequestSchema,
} from './transaction.openapi';
import { toTransactionResponse, type TransactionResponse } from './transaction.response';

const RESOURCE_PATH = `/${GLOBAL_PREFIX}/v${DEFAULT_API_VERSION}/transactions`;
const TRANSACTION_ID_PARAM = { name: 'transactionId', format: 'uuid' } as const;

@ApiTags('Transactions')
@ApiProblemResponses(HttpStatus.INTERNAL_SERVER_ERROR)
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransaction,
    private readonly getTransaction: GetTransaction,
    private readonly cancelTransaction: CancelTransaction,
  ) {}

  @Post()
  @Idempotent()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create a PENDING transaction and reserve its stock',
    description:
      'The amounts are computed on the server; the stock stays reserved until reservationExpiresAt if the payment is not sent.',
  })
  @ApiBody({ type: CreateTransactionRequestSchema })
  @ApiCreatedResponse({
    type: TransactionSchema,
    headers: { Location: { description: 'URL of the transaction.', schema: { type: 'string' } } },
  })
  @ApiProblemResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
    HttpStatus.UNPROCESSABLE_ENTITY,
  )
  async create(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TransactionResponse> {
    const transaction = toTransactionResponse(
      await toHttpResponse(this.createTransaction.execute(parseCreateTransactionBody(body)), {
        // A customer referenced in the body is a business rule error, not a missing route.
        CUSTOMER_NOT_FOUND: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    );
    response.location(`${RESOURCE_PATH}/${transaction.id}`);
    return transaction;
  }

  @Get(':transactionId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get the current state of a transaction' })
  @ApiParam(TRANSACTION_ID_PARAM)
  @ApiOkResponse({ type: TransactionSchema })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async detail(
    @Param('transactionId', parseUuidParam('transactionId')) transactionId: string,
  ): Promise<TransactionResponse> {
    return toTransactionResponse(await toHttpResponse(this.getTransaction.execute(transactionId)));
  }

  @Patch(':transactionId')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Cancel a PENDING transaction whose payment was not sent',
    description: 'Releases the reserved stock right away. JSON Merge Patch (RFC 7396).',
  })
  @ApiParam(TRANSACTION_ID_PARAM)
  @ApiConsumes('application/merge-patch+json', 'application/json')
  @ApiBody({ type: UpdateTransactionRequestSchema })
  @ApiOkResponse({ type: TransactionSchema })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND, HttpStatus.CONFLICT)
  async update(
    @Param('transactionId', parseUuidParam('transactionId')) transactionId: string,
    @Body() body: unknown,
  ): Promise<TransactionResponse> {
    parseUpdateTransactionBody(body);
    return toTransactionResponse(
      await toHttpResponse(this.cancelTransaction.execute(transactionId)),
    );
  }
}

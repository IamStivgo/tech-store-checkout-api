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
  ApiAcceptedResponse,
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
import { GetTransactionEvents } from '../../application/get-transaction-events.use-case';
import { GetTransaction } from '../../application/get-transaction.use-case';
import { ProcessPayment } from '../../application/process-payment.use-case';

import { TransactionEventListSchema } from './transaction-event.openapi';
import {
  toTransactionEventListResponse,
  type TransactionEventListResponse,
} from './transaction-event.response';
import {
  parseCreateTransactionBody,
  parsePayTransactionBody,
  parseUpdateTransactionBody,
} from './transaction-requests';
import {
  CreateTransactionRequestSchema,
  PayTransactionRequestSchema,
  TransactionSchema,
  UpdateTransactionRequestSchema,
} from './transaction.openapi';
import { toTransactionResponse, type TransactionResponse } from './transaction.response';

const RESOURCE_PATH = `/${GLOBAL_PREFIX}/v${DEFAULT_API_VERSION}/transactions`;
const TRANSACTION_ID_PARAM = { name: 'transactionId', format: 'uuid' } as const;
/** Seconds after which a client asks again about a payment still PENDING. */
const PENDING_RETRY_AFTER_SECONDS = '2';

@ApiTags('Transactions')
@ApiProblemResponses(HttpStatus.INTERNAL_SERVER_ERROR)
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransaction,
    private readonly getTransaction: GetTransaction,
    private readonly cancelTransaction: CancelTransaction,
    private readonly processPayment: ProcessPayment,
    private readonly getTransactionEvents: GetTransactionEvents,
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
  @ApiOperation({
    summary: 'Get the current state of a transaction',
    description:
      'While the payment is PENDING, the payment provider is asked for the result (at most once every 2 s).',
  })
  @ApiParam(TRANSACTION_ID_PARAM)
  @ApiOkResponse({ type: TransactionSchema })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async detail(
    @Param('transactionId', parseUuidParam('transactionId')) transactionId: string,
  ): Promise<TransactionResponse> {
    return toTransactionResponse(await toHttpResponse(this.getTransaction.execute(transactionId)));
  }

  @Get(':transactionId/events')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get the audit timeline of a transaction',
    description:
      'Immutable events in chronological order: creation, stock, payment, status changes, delivery, webhook and reconciliation (ADR-012). Never personal data or tokens.',
  })
  @ApiParam(TRANSACTION_ID_PARAM)
  @ApiOkResponse({ type: TransactionEventListSchema })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async events(
    @Param('transactionId', parseUuidParam('transactionId')) transactionId: string,
  ): Promise<TransactionEventListResponse> {
    return toTransactionEventListResponse(
      await toHttpResponse(this.getTransactionEvents.execute(transactionId)),
    );
  }

  @Post(':transactionId/payment')
  @Idempotent()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Pay the transaction with a tokenized card and wait a few seconds for the result',
    description:
      'Answers 200 with a final status, or 202 while the payment is still PENDING (follow Location after Retry-After).',
  })
  @ApiParam(TRANSACTION_ID_PARAM)
  @ApiBody({ type: PayTransactionRequestSchema })
  @ApiOkResponse({ type: TransactionSchema, description: 'Final status.' })
  @ApiAcceptedResponse({
    type: TransactionSchema,
    description: 'Still PENDING.',
    headers: {
      Location: { description: 'URL to poll.', schema: { type: 'string' } },
      'Retry-After': { description: 'Seconds to wait.', schema: { type: 'integer' } },
    },
  })
  @ApiProblemResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
    HttpStatus.UNPROCESSABLE_ENTITY,
    HttpStatus.BAD_GATEWAY,
    HttpStatus.GATEWAY_TIMEOUT,
  )
  async pay(
    @Param('transactionId', parseUuidParam('transactionId')) transactionId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TransactionResponse> {
    const transaction = toTransactionResponse(
      await toHttpResponse(
        this.processPayment.execute(parsePayTransactionBody(transactionId, body)),
        {
          CUSTOMER_NOT_FOUND: HttpStatus.UNPROCESSABLE_ENTITY,
        },
      ),
    );
    if (transaction.status === 'PENDING') {
      response
        .status(HttpStatus.ACCEPTED)
        .location(`${RESOURCE_PATH}/${transaction.id}`)
        .setHeader('Retry-After', PENDING_RETRY_AFTER_SECONDS);
    } else {
      response.status(HttpStatus.OK);
    }
    return transaction;
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

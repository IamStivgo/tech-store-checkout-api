import { Body, Controller, Get, Header, HttpStatus, Param, Post, Res } from '@nestjs/common';
import {
  ApiBody,
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
import { CreateCustomer } from '../../application/create-customer.use-case';
import { GetCustomer } from '../../application/get-customer.use-case';

import { parseCreateCustomerBody } from './create-customer-body';
import { CreateCustomerRequestSchema, CustomerSchema } from './customer.openapi';
import { toCustomerResponse, type CustomerResponse } from './customer.response';

const RESOURCE_PATH = `/${GLOBAL_PREFIX}/v${DEFAULT_API_VERSION}/customers`;

@ApiTags('Customers')
@ApiProblemResponses(HttpStatus.INTERNAL_SERVER_ERROR)
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly createCustomer: CreateCustomer,
    private readonly getCustomer: GetCustomer,
  ) {}

  @Post()
  @Idempotent()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create the customer of a checkout',
    description:
      'Always creates a new customer (there is no lookup by email). The response masks the personal data.',
  })
  @ApiBody({ type: CreateCustomerRequestSchema })
  @ApiCreatedResponse({
    type: CustomerSchema,
    headers: { Location: { description: 'URL of the new customer.', schema: { type: 'string' } } },
  })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST)
  async create(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerResponse> {
    const customer = toCustomerResponse(
      await toHttpResponse(this.createCustomer.execute(parseCreateCustomerBody(body))),
    );
    response.location(`${RESOURCE_PATH}/${customer.id}`);
    return customer;
  }

  @Get(':customerId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get a customer with its personal data masked' })
  @ApiParam({ name: 'customerId', format: 'uuid', description: 'Customer id.' })
  @ApiOkResponse({ type: CustomerSchema })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async detail(
    @Param('customerId', parseUuidParam('customerId')) customerId: string,
  ): Promise<CustomerResponse> {
    return toCustomerResponse(await toHttpResponse(this.getCustomer.execute(customerId)));
  }
}

import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Module } from '@nestjs/common';

import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/app-config.token';
import type { Clock } from '../../../shared/domain/clock.port';
import type { IdGenerator } from '../../../shared/domain/id-generator.port';
import { DYNAMODB_DOCUMENT_CLIENT } from '../../../shared/infrastructure/persistence/dynamodb-document-client.token';
import { CLOCK } from '../../../shared/infrastructure/system/clock.token';
import { ID_GENERATOR } from '../../../shared/infrastructure/system/id-generator.token';
import { CreateCustomer } from '../application/create-customer.use-case';
import { GetCustomer } from '../application/get-customer.use-case';
import type { CustomerRepository } from '../domain/customer.repository.port';

import { CUSTOMER_REPOSITORY } from './customer-repository.token';
import { CustomersController } from './http/customers.controller';
import { DynamoDbCustomerRepository } from './persistence/dynamodb-customer.repository';

@Module({
  controllers: [CustomersController],
  providers: [
    {
      provide: CUSTOMER_REPOSITORY,
      inject: [DYNAMODB_DOCUMENT_CLIENT, APP_CONFIG],
      useFactory: (client: DynamoDBDocumentClient, config: AppConfig): CustomerRepository =>
        new DynamoDbCustomerRepository(client, config.tables.customers),
    },
    {
      provide: CreateCustomer,
      inject: [CUSTOMER_REPOSITORY, ID_GENERATOR, CLOCK],
      useFactory: (customers: CustomerRepository, ids: IdGenerator, clock: Clock) =>
        new CreateCustomer(customers, ids, clock),
    },
    {
      provide: GetCustomer,
      inject: [CUSTOMER_REPOSITORY],
      useFactory: (customers: CustomerRepository) => new GetCustomer(customers),
    },
  ],
})
export class CustomersModule {}

import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Module } from '@nestjs/common';

import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/app-config.token';
import { DYNAMODB_DOCUMENT_CLIENT } from '../../../shared/infrastructure/persistence/dynamodb-document-client.token';
import { CoverageModule } from '../../coverage/infrastructure/coverage.module';
import type { TransactionRepository } from '../../transactions/domain/transaction.repository.port';
import { TRANSACTION_REPOSITORY } from '../../transactions/infrastructure/transaction-tokens';
import { TransactionsModule } from '../../transactions/infrastructure/transactions.module';
import { GetDelivery, GetDeliveryByTransaction } from '../application/get-delivery.use-case';
import type { DeliveryRepository } from '../domain/delivery.repository.port';

import { DELIVERY_REPOSITORY } from './delivery-repository.token';
import { DeliveriesController } from './http/deliveries.controller';
import { DynamoDbDeliveryRepository } from './persistence/dynamodb-delivery.repository';

@Module({
  imports: [CoverageModule, TransactionsModule],
  controllers: [DeliveriesController],
  providers: [
    {
      provide: DELIVERY_REPOSITORY,
      inject: [DYNAMODB_DOCUMENT_CLIENT, APP_CONFIG],
      useFactory: (client: DynamoDBDocumentClient, config: AppConfig): DeliveryRepository =>
        new DynamoDbDeliveryRepository(client, config.tables.deliveries),
    },
    {
      provide: GetDelivery,
      inject: [DELIVERY_REPOSITORY],
      useFactory: (deliveries: DeliveryRepository) => new GetDelivery(deliveries),
    },
    {
      provide: GetDeliveryByTransaction,
      inject: [TRANSACTION_REPOSITORY, GetDelivery],
      useFactory: (transactions: TransactionRepository, getDelivery: GetDelivery) =>
        new GetDeliveryByTransaction(transactions, getDelivery),
    },
  ],
})
export class DeliveriesModule {}

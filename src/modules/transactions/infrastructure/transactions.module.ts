import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Module } from '@nestjs/common';

import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/app-config.token';
import type { Clock } from '../../../shared/domain/clock.port';
import type { IdGenerator } from '../../../shared/domain/id-generator.port';
import { DYNAMODB_DOCUMENT_CLIENT } from '../../../shared/infrastructure/persistence/dynamodb-document-client.token';
import { CLOCK } from '../../../shared/infrastructure/system/clock.token';
import { ID_GENERATOR } from '../../../shared/infrastructure/system/id-generator.token';
import type { CoverageRepository } from '../../coverage/domain/coverage.repository.port';
import { COVERAGE_REPOSITORY } from '../../coverage/infrastructure/coverage-repository.token';
import { CoverageModule } from '../../coverage/infrastructure/coverage.module';
import type { CustomerRepository } from '../../customers/domain/customer.repository.port';
import { CUSTOMER_REPOSITORY } from '../../customers/infrastructure/customer-repository.token';
import { CustomersModule } from '../../customers/infrastructure/customers.module';
import { CheckoutPricingService } from '../../pricing/domain/checkout-pricing.service';
import { PricingModule } from '../../pricing/infrastructure/pricing.module';
import type { ProductRepository } from '../../products/domain/product.repository.port';
import { PRODUCT_REPOSITORY } from '../../products/infrastructure/product-repository.token';
import { ProductsModule } from '../../products/infrastructure/products.module';
import { CancelTransaction } from '../application/cancel-transaction.use-case';
import { CreateTransaction } from '../application/create-transaction.use-case';
import { GetTransaction } from '../application/get-transaction.use-case';
import type { CheckoutUnitOfWork } from '../domain/checkout-unit-of-work.port';
import type { TransactionRepository } from '../domain/transaction.repository.port';

import { TransactionsController } from './http/transactions.controller';
import { DynamoDbCheckoutUnitOfWork } from './persistence/dynamodb-checkout-unit-of-work';
import { DynamoDbTransactionRepository } from './persistence/dynamodb-transaction.repository';
import { CHECKOUT_UNIT_OF_WORK, TRANSACTION_REPOSITORY } from './transaction-tokens';

@Module({
  imports: [ProductsModule, CustomersModule, CoverageModule, PricingModule],
  controllers: [TransactionsController],
  providers: [
    {
      provide: TRANSACTION_REPOSITORY,
      inject: [DYNAMODB_DOCUMENT_CLIENT, APP_CONFIG],
      useFactory: (client: DynamoDBDocumentClient, config: AppConfig): TransactionRepository =>
        new DynamoDbTransactionRepository(client, config.tables.transactions),
    },
    {
      provide: CHECKOUT_UNIT_OF_WORK,
      inject: [DYNAMODB_DOCUMENT_CLIENT, APP_CONFIG],
      useFactory: (client: DynamoDBDocumentClient, config: AppConfig): CheckoutUnitOfWork =>
        new DynamoDbCheckoutUnitOfWork(client, {
          products: config.tables.products,
          transactions: config.tables.transactions,
          deliveries: config.tables.deliveries,
        }),
    },
    {
      provide: CreateTransaction,
      inject: [
        PRODUCT_REPOSITORY,
        CUSTOMER_REPOSITORY,
        COVERAGE_REPOSITORY,
        CheckoutPricingService,
        CHECKOUT_UNIT_OF_WORK,
        APP_CONFIG,
        ID_GENERATOR,
        CLOCK,
      ],
      useFactory: (
        products: ProductRepository,
        customers: CustomerRepository,
        coverage: CoverageRepository,
        pricing: CheckoutPricingService,
        checkout: CheckoutUnitOfWork,
        config: AppConfig,
        ids: IdGenerator,
        clock: Clock,
      ) =>
        new CreateTransaction({
          products,
          customers,
          coverage,
          pricing,
          checkout,
          catalog: config.catalog,
          policy: config.transactions,
          ids,
          clock,
        }),
    },
    {
      provide: GetTransaction,
      inject: [TRANSACTION_REPOSITORY],
      useFactory: (transactions: TransactionRepository) => new GetTransaction(transactions),
    },
    {
      provide: CancelTransaction,
      inject: [TRANSACTION_REPOSITORY, CHECKOUT_UNIT_OF_WORK, CLOCK],
      useFactory: (
        transactions: TransactionRepository,
        checkout: CheckoutUnitOfWork,
        clock: Clock,
      ) => new CancelTransaction(transactions, checkout, clock),
    },
  ],
})
export class TransactionsModule {}

import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Module } from '@nestjs/common';

import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/app-config.token';
import type { Clock } from '../../../shared/domain/clock.port';
import type { IdGenerator } from '../../../shared/domain/id-generator.port';
import type { Sleeper } from '../../../shared/domain/sleeper.port';
import { DYNAMODB_DOCUMENT_CLIENT } from '../../../shared/infrastructure/persistence/dynamodb-document-client.token';
import { CLOCK } from '../../../shared/infrastructure/system/clock.token';
import { ID_GENERATOR } from '../../../shared/infrastructure/system/id-generator.token';
import { SLEEPER } from '../../../shared/infrastructure/system/sleeper.token';
import type { CoverageRepository } from '../../coverage/domain/coverage.repository.port';
import { COVERAGE_REPOSITORY } from '../../coverage/infrastructure/coverage-repository.token';
import { CoverageModule } from '../../coverage/infrastructure/coverage.module';
import type { CustomerRepository } from '../../customers/domain/customer.repository.port';
import { CUSTOMER_REPOSITORY } from '../../customers/infrastructure/customer-repository.token';
import { CustomersModule } from '../../customers/infrastructure/customers.module';
import type { PaymentGateway } from '../../payments/domain/payment-gateway.port';
import { PAYMENT_GATEWAY } from '../../payments/infrastructure/payment-gateway.token';
import { PaymentsModule } from '../../payments/infrastructure/payments.module';
import { CheckoutPricingService } from '../../pricing/domain/checkout-pricing.service';
import { PricingModule } from '../../pricing/infrastructure/pricing.module';
import type { ProductRepository } from '../../products/domain/product.repository.port';
import { PRODUCT_REPOSITORY } from '../../products/infrastructure/product-repository.token';
import { ProductsModule } from '../../products/infrastructure/products.module';
import { ApplyPaymentResult } from '../application/apply-payment-result.use-case';
import { CancelTransaction } from '../application/cancel-transaction.use-case';
import { CreateTransaction } from '../application/create-transaction.use-case';
import { GetTransaction } from '../application/get-transaction.use-case';
import { ProcessPayment } from '../application/process-payment.use-case';
import { ReconcileTransactions } from '../application/reconcile-transactions.use-case';
import type { CheckoutUnitOfWork } from '../domain/checkout-unit-of-work.port';
import type { TransactionRepository } from '../domain/transaction.repository.port';

import { TransactionsController } from './http/transactions.controller';
import { DynamoDbCheckoutUnitOfWork } from './persistence/dynamodb-checkout-unit-of-work';
import { DynamoDbTransactionRepository } from './persistence/dynamodb-transaction.repository';
import { CHECKOUT_UNIT_OF_WORK, TRANSACTION_REPOSITORY } from './transaction-tokens';

// About 8 s of waiting for the final result before answering 202 (backend design §6.2).
const PAYMENT_POLL_DELAYS_MS = [1000, 1500, 2000, 2500];
// The scheduler runs every 5 minutes; each run reviews the oldest PENDING transactions.
const RECONCILE_BATCH_SIZE = 50;
const LOST_CLAIM_AFTER_MS = 10 * 60_000;
// Reading a PENDING transaction asks the provider at most once every 2 s (T-045).
const TRANSACTION_SYNC_INTERVAL_MS = 2000;

@Module({
  imports: [ProductsModule, CustomersModule, CoverageModule, PricingModule, PaymentsModule],
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
      inject: [TRANSACTION_REPOSITORY, PAYMENT_GATEWAY, ApplyPaymentResult, CLOCK],
      useFactory: (
        transactions: TransactionRepository,
        gateway: PaymentGateway,
        applyResult: ApplyPaymentResult,
        clock: Clock,
      ) =>
        new GetTransaction(transactions, {
          gateway,
          applyResult,
          clock,
          minIntervalMs: TRANSACTION_SYNC_INTERVAL_MS,
        }),
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
    {
      provide: ApplyPaymentResult,
      inject: [TRANSACTION_REPOSITORY, CHECKOUT_UNIT_OF_WORK, ID_GENERATOR, CLOCK],
      useFactory: (
        transactions: TransactionRepository,
        checkout: CheckoutUnitOfWork,
        ids: IdGenerator,
        clock: Clock,
      ) => new ApplyPaymentResult(transactions, checkout, ids, clock),
    },
    {
      provide: ProcessPayment,
      inject: [
        TRANSACTION_REPOSITORY,
        CUSTOMER_REPOSITORY,
        COVERAGE_REPOSITORY,
        PAYMENT_GATEWAY,
        ApplyPaymentResult,
        ID_GENERATOR,
        CLOCK,
        SLEEPER,
      ],
      useFactory: (
        transactions: TransactionRepository,
        customers: CustomerRepository,
        coverage: CoverageRepository,
        gateway: PaymentGateway,
        applyResult: ApplyPaymentResult,
        ids: IdGenerator,
        clock: Clock,
        sleeper: Sleeper,
      ) =>
        new ProcessPayment({
          transactions,
          customers,
          coverage,
          gateway,
          applyResult,
          ids,
          clock,
          sleeper,
          pollDelaysMs: PAYMENT_POLL_DELAYS_MS,
        }),
    },
    {
      provide: ReconcileTransactions,
      inject: [
        TRANSACTION_REPOSITORY,
        CHECKOUT_UNIT_OF_WORK,
        PAYMENT_GATEWAY,
        ApplyPaymentResult,
        CLOCK,
      ],
      useFactory: (
        transactions: TransactionRepository,
        checkout: CheckoutUnitOfWork,
        gateway: PaymentGateway,
        applyResult: ApplyPaymentResult,
        clock: Clock,
      ) =>
        new ReconcileTransactions({
          transactions,
          checkout,
          gateway,
          applyResult,
          clock,
          batchSize: RECONCILE_BATCH_SIZE,
          lostClaimAfterMs: LOST_CLAIM_AFTER_MS,
        }),
    },
  ],
  exports: [ReconcileTransactions],
})
export class TransactionsModule {}

import { loadAppConfig, type AppConfig } from '../../src/config/app-config';

/** Minimum environment every test configuration needs. */
export const TEST_ENV = {
  APP_ENV: 'test',
  LOG_LEVEL: 'silent',
  TABLE_PRODUCTS: 'checkout-app-test-products',
  TABLE_CUSTOMERS: 'checkout-app-test-customers',
  TABLE_TRANSACTIONS: 'checkout-app-test-transactions',
  TABLE_DELIVERIES: 'checkout-app-test-deliveries',
  TABLE_TRANSACTION_EVENTS: 'checkout-app-test-transaction-events',
  TABLE_IDEMPOTENCY: 'checkout-app-test-idempotency-keys',
} as const;

export const aConfig = (env: Readonly<Record<string, string>> = {}): AppConfig =>
  loadAppConfig({ ...TEST_ENV, ...env });

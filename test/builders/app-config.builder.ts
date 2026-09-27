import { loadAppConfig, type AppConfig } from '../../src/config/app-config';

/** Minimum environment every test configuration needs. */
export const TEST_ENV = {
  APP_ENV: 'test',
  LOG_LEVEL: 'silent',
  TABLE_PRODUCTS: 'checkout-app-test-products',
  TABLE_CUSTOMERS: 'checkout-app-test-customers',
  TABLE_IDEMPOTENCY: 'checkout-app-test-idempotency-keys',
} as const;

export const aConfig = (env: Readonly<Record<string, string>> = {}): AppConfig =>
  loadAppConfig({ ...TEST_ENV, ...env });

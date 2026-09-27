import { Customer, type CustomerData } from '../../src/modules/customers/domain/customer.entity';

import { unwrap } from './unwrap';

export const CUSTOMER_ID = '2f9d4c1a-7b3e-4d5f-8a6b-9c0d1e2f3a4b';
export const CUSTOMER_CREATED_AT = new Date('2026-09-24T20:15:00.000Z');

/** Customer data as the buyer types it in the checkout form (copy deck §7.2). */
export const aCustomerData = (overrides: Partial<CustomerData> = {}): CustomerData => ({
  fullName: 'Ana María Gómez',
  email: 'ana.gomez@example.com',
  phone: '3001234567',
  legalIdType: 'CC',
  legalId: '1020304050',
  ...overrides,
});

export const aCustomer = (
  overrides: Partial<CustomerData> = {},
  id = CUSTOMER_ID,
  createdAt = CUSTOMER_CREATED_AT,
): Customer => unwrap(Customer.create(id, aCustomerData(overrides), createdAt));

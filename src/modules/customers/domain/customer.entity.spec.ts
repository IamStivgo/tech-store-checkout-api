import {
  aCustomerData,
  CUSTOMER_CREATED_AT,
  CUSTOMER_ID,
} from '../../../../test/builders/customer.builder';
import { unwrap } from '../../../../test/builders/unwrap';

import { Customer } from './customer.entity';

describe('Customer', () => {
  it('creates a customer with normalized data', () => {
    const customer = unwrap(
      Customer.create(
        CUSTOMER_ID,
        aCustomerData({ email: 'Ana.Gomez@Example.com', phone: '+57 300 123 4567' }),
        CUSTOMER_CREATED_AT,
      ),
    );

    expect(customer.id).toBe(CUSTOMER_ID);
    expect(customer.fullName.value).toBe('Ana María Gómez');
    expect(customer.email.value).toBe('ana.gomez@example.com');
    expect(customer.phone.value).toBe('3001234567');
    expect(customer.legalId).toMatchObject({ type: 'CC', number: '1020304050' });
    expect(customer.createdAt).toEqual(CUSTOMER_CREATED_AT);
  });

  it('reports every invalid field at once', () => {
    const result = Customer.create(
      CUSTOMER_ID,
      { fullName: 'Ana', email: 'ana', phone: '123', legalIdType: 'CC', legalId: '1' },
      CUSTOMER_CREATED_AT,
    );

    expect(result.isErr && result.error.fieldErrors.map(({ field }) => field)).toEqual([
      'fullName',
      'email',
      'phone',
      'legalId',
    ]);
  });
});

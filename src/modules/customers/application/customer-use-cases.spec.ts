import {
  aCustomer,
  aCustomerData,
  CUSTOMER_CREATED_AT,
  CUSTOMER_ID,
} from '../../../../test/builders/customer.builder';
import { unwrap } from '../../../../test/builders/unwrap';
import { FakeClock } from '../../../../test/fakes/fake-clock';
import { FakeIdGenerator } from '../../../../test/fakes/fake-id-generator';
import { InMemoryCustomerRepository } from '../../../../test/fakes/in-memory-customer.repository';
import { PersistenceError } from '../../../shared/domain/persistence-error';
import { CustomerNotFoundError } from '../domain/customer.errors';

import { CreateCustomer } from './create-customer.use-case';
import { GetCustomer } from './get-customer.use-case';

const MASKED_ANA = {
  id: CUSTOMER_ID,
  fullName: 'Ana M. G.',
  email: 'a***@example.com',
  phone: '******4567',
  legalIdType: 'CC',
  legalId: '******4050',
  createdAt: CUSTOMER_CREATED_AT,
};

const storageFailure = () => new PersistenceError('customers.test', new Error('down'));

describe('CreateCustomer', () => {
  const setup = (customers = new InMemoryCustomerRepository()) => ({
    customers,
    createCustomer: new CreateCustomer(
      customers,
      new FakeIdGenerator([CUSTOMER_ID]),
      new FakeClock(CUSTOMER_CREATED_AT),
    ),
  });

  it('stores a new customer and returns it masked', async () => {
    const { customers, createCustomer } = setup();

    const view = unwrap(await createCustomer.execute(aCustomerData()));

    expect(view).toEqual(MASKED_ANA);
    expect(customers.customers.get(CUSTOMER_ID)?.email.value).toBe('ana.gomez@example.com');
  });

  it('stores nothing when the data is invalid', async () => {
    const { customers, createCustomer } = setup();

    const result = await createCustomer.execute(aCustomerData({ email: 'ana' }));

    expect(result.isErr && result.error.code).toBe('VALIDATION_ERROR');
    expect(customers.customers.size).toBe(0);
  });

  it('reports storage failures', async () => {
    const { createCustomer } = setup(new InMemoryCustomerRepository().failWith(storageFailure()));

    const result = await createCustomer.execute(aCustomerData());

    expect(result.isErr && result.error).toBeInstanceOf(PersistenceError);
  });
});

describe('GetCustomer', () => {
  it('returns the customer masked', async () => {
    const getCustomer = new GetCustomer(new InMemoryCustomerRepository([aCustomer()]));

    expect(unwrap(await getCustomer.execute(CUSTOMER_ID))).toEqual(MASKED_ANA);
  });

  it('reports a missing customer', async () => {
    const getCustomer = new GetCustomer(new InMemoryCustomerRepository());

    const result = await getCustomer.execute(CUSTOMER_ID);

    expect(result.isErr && result.error).toBeInstanceOf(CustomerNotFoundError);
  });

  it('reports storage failures', async () => {
    const getCustomer = new GetCustomer(
      new InMemoryCustomerRepository().failWith(storageFailure()),
    );

    const result = await getCustomer.execute(CUSTOMER_ID);

    expect(result.isErr && result.error).toBeInstanceOf(PersistenceError);
  });
});

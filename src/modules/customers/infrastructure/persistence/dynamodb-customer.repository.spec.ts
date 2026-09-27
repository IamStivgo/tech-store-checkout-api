import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

import { aCustomer, CUSTOMER_ID } from '../../../../../test/builders/customer.builder';
import { unwrap } from '../../../../../test/builders/unwrap';

import { DynamoDbCustomerRepository } from './dynamodb-customer.repository';

const TABLE = 'checkout-app-test-customers';

const ITEM = {
  customerId: CUSTOMER_ID,
  fullName: 'Ana María Gómez',
  email: 'ana.gomez@example.com',
  phone: '3001234567',
  legalIdType: 'CC',
  legalId: '1020304050',
  createdAt: '2026-09-24T20:15:00.000Z',
};

describe('DynamoDbCustomerRepository', () => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
  const dynamo = mockClient(client);
  const repository = new DynamoDbCustomerRepository(client, TABLE);

  beforeEach(() => {
    dynamo.reset();
  });

  describe('create', () => {
    it('puts the normalized customer only if its id is free', async () => {
      dynamo.on(PutCommand).resolves({});

      unwrap(await repository.create(aCustomer({ email: 'Ana.Gomez@Example.com' })));

      expect(dynamo.commandCalls(PutCommand)[0]?.args[0].input).toEqual({
        TableName: TABLE,
        Item: ITEM,
        ConditionExpression: 'attribute_not_exists(customerId)',
      });
    });

    it('wraps SDK failures, including an id collision, in a persistence error', async () => {
      dynamo.on(PutCommand).rejects(new Error('ConditionalCheckFailedException'));

      const result = await repository.create(aCustomer());

      expect(result.isErr && result.error.operation).toBe('customers.create');
    });
  });

  describe('findById', () => {
    it('gets the customer by its key', async () => {
      dynamo.on(GetCommand).resolves({ Item: ITEM });

      const customer = unwrap(await repository.findById(CUSTOMER_ID));

      expect(customer?.email.value).toBe('ana.gomez@example.com');
      expect(customer?.createdAt).toEqual(new Date('2026-09-24T20:15:00.000Z'));
      expect(dynamo.commandCalls(GetCommand)[0]?.args[0].input).toEqual({
        TableName: TABLE,
        Key: { customerId: CUSTOMER_ID },
      });
    });

    it('returns null when the customer does not exist', async () => {
      dynamo.on(GetCommand).resolves({});

      expect(unwrap(await repository.findById(CUSTOMER_ID))).toBeNull();
    });

    it.each([
      ['a missing attribute', { ...ITEM, email: undefined }],
      ['a value that breaks the rules', { ...ITEM, phone: '123' }],
    ])('rejects an item with %s as corrupt data', async (_case, item) => {
      dynamo.on(GetCommand).resolves({ Item: item });

      const result = await repository.findById(CUSTOMER_ID);

      expect(result.isErr && result.error.operation).toBe('customers.toDomain');
    });

    it('wraps SDK failures in a persistence error', async () => {
      dynamo.on(GetCommand).rejects(new Error('timeout'));

      const result = await repository.findById(CUSTOMER_ID);

      expect(result.isErr && result.error.operation).toBe('customers.findById');
    });
  });
});

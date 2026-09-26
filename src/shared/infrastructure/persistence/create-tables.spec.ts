import {
  CreateTableCommand,
  DynamoDBClient,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

import { createTables } from './create-tables';

const definition = (tableName: string) => ({
  TableName: tableName,
  BillingMode: 'PAY_PER_REQUEST' as const,
  AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' as const }],
  KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' as const }],
});

describe('createTables', () => {
  const client = new DynamoDBClient({ region: 'us-east-1' });
  const dynamo = mockClient(client);

  beforeEach(() => {
    dynamo.reset();
  });

  it('creates every missing table', async () => {
    dynamo.on(CreateTableCommand).resolves({});

    const outcomes = await createTables(client, [definition('first'), definition('second')]);

    expect(Object.fromEntries(outcomes)).toEqual({ first: 'created', second: 'created' });
    expect(dynamo.commandCalls(CreateTableCommand)[0]?.args[0].input).toEqual(definition('first'));
  });

  it('skips tables that already exist, so it can run again safely', async () => {
    dynamo
      .on(CreateTableCommand, { TableName: 'existing' })
      .rejects(new ResourceInUseException({ message: 'Table already exists', $metadata: {} }))
      .on(CreateTableCommand, { TableName: 'new' })
      .resolves({});

    const outcomes = await createTables(client, [definition('existing'), definition('new')]);

    expect(Object.fromEntries(outcomes)).toEqual({ existing: 'already-exists', new: 'created' });
  });

  it('propagates any other failure', async () => {
    dynamo.on(CreateTableCommand).rejects(new Error('connect ECONNREFUSED 127.0.0.1:8000'));

    await expect(createTables(client, [definition('first')])).rejects.toThrow('ECONNREFUSED');
  });
});

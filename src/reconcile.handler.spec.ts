import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { NestFactory } from '@nestjs/core';
import { mockClient } from 'aws-sdk-client-mock';

import { TEST_ENV } from '../test/builders/app-config.builder';

import { createReconcileHandler } from './reconcile.handler';

describe('Reconciliation Lambda handler', () => {
  const originalEnv = process.env;
  const dynamo = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    process.env = { ...originalEnv, ...TEST_ENV };
    dynamo.reset();
    dynamo.on(QueryCommand).resolves({ Items: [] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    dynamo.restore();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reviews the pending transactions and returns what it did', async () => {
    const handler = createReconcileHandler();

    await expect(handler()).resolves.toEqual({ expired: 0, synced: 0, failed: 0 });
    expect(dynamo.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({
      TableName: TEST_ENV.TABLE_TRANSACTIONS,
      IndexName: 'pending-index',
    });
  });

  it('fails the run when the pending transactions cannot be read', async () => {
    dynamo.on(QueryCommand).rejects(new Error('DynamoDB is down'));
    const handler = createReconcileHandler();

    await expect(handler()).rejects.toThrow('Reconciliation failed: INTERNAL_ERROR');
  });

  it('creates the application context once per container', async () => {
    const createContext = jest.spyOn(NestFactory, 'createApplicationContext');
    const handler = createReconcileHandler();

    await handler();
    await handler();

    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it('retries the bootstrap after a failed cold start', async () => {
    const handler = createReconcileHandler();
    delete process.env.APP_ENV;

    await expect(handler()).rejects.toThrow(/APP_ENV/);

    process.env.APP_ENV = 'test';
    await expect(handler()).resolves.toEqual({ expired: 0, synced: 0, failed: 0 });
  });
});

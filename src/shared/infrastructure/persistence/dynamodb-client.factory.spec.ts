import { aConfig } from '../../../../test/builders/app-config.builder';

import { createDynamoDbDocumentClient } from './dynamodb-client.factory';

describe('createDynamoDbDocumentClient', () => {
  it('uses the configured region and the default AWS endpoint and credentials', async () => {
    const client = createDynamoDbDocumentClient(aConfig({ AWS_REGION: 'us-east-2' }));

    await expect(client.config.region()).resolves.toBe('us-east-2');
    expect(client.config.endpoint).toBeUndefined();
  });

  it('points at DynamoDB Local with placeholder credentials when an endpoint is set', async () => {
    const client = createDynamoDbDocumentClient(
      aConfig({ DYNAMODB_ENDPOINT: 'http://localhost:8000' }),
    );

    const endpoint = await client.config.endpoint?.();
    const credentials = await client.config.credentials();

    expect(endpoint?.hostname).toBe('localhost');
    expect(endpoint?.port).toBe(8000);
    expect(credentials.accessKeyId).toBe('local');
  });
});

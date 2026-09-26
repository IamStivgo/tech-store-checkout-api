import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import type { AppConfig } from '../../../config/app-config';

// DynamoDB Local accepts any credentials, but the SDK still needs some to sign requests.
const LOCAL_CREDENTIALS = { accessKeyId: 'local', secretAccessKey: 'local' };

export const createDynamoDbDocumentClient = (config: AppConfig): DynamoDBDocumentClient => {
  const client = new DynamoDBClient({
    region: config.awsRegion,
    ...(config.dynamodbEndpoint
      ? { endpoint: config.dynamodbEndpoint, credentials: LOCAL_CREDENTIALS }
      : {}),
  });

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
};

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import type { AppConfig } from '../../../config/app-config';

// DynamoDB Local accepts any credentials, but the SDK still needs some to sign requests.
const LOCAL_CREDENTIALS = { accessKeyId: 'local', secretAccessKey: 'local' };

export const createDynamoDbClient = (config: AppConfig): DynamoDBClient =>
  new DynamoDBClient({
    region: config.awsRegion,
    ...(config.dynamodbEndpoint
      ? { endpoint: config.dynamodbEndpoint, credentials: LOCAL_CREDENTIALS }
      : {}),
  });

export const createDynamoDbDocumentClient = (config: AppConfig): DynamoDBDocumentClient =>
  DynamoDBDocumentClient.from(createDynamoDbClient(config), {
    marshallOptions: { removeUndefinedValues: true },
  });

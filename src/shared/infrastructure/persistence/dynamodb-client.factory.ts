import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import type { DynamoDbConnection } from '../../../config/app-config';

// DynamoDB Local accepts any credentials, but the SDK still needs some to sign requests.
const LOCAL_CREDENTIALS = { accessKeyId: 'local', secretAccessKey: 'local' };

export const createDynamoDbClient = (config: DynamoDbConnection): DynamoDBClient =>
  new DynamoDBClient({
    region: config.awsRegion,
    ...(config.dynamodbEndpoint
      ? { endpoint: config.dynamodbEndpoint, credentials: LOCAL_CREDENTIALS }
      : {}),
  });

export const createDynamoDbDocumentClient = (config: DynamoDbConnection): DynamoDBDocumentClient =>
  DynamoDBDocumentClient.from(createDynamoDbClient(config), {
    marshallOptions: { removeUndefinedValues: true },
  });

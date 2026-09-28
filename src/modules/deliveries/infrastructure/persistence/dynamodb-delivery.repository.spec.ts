import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

import { aTransaction } from '../../../../../test/builders/transaction.builder';
import { unwrap } from '../../../../../test/builders/unwrap';
import { Delivery } from '../../domain/delivery.entity';

import { toDeliveryItem } from './delivery.mapper';
import { DynamoDbDeliveryRepository } from './dynamodb-delivery.repository';

const TABLE = 'checkout-app-test-deliveries';
const DELIVERY_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('DynamoDbDeliveryRepository', () => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
  const dynamo = mockClient(client);
  const repository = new DynamoDbDeliveryRepository(client, TABLE);

  beforeEach(() => {
    dynamo.reset();
  });

  it('reads a delivery by its key', async () => {
    const delivery = Delivery.assignFor(
      aTransaction(),
      DELIVERY_ID,
      new Date('2026-09-24T20:17:00Z'),
    );
    dynamo.on(GetCommand).resolves({ Item: toDeliveryItem(delivery) });

    expect(unwrap(await repository.findById(DELIVERY_ID))?.id).toBe(DELIVERY_ID);
    expect(dynamo.commandCalls(GetCommand)[0]?.args[0].input).toEqual({
      TableName: TABLE,
      Key: { deliveryId: DELIVERY_ID },
    });
  });

  it('returns null for an unknown delivery and wraps SDK failures', async () => {
    dynamo.on(GetCommand).resolvesOnce({}).rejectsOnce(new Error('timeout'));

    expect(unwrap(await repository.findById(DELIVERY_ID))).toBeNull();
    const failed = await repository.findById(DELIVERY_ID);
    expect(failed.isErr && failed.error.operation).toBe('deliveries.findById');
  });
});

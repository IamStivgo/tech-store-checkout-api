import { GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { PersistenceError } from '../../../../shared/domain/persistence-error';
import { ok, ResultAsync } from '../../../../shared/domain/result';
import type { Delivery } from '../../domain/delivery.entity';
import type { DeliveryRepository } from '../../domain/delivery.repository.port';

import { toDelivery } from './delivery.mapper';

export class DynamoDbDeliveryRepository implements DeliveryRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  findById(id: string): ResultAsync<Delivery | null, PersistenceError> {
    return ResultAsync.fromPromise(
      this.client.send(new GetCommand({ TableName: this.tableName, Key: { deliveryId: id } })),
      (cause) => new PersistenceError('deliveries.findById', cause),
    ).andThen(({ Item }) => (Item ? toDelivery(Item) : ok(null)));
  }
}

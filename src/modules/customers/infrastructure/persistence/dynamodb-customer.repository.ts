import { GetCommand, PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { PersistenceError } from '../../../../shared/domain/persistence-error';
import { ok, ResultAsync } from '../../../../shared/domain/result';
import type { Customer } from '../../domain/customer.entity';
import type { CustomerRepository } from '../../domain/customer.repository.port';

import { toCustomer, toCustomerItem } from './customer.mapper';

export class DynamoDbCustomerRepository implements CustomerRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  create(customer: Customer): ResultAsync<void, PersistenceError> {
    return ResultAsync.fromPromise(
      this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: toCustomerItem(customer),
          // Ids are random UUIDs: a collision must fail instead of overwriting someone's data.
          ConditionExpression: 'attribute_not_exists(customerId)',
        }),
      ),
      (cause) => new PersistenceError('customers.create', cause),
    ).map(() => undefined);
  }

  findById(id: string): ResultAsync<Customer | null, PersistenceError> {
    return ResultAsync.fromPromise(
      this.client.send(new GetCommand({ TableName: this.tableName, Key: { customerId: id } })),
      (cause) => new PersistenceError('customers.findById', cause),
    ).andThen(({ Item }) => (Item ? toCustomer(Item) : ok(null)));
  }
}

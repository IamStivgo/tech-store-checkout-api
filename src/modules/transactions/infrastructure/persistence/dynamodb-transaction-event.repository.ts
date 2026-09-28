import {
  QueryCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

import { PersistenceError } from '../../../../shared/domain/persistence-error';
import { okAsync, ResultAsync } from '../../../../shared/domain/result';
import type { TransactionEvent } from '../../domain/transaction-event';
import type {
  StoredTransactionEvent,
  TransactionEventRepository,
} from '../../domain/transaction-event.repository.port';

import { toEventPuts, toStoredEvents } from './transaction-event.mapper';

/** Append-only table: the functions can only put, condition-check and query it (ADR-012). */
export class DynamoDbTransactionEventRepository implements TransactionEventRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  append(events: readonly TransactionEvent[]): ResultAsync<void, PersistenceError> {
    if (events.length === 0) {
      return okAsync(undefined);
    }
    return ResultAsync.fromPromise(
      this.client.send(
        new TransactWriteCommand({ TransactItems: toEventPuts(this.tableName, events) }),
      ),
      (cause) => new PersistenceError('transactionEvents.append', cause),
    ).map(() => undefined);
  }

  listFor(transactionId: string): ResultAsync<StoredTransactionEvent[], PersistenceError> {
    return ResultAsync.fromPromise(
      this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'transactionId = :transactionId',
          ExpressionAttributeValues: { ':transactionId': transactionId },
          ScanIndexForward: true,
          ConsistentRead: true,
        }),
      ),
      (cause) => new PersistenceError('transactionEvents.listFor', cause),
    ).andThen(({ Items = [] }) => toStoredEvents(Items));
  }
}

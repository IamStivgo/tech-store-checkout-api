import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';

import type { IdempotencyRecordRepository } from '../../application/idempotency-record.repository.port';
import type { IdempotencyRecord, StoredResponse } from '../../domain/idempotency';
import { PersistenceError } from '../../domain/persistence-error';
import { err, ok, ResultAsync } from '../../domain/result';

const MS_PER_SECOND = 1000;

// expiresAt is the table's TTL attribute, so it is stored as epoch seconds.
const toEpochSeconds = (date: Date): number => Math.floor(date.getTime() / MS_PER_SECOND);

const itemSchema = z.object({
  idempotencyKey: z.string(),
  requestHash: z.string(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
  responseStatusCode: z.number().int().optional(),
  responseBody: z.string().optional(),
  responseHeaders: z.record(z.string(), z.string()).optional(),
  createdAt: z.iso.datetime(),
  expiresAt: z.number().int(),
});

const toRecord = (item: z.infer<typeof itemSchema>): IdempotencyRecord => ({
  scope: item.idempotencyKey,
  requestHash: item.requestHash,
  status: item.status,
  ...(item.responseStatusCode !== undefined && item.responseBody !== undefined
    ? {
        response: {
          statusCode: item.responseStatusCode,
          body: item.responseBody,
          headers: item.responseHeaders ?? {},
        },
      }
    : {}),
  createdAt: new Date(item.createdAt),
  expiresAt: new Date(item.expiresAt * MS_PER_SECOND),
});

const isConditionFailure = (cause: unknown): boolean =>
  cause instanceof ConditionalCheckFailedException;

export class DynamoDbIdempotencyRepository implements IdempotencyRecordRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  create(record: IdempotencyRecord, now: Date): ResultAsync<boolean, PersistenceError> {
    const put = this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          idempotencyKey: record.scope,
          requestHash: record.requestHash,
          status: record.status,
          createdAt: record.createdAt.toISOString(),
          expiresAt: toEpochSeconds(record.expiresAt),
        },
        // DynamoDB deletes expired items up to days late, so an expired one counts as free.
        ConditionExpression: 'attribute_not_exists(idempotencyKey) OR expiresAt <= :now',
        ExpressionAttributeValues: { ':now': toEpochSeconds(now) },
      }),
    );

    return ResultAsync.fromPromise(
      put.then(
        () => true,
        (cause: unknown) => {
          if (isConditionFailure(cause)) {
            return false;
          }
          throw cause;
        },
      ),
      (cause) => new PersistenceError('idempotency.create', cause),
    );
  }

  find(scope: string): ResultAsync<IdempotencyRecord | null, PersistenceError> {
    return ResultAsync.fromPromise(
      // Read right after a concurrent write: only a strongly consistent read sees it.
      this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { idempotencyKey: scope },
          ConsistentRead: true,
        }),
      ),
      (cause) => new PersistenceError('idempotency.find', cause),
    ).andThen(({ Item }) => {
      if (!Item) {
        return ok(null);
      }
      const parsed = itemSchema.safeParse(Item);
      return parsed.success
        ? ok(toRecord(parsed.data))
        : err(new PersistenceError('idempotency.find', parsed.error));
    });
  }

  complete(scope: string, response: StoredResponse): ResultAsync<void, PersistenceError> {
    const update = this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { idempotencyKey: scope },
        UpdateExpression:
          'SET #status = :completed, responseStatusCode = :code, responseBody = :body, responseHeaders = :headers',
        // Never recreate a record that was released in the meantime.
        ConditionExpression: 'attribute_exists(idempotencyKey)',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':completed': 'COMPLETED',
          ':code': response.statusCode,
          ':body': response.body,
          ':headers': response.headers,
        },
      }),
    );

    return ResultAsync.fromPromise(
      update.then(
        () => undefined,
        (cause: unknown) => {
          if (isConditionFailure(cause)) {
            return undefined;
          }
          throw cause;
        },
      ),
      (cause) => new PersistenceError('idempotency.complete', cause),
    );
  }

  delete(scope: string): ResultAsync<void, PersistenceError> {
    return ResultAsync.fromPromise(
      this.client.send(
        new DeleteCommand({ TableName: this.tableName, Key: { idempotencyKey: scope } }),
      ),
      (cause) => new PersistenceError('idempotency.delete', cause),
    ).map(() => undefined);
  }
}

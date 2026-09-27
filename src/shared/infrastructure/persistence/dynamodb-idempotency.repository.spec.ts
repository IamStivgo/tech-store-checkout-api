import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

import { unwrap } from '../../../../test/builders/unwrap';
import type { IdempotencyRecord } from '../../domain/idempotency';

import { DynamoDbIdempotencyRepository } from './dynamodb-idempotency.repository';

const TABLE = 'checkout-app-test-idempotency-keys';
const SCOPE = 'POST /api/v1/customers#8f14e45f-ceea-4e67-9a2b-3c1d2e3f4a5b';
const NOW = new Date('2026-09-24T20:15:00.000Z');
const NOW_EPOCH = 1_790_280_900;
const RECORD: IdempotencyRecord = {
  scope: SCOPE,
  requestHash: 'a1b2c3',
  status: 'IN_PROGRESS',
  createdAt: NOW,
  expiresAt: new Date('2026-09-25T20:15:00.000Z'),
};

const conditionFailed = () =>
  new ConditionalCheckFailedException({ message: 'The conditional request failed', $metadata: {} });

const failureOf = async (
  result: PromiseLike<{
    match: <R>(on: { ok: () => R; err: (e: { code: string; operation?: string }) => R }) => R;
  }>,
) => (await result).match({ ok: () => undefined, err: (error) => error });

describe('DynamoDbIdempotencyRepository', () => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
  const dynamo = mockClient(client);
  const repository = new DynamoDbIdempotencyRepository(client, TABLE);

  beforeEach(() => {
    dynamo.reset();
  });

  describe('create', () => {
    it('writes the record only if the key is free or expired, with the TTL in epoch seconds', async () => {
      dynamo.on(PutCommand).resolves({});

      expect(unwrap(await repository.create(RECORD, NOW))).toBe(true);
      expect(dynamo.commandCalls(PutCommand)[0]?.args[0].input).toEqual({
        TableName: TABLE,
        Item: {
          idempotencyKey: SCOPE,
          requestHash: 'a1b2c3',
          status: 'IN_PROGRESS',
          createdAt: '2026-09-24T20:15:00.000Z',
          expiresAt: NOW_EPOCH + 86_400,
        },
        ConditionExpression: 'attribute_not_exists(idempotencyKey) OR expiresAt <= :now',
        ExpressionAttributeValues: { ':now': NOW_EPOCH },
      });
    });

    it('answers false when a live record already holds the key', async () => {
      dynamo.on(PutCommand).rejects(conditionFailed());

      expect(unwrap(await repository.create(RECORD, NOW))).toBe(false);
    });

    it('reports other failures', async () => {
      dynamo.on(PutCommand).rejects(new Error('throttled'));

      expect(await failureOf(repository.create(RECORD, NOW))).toMatchObject({
        code: 'INTERNAL_ERROR',
        operation: 'idempotency.create',
      });
    });
  });

  describe('find', () => {
    it('reads consistently and maps a completed record', async () => {
      dynamo.on(GetCommand).resolves({
        Item: {
          idempotencyKey: SCOPE,
          requestHash: 'a1b2c3',
          status: 'COMPLETED',
          responseStatusCode: 201,
          responseBody: '{"id":"c-1"}',
          createdAt: '2026-09-24T20:15:00.000Z',
          expiresAt: NOW_EPOCH + 86_400,
        },
      });

      expect(unwrap(await repository.find(SCOPE))).toEqual({
        ...RECORD,
        status: 'COMPLETED',
        response: { statusCode: 201, body: '{"id":"c-1"}' },
      });
      expect(dynamo.commandCalls(GetCommand)[0]?.args[0].input).toEqual({
        TableName: TABLE,
        Key: { idempotencyKey: SCOPE },
        ConsistentRead: true,
      });
    });

    it('maps a record in progress without a response', async () => {
      dynamo.on(GetCommand).resolves({
        Item: {
          idempotencyKey: SCOPE,
          requestHash: 'a1b2c3',
          status: 'IN_PROGRESS',
          createdAt: '2026-09-24T20:15:00.000Z',
          expiresAt: NOW_EPOCH + 86_400,
        },
      });

      expect(unwrap(await repository.find(SCOPE))).toEqual(RECORD);
    });

    it('answers null when there is no record', async () => {
      dynamo.on(GetCommand).resolves({});

      expect(unwrap(await repository.find(SCOPE))).toBeNull();
    });

    it('rejects a malformed item', async () => {
      dynamo.on(GetCommand).resolves({ Item: { idempotencyKey: SCOPE, status: 'DONE' } });

      expect(await failureOf(repository.find(SCOPE))).toMatchObject({
        operation: 'idempotency.find',
      });
    });

    it('reports read failures', async () => {
      dynamo.on(GetCommand).rejects(new Error('timeout'));

      expect(await failureOf(repository.find(SCOPE))).toMatchObject({
        operation: 'idempotency.find',
      });
    });
  });

  describe('complete', () => {
    it('stores the response of an existing record', async () => {
      dynamo.on(UpdateCommand).resolves({});

      unwrap(await repository.complete(SCOPE, { statusCode: 201, body: '{"id":"c-1"}' }));

      expect(dynamo.commandCalls(UpdateCommand)[0]?.args[0].input).toMatchObject({
        TableName: TABLE,
        Key: { idempotencyKey: SCOPE },
        ConditionExpression: 'attribute_exists(idempotencyKey)',
        ExpressionAttributeValues: {
          ':completed': 'COMPLETED',
          ':code': 201,
          ':body': '{"id":"c-1"}',
        },
      });
    });

    it('ignores a record released in the meantime instead of recreating it', async () => {
      dynamo.on(UpdateCommand).rejects(conditionFailed());

      expect((await repository.complete(SCOPE, { statusCode: 201, body: '{}' })).isOk).toBe(true);
    });

    it('reports other failures', async () => {
      dynamo.on(UpdateCommand).rejects(new Error('throttled'));

      expect(
        await failureOf(repository.complete(SCOPE, { statusCode: 201, body: '{}' })),
      ).toMatchObject({
        operation: 'idempotency.complete',
      });
    });
  });

  describe('delete', () => {
    it('deletes the record', async () => {
      dynamo.on(DeleteCommand).resolves({});

      unwrap(await repository.delete(SCOPE));

      expect(dynamo.commandCalls(DeleteCommand)[0]?.args[0].input).toEqual({
        TableName: TABLE,
        Key: { idempotencyKey: SCOPE },
      });
    });

    it('reports delete failures', async () => {
      dynamo.on(DeleteCommand).rejects(new Error('timeout'));

      expect(await failureOf(repository.delete(SCOPE))).toMatchObject({
        operation: 'idempotency.delete',
      });
    });
  });
});

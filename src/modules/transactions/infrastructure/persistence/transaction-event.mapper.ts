import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { PersistenceError } from '../../../../shared/domain/persistence-error';
import { combine, err, ok, type Result } from '../../../../shared/domain/result';
import { currentRequestId } from '../../../../shared/infrastructure/context/request-context';
import {
  TRANSACTION_EVENT_SOURCES,
  TRANSACTION_EVENT_TYPES,
  type TransactionEvent,
} from '../../domain/transaction-event';
import type { StoredTransactionEvent } from '../../domain/transaction-event.repository.port';
import { TRANSACTION_STATUSES } from '../../domain/transaction-status';

const MAPPING_OPERATION = 'transactionEvents.toDomain';

/** The item of an event: `eventKey` orders the timeline and makes each event unique. */
export const toEventItem = (event: TransactionEvent): Record<string, unknown> => {
  const eventId = randomUUID();
  const occurredAt = event.occurredAt.toISOString();
  return {
    ...event,
    eventKey: `${occurredAt}#${eventId}`,
    eventId,
    requestId: currentRequestId(),
    occurredAt,
  };
};

/** Conditional puts: an existing event is never overwritten (append-only, ADR-012). */
export const toEventPuts = (tableName: string, events: readonly TransactionEvent[]) =>
  events.map((event) => ({
    Put: {
      TableName: tableName,
      Item: toEventItem(event),
      ConditionExpression: 'attribute_not_exists(eventKey)',
    },
  }));

const itemSchema = z.object({
  transactionId: z.string().min(1),
  eventId: z.string().min(1),
  type: z.enum(TRANSACTION_EVENT_TYPES),
  source: z.enum(TRANSACTION_EVENT_SOURCES),
  requestId: z.string(),
  occurredAt: z.iso.datetime(),
  fromStatus: z.enum(TRANSACTION_STATUSES).optional(),
  toStatus: z.enum(TRANSACTION_STATUSES).optional(),
  providerTransactionId: z.string().optional(),
  providerStatus: z.string().optional(),
  amountInCents: z.number().int().optional(),
  details: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

const toStoredEvent = (
  raw: Record<string, unknown>,
): Result<StoredTransactionEvent, PersistenceError> => {
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) {
    return err(new PersistenceError(MAPPING_OPERATION, parsed.error));
  }
  const { eventId, occurredAt, ...event } = parsed.data;
  return ok({ ...event, id: eventId, occurredAt: new Date(occurredAt) });
};

export const toStoredEvents = (
  items: readonly Record<string, unknown>[],
): Result<StoredTransactionEvent[], PersistenceError> => combine(items.map(toStoredEvent));

import { InMemoryIdempotencyRepository } from '../../../test/fakes/in-memory-idempotency.repository';
import type { Clock } from '../domain/clock.port';
import type { StoredResponse } from '../domain/idempotency';
import { PersistenceError } from '../domain/persistence-error';
import { okAsync } from '../domain/result';

import { IdempotencyService, type IdempotencyStart } from './idempotency.service';

const SCOPE = 'POST /api/v1/customers#8f14e45f-ceea-4e67-9a2b-3c1d2e3f4a5b';
const HASH = 'a1b2c3';
const CREATED: StoredResponse = { statusCode: 201, body: '{"id":"c-1"}' };

class MovableClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  advanceSeconds(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
}

const setup = () => {
  const records = new InMemoryIdempotencyRepository();
  const clock = new MovableClock(new Date('2026-09-24T20:15:00.000Z'));
  return { records, clock, service: new IdempotencyService(records, clock) };
};

const outcome = async (result: ReturnType<IdempotencyService['begin']>) =>
  (await result).match<IdempotencyStart | string>({
    ok: (start) => start,
    err: (error) => error.code,
  });

describe('IdempotencyService', () => {
  it('starts a new request and keeps it in progress for 24 hours', async () => {
    const { records, service } = setup();

    expect(await outcome(service.begin(SCOPE, HASH))).toEqual({ kind: 'STARTED' });
    expect(records.records.get(SCOPE)).toMatchObject({
      status: 'IN_PROGRESS',
      requestHash: HASH,
      createdAt: new Date('2026-09-24T20:15:00.000Z'),
      expiresAt: new Date('2026-09-25T20:15:00.000Z'),
    });
  });

  it('replays the stored response for the same request', async () => {
    const { service } = setup();
    await service.begin(SCOPE, HASH);
    await service.complete(SCOPE, CREATED);

    expect(await outcome(service.begin(SCOPE, HASH))).toEqual({
      kind: 'REPLAY',
      response: CREATED,
    });
  });

  it('rejects the same key with a different body', async () => {
    const { service } = setup();
    await service.begin(SCOPE, HASH);
    await service.complete(SCOPE, CREATED);

    expect(await outcome(service.begin(SCOPE, 'other-hash'))).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });

  it('asks to retry while the first request is still running', async () => {
    const { service } = setup();
    await service.begin(SCOPE, HASH);

    const result = await service.begin(SCOPE, HASH);

    expect(result.match({ ok: () => undefined, err: (error) => error })).toMatchObject({
      code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
      retryAfterSeconds: 1,
    });
  });

  it('lets the client retry after a released request', async () => {
    const { service } = setup();
    await service.begin(SCOPE, HASH);
    await service.release(SCOPE);

    expect(await outcome(service.begin(SCOPE, HASH))).toEqual({ kind: 'STARTED' });
  });

  it('treats an expired record as a new request, even if storage has not deleted it yet', async () => {
    const { service, clock } = setup();
    await service.begin(SCOPE, HASH);
    await service.complete(SCOPE, CREATED);
    clock.advanceSeconds(24 * 60 * 60);

    expect(await outcome(service.begin(SCOPE, 'new-body'))).toEqual({ kind: 'STARTED' });
  });

  it('asks to retry when the record vanished between the write and the read', async () => {
    const { records, service } = setup();
    jest.spyOn(records, 'create').mockReturnValueOnce(okAsync(false));

    expect(await outcome(service.begin(SCOPE, HASH))).toBe('IDEMPOTENCY_REQUEST_IN_PROGRESS');
  });

  it('reports persistence failures', async () => {
    const { records, service } = setup();
    const failure = new PersistenceError('idempotency.create', new Error('throttled'));
    records.failWith(failure);

    const result = await service.begin(SCOPE, HASH);

    expect(result.match({ ok: () => undefined, err: (error) => error })).toBe(failure);
  });
});

import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  readonly requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `work` with the request id available to anything it calls, e.g. the audit trail. */
export const runWithRequestId = <T>(requestId: string, work: () => T): T =>
  storage.run({ requestId }, work);

/** The id of the request (or scheduled run) being served; `unknown` outside of one. */
export const currentRequestId = (): string => storage.getStore()?.requestId ?? 'unknown';

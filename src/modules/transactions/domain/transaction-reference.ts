import type { IdGenerator } from '../../../shared/domain/id-generator.port';

const RANDOM_LENGTH = 10;
// References carry the purchase date in Colombia, where the store sells.
const STORE_TIME_ZONE = 'America/Bogota';
const dateInStore = new Intl.DateTimeFormat('en-CA', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Unique, human-friendly reference sent to the payment provider (BR-11):
 * `<PREFIX>-<YYYYMMDD>-<10 random Crockford Base32 characters>`, e.g. CKT-20260924-7K3M9Q2PXA.
 */
export const newTransactionReference = (prefix: string, now: Date, ids: IdGenerator): string =>
  `${prefix}-${dateInStore.format(now).replaceAll('-', '')}-${ids.randomBase32(RANDOM_LENGTH)}`;

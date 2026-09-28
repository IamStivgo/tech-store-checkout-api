import {
  GetDelivery,
  GetDeliveryByTransaction,
} from '../../src/modules/deliveries/application/get-delivery.use-case';
import { Delivery } from '../../src/modules/deliveries/domain/delivery.entity';
import { aStoredTransaction, aTransaction, TRANSACTION_ID } from '../builders/transaction.builder';
import { unwrap } from '../builders/unwrap';
import { InMemoryCheckoutStore } from '../fakes/in-memory-checkout.store';
import { InMemoryDeliveryRepository } from '../fakes/in-memory-delivery.repository';

const DELIVERY_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

const setup = (approved: boolean) => {
  const store = new InMemoryCheckoutStore();
  const transaction = approved
    ? aStoredTransaction({ status: 'APPROVED', deliveryId: DELIVERY_ID })
    : aTransaction();
  store.transactions.set(TRANSACTION_ID, transaction);
  const delivery = Delivery.assignFor(transaction, DELIVERY_ID, new Date('2026-09-24T20:17:00Z'));
  const getDelivery = new GetDelivery(
    new InMemoryDeliveryRepository(new Map([[DELIVERY_ID, delivery]])),
  );
  return { getDelivery, byTransaction: new GetDeliveryByTransaction(store, getDelivery) };
};

const codeOf = async (result: PromiseLike<{ isErr: boolean }>) =>
  ((await result) as { error?: { code: string } }).error?.code;

describe('GetDelivery', () => {
  it('finds a delivery by id or by its approved transaction', async () => {
    const { getDelivery, byTransaction } = setup(true);

    expect(unwrap(await getDelivery.execute(DELIVERY_ID)).id).toBe(DELIVERY_ID);
    expect(unwrap(await byTransaction.execute(TRANSACTION_ID)).id).toBe(DELIVERY_ID);
  });

  it('reports a missing delivery, a transaction without one and an unknown transaction', async () => {
    const approved = setup(true);
    const pending = setup(false);

    expect(await codeOf(approved.getDelivery.execute(UNKNOWN_ID))).toBe('DELIVERY_NOT_FOUND');
    expect(await codeOf(pending.byTransaction.execute(TRANSACTION_ID))).toBe('DELIVERY_NOT_FOUND');
    expect(await codeOf(approved.byTransaction.execute(UNKNOWN_ID))).toBe('TRANSACTION_NOT_FOUND');
  });
});

import { aTransaction } from '../../../../../test/builders/transaction.builder';
import { unwrap } from '../../../../../test/builders/unwrap';
import { Delivery } from '../../domain/delivery.entity';

import { toDelivery, toDeliveryItem } from './delivery.mapper';

const delivery = () =>
  Delivery.assignFor(
    aTransaction(),
    '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    new Date('2026-09-24T20:17:00.000Z'),
  );

describe('delivery mapper', () => {
  it('reads back the delivery it stores', () => {
    const stored = delivery();

    expect(unwrap(toDelivery(toDeliveryItem(stored))).props).toEqual(stored.props);
  });

  it('refuses a corrupt item', () => {
    const result = toDelivery({ ...toDeliveryItem(delivery()), zoneCode: 'MOON' });

    expect(result.isErr && result.error.operation).toBe('deliveries.toDomain');
  });
});

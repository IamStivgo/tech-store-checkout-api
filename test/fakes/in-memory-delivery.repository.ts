import type { Delivery } from '../../src/modules/deliveries/domain/delivery.entity';
import type { DeliveryRepository } from '../../src/modules/deliveries/domain/delivery.repository.port';
import type { PersistenceError } from '../../src/shared/domain/persistence-error';
import { okAsync, type ResultAsync } from '../../src/shared/domain/result';

/** Reads the deliveries the in-memory checkout store created when approving payments. */
export class InMemoryDeliveryRepository implements DeliveryRepository {
  constructor(private readonly deliveries: ReadonlyMap<string, Delivery>) {}

  findById(id: string): ResultAsync<Delivery | null, PersistenceError> {
    return okAsync(this.deliveries.get(id) ?? null);
  }
}

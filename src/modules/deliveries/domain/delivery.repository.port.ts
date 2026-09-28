import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';

import type { Delivery } from './delivery.entity';

export interface DeliveryRepository {
  findById(id: string): ResultAsync<Delivery | null, PersistenceError>;
}

import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';

import type { Product } from './product.entity';

export interface ProductRepository {
  findAllActive(): ResultAsync<Product[], PersistenceError>;
  findById(id: string): ResultAsync<Product | null, PersistenceError>;
}

import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';
import type { CatalogPolicy } from '../domain/catalog-policy';
import type { ProductNotFoundError } from '../domain/product.errors';
import type { ProductRepository } from '../domain/product.repository.port';

import { findActiveProduct } from './find-active-product';
import { toProductStockView, type ProductStockView } from './product.views';

export class GetProductStock {
  constructor(
    private readonly products: ProductRepository,
    private readonly policy: CatalogPolicy,
  ) {}

  execute(id: string): ResultAsync<ProductStockView, ProductNotFoundError | PersistenceError> {
    return findActiveProduct(this.products, id).map((product) =>
      toProductStockView(product, this.policy),
    );
  }
}

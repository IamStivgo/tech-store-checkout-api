import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';
import type { CatalogPolicy } from '../domain/catalog-policy';
import type { ProductNotFoundError } from '../domain/product.errors';
import type { ProductRepository } from '../domain/product.repository.port';

import { findActiveProduct } from './find-active-product';
import { toProductDetailView, type ProductDetailView } from './product.views';

export class GetProduct {
  constructor(
    private readonly products: ProductRepository,
    private readonly policy: CatalogPolicy,
  ) {}

  execute(id: string): ResultAsync<ProductDetailView, ProductNotFoundError | PersistenceError> {
    return findActiveProduct(this.products, id).map((product) =>
      toProductDetailView(product, this.policy),
    );
  }
}

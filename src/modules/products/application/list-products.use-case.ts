import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';
import type { CatalogPolicy } from '../domain/catalog-policy';
import type { ProductRepository } from '../domain/product.repository.port';

import { toProductSummaryView, type ProductSummaryView } from './product.views';

export class ListProducts {
  constructor(
    private readonly products: ProductRepository,
    private readonly policy: CatalogPolicy,
  ) {}

  execute(): ResultAsync<ProductSummaryView[], PersistenceError> {
    return this.products
      .findAllActive()
      .map((products) => products.map((product) => toProductSummaryView(product, this.policy)));
  }
}

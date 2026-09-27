import type { PersistenceError } from '../../../shared/domain/persistence-error';
import type { ResultAsync } from '../../../shared/domain/result';
import type { CatalogPolicy } from '../domain/catalog-policy';
import type { Product } from '../domain/product.entity';
import type { ProductRepository } from '../domain/product.repository.port';

import { toProductSummaryView, type ProductSummaryView } from './product.views';

// The SKU breaks ties so the catalog order never depends on the storage order.
const byCatalogOrder = (first: Product, second: Product): number =>
  first.displayOrder - second.displayOrder || first.sku.localeCompare(second.sku);

export class ListProducts {
  constructor(
    private readonly products: ProductRepository,
    private readonly policy: CatalogPolicy,
  ) {}

  execute(): ResultAsync<ProductSummaryView[], PersistenceError> {
    return this.products
      .findAllActive()
      .map((products) =>
        products
          .toSorted(byCatalogOrder)
          .map((product) => toProductSummaryView(product, this.policy)),
      );
  }
}

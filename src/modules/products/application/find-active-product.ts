import type { PersistenceError } from '../../../shared/domain/persistence-error';
import { err, ok, type ResultAsync } from '../../../shared/domain/result';
import type { Product } from '../domain/product.entity';
import { ProductNotFoundError } from '../domain/product.errors';
import type { ProductRepository } from '../domain/product.repository.port';

/** Inactive products are hidden from customers, so they are reported as not found. */
export const findActiveProduct = (
  products: ProductRepository,
  id: string,
): ResultAsync<Product, ProductNotFoundError | PersistenceError> =>
  products
    .findById(id)
    .andThen((product) => (product?.active ? ok(product) : err(new ProductNotFoundError())));

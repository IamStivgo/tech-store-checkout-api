import type { Product } from '../../src/modules/products/domain/product.entity';
import type { ProductRepository } from '../../src/modules/products/domain/product.repository.port';
import type { PersistenceError } from '../../src/shared/domain/persistence-error';
import { errAsync, okAsync, type ResultAsync } from '../../src/shared/domain/result';

export class InMemoryProductRepository implements ProductRepository {
  private failure: PersistenceError | undefined;

  constructor(private readonly products: readonly Product[] = []) {}

  failWith(error: PersistenceError): this {
    this.failure = error;
    return this;
  }

  findAllActive(): ResultAsync<Product[], PersistenceError> {
    return this.failure
      ? errAsync(this.failure)
      : okAsync(this.products.filter((product) => product.active));
  }

  findById(id: string): ResultAsync<Product | null, PersistenceError> {
    return this.failure
      ? errAsync(this.failure)
      : okAsync(this.products.find((product) => product.id === id) ?? null);
  }
}

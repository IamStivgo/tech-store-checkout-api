import type { Money } from '../../../shared/domain/money.vo';
import { err, ok, type Result } from '../../../shared/domain/result';
import { ValidationError } from '../../../shared/domain/validation-error';

import type { CatalogPolicy } from './catalog-policy';
import type { StockStatus } from './stock-status';
import type { Stock } from './stock.vo';

export type ImageFormat = 'avif' | 'webp' | 'jpg';

export interface ProductImage {
  /** Path without size or extension, e.g. /images/products/tec-cbl-usbc. */
  readonly basePath: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly formats: readonly ImageFormat[];
}

export interface ProductProps {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly shortDescription: string;
  readonly description: string;
  readonly price: Money;
  readonly stock: Stock;
  readonly weightGrams: number;
  readonly images: readonly [ProductImage, ...ProductImage[]];
  readonly active: boolean;
  /** Position in the catalog, as in the approved mockups (lower first). */
  readonly displayOrder: number;
  readonly updatedAt: Date;
}

export class Product {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly shortDescription: string;
  readonly description: string;
  readonly price: Money;
  readonly stock: Stock;
  readonly weightGrams: number;
  readonly images: readonly [ProductImage, ...ProductImage[]];
  readonly active: boolean;
  readonly displayOrder: number;
  readonly updatedAt: Date;

  private constructor(props: ProductProps) {
    this.id = props.id;
    this.sku = props.sku;
    this.name = props.name;
    this.shortDescription = props.shortDescription;
    this.description = props.description;
    this.price = props.price;
    this.stock = props.stock;
    this.weightGrams = props.weightGrams;
    this.images = props.images;
    this.active = props.active;
    this.displayOrder = props.displayOrder;
    this.updatedAt = props.updatedAt;
  }

  static create(props: ProductProps): Result<Product, ValidationError> {
    if (!Number.isSafeInteger(props.weightGrams) || props.weightGrams <= 0) {
      return err(ValidationError.forField('weightGrams', 'weightGrams must be a positive integer'));
    }
    if (!Number.isSafeInteger(props.displayOrder) || props.displayOrder < 0) {
      return err(
        ValidationError.forField('displayOrder', 'displayOrder must be a non-negative integer'),
      );
    }
    return ok(new Product(props));
  }

  get mainImage(): ProductImage {
    return this.images[0];
  }

  stockStatus(policy: CatalogPolicy): StockStatus {
    return this.stock.statusFor(policy.lowStockThreshold);
  }

  maxUnitsPerOrder(policy: CatalogPolicy): number {
    return Math.min(this.stock.available, policy.maxUnitsPerOrder);
  }
}

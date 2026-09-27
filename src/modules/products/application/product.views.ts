import type { Money } from '../../../shared/domain/money.vo';
import type { CatalogPolicy } from '../domain/catalog-policy';
import type { Product, ProductImage } from '../domain/product.entity';
import type { StockStatus } from '../domain/stock-status';

export interface StockView {
  readonly available: number;
  readonly status: StockStatus;
}

export interface ProductSummaryView {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly shortDescription: string;
  readonly price: Money;
  readonly stock: StockView;
  readonly image: ProductImage;
}

export interface ProductDetailView extends ProductSummaryView {
  readonly description: string;
  readonly weightGrams: number;
  readonly images: readonly ProductImage[];
  readonly maxUnitsPerOrder: number;
}

export interface ProductStockView extends StockView {
  readonly productId: string;
  readonly updatedAt: Date;
}

const toStockView = (product: Product, policy: CatalogPolicy): StockView => ({
  available: product.stock.available,
  status: product.stockStatus(policy),
});

export const toProductSummaryView = (
  product: Product,
  policy: CatalogPolicy,
): ProductSummaryView => ({
  id: product.id,
  sku: product.sku,
  name: product.name,
  shortDescription: product.shortDescription,
  price: product.price,
  stock: toStockView(product, policy),
  image: product.mainImage,
});

export const toProductDetailView = (
  product: Product,
  policy: CatalogPolicy,
): ProductDetailView => ({
  ...toProductSummaryView(product, policy),
  description: product.description,
  weightGrams: product.weightGrams,
  images: product.images,
  maxUnitsPerOrder: product.maxUnitsPerOrder(policy),
});

export const toProductStockView = (product: Product, policy: CatalogPolicy): ProductStockView => ({
  productId: product.id,
  ...toStockView(product, policy),
  updatedAt: product.updatedAt,
});

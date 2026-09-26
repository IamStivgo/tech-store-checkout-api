import type { MoneyJson } from '../../../../shared/domain/money.vo';
import type {
  ProductDetailView,
  ProductStockView,
  ProductSummaryView,
  StockView,
} from '../../application/product.views';
import type { ImageFormat, ProductImage } from '../../domain/product.entity';

const IMAGE_WIDTHS = [320, 640, 960] as const;
const DEFAULT_IMAGE_WIDTH = 640;
// The image pipeline always generates JPEG, the format every browser supports.
const FALLBACK_FORMAT: ImageFormat = 'jpg';

export interface ImageSourceResponse {
  readonly type: string;
  readonly srcSet: string;
}

export interface ImageResponse {
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly src: string;
  readonly sources: readonly ImageSourceResponse[];
}

export interface ProductSummaryResponse {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly shortDescription: string;
  readonly price: MoneyJson;
  readonly stock: StockView;
  readonly image: ImageResponse;
}

export interface ProductDetailResponse extends ProductSummaryResponse {
  readonly description: string;
  readonly weightGrams: number;
  readonly images: readonly ImageResponse[];
  readonly maxUnitsPerOrder: number;
}

export interface ProductListResponse {
  readonly data: readonly ProductSummaryResponse[];
  readonly meta: { readonly count: number };
}

export interface ProductStockResponse extends StockView {
  readonly productId: string;
  readonly updatedAt: string;
}

const fileFor = (image: ProductImage, width: number, format: ImageFormat): string =>
  `${image.basePath}-${width}.${format}`;

export const toImageResponse = (image: ProductImage): ImageResponse => {
  const modernFormats = image.formats.filter((format) => format !== FALLBACK_FORMAT);

  return {
    alt: image.alt,
    width: image.width,
    height: image.height,
    src: fileFor(image, DEFAULT_IMAGE_WIDTH, FALLBACK_FORMAT),
    sources: modernFormats.map((format) => ({
      type: `image/${format}`,
      srcSet: IMAGE_WIDTHS.map((width) => `${fileFor(image, width, format)} ${width}w`).join(', '),
    })),
  };
};

export const toProductSummaryResponse = (view: ProductSummaryView): ProductSummaryResponse => ({
  id: view.id,
  sku: view.sku,
  name: view.name,
  shortDescription: view.shortDescription,
  price: view.price.toJSON(),
  stock: { available: view.stock.available, status: view.stock.status },
  image: toImageResponse(view.image),
});

export const toProductListResponse = (
  views: readonly ProductSummaryView[],
): ProductListResponse => ({
  data: views.map(toProductSummaryResponse),
  meta: { count: views.length },
});

export const toProductDetailResponse = (view: ProductDetailView): ProductDetailResponse => ({
  ...toProductSummaryResponse(view),
  description: view.description,
  weightGrams: view.weightGrams,
  images: view.images.map(toImageResponse),
  maxUnitsPerOrder: view.maxUnitsPerOrder,
});

export const toProductStockResponse = (view: ProductStockView): ProductStockResponse => ({
  productId: view.productId,
  available: view.available,
  status: view.status,
  updatedAt: view.updatedAt.toISOString(),
});

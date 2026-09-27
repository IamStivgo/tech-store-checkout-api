import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import {
  ListMetaSchema,
  MoneySchema,
} from '../../../../shared/infrastructure/http/openapi/common.openapi';
import type { StockView } from '../../application/product.views';
import type { StockStatus } from '../../domain/stock-status';

import type {
  ImageResponse,
  ImageSourceResponse,
  ProductDetailResponse,
  ProductListResponse,
  ProductStockResponse,
  ProductSummaryResponse,
} from './product.presenter';

const STOCK_STATUSES: readonly StockStatus[] = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'];

@ApiSchema({ name: 'ImageSource' })
export class ImageSourceSchema implements ImageSourceResponse {
  @ApiProperty({ example: 'image/avif' })
  readonly type!: string;

  @ApiProperty({
    example:
      '/images/products/tec-cbl-usbc-320.avif 320w, /images/products/tec-cbl-usbc-640.avif 640w, /images/products/tec-cbl-usbc-960.avif 960w',
  })
  readonly srcSet!: string;
}

@ApiSchema({ name: 'Image' })
export class ImageSchema implements ImageResponse {
  @ApiProperty({ example: 'Cable USB-C trenzado gris enrollado' })
  readonly alt!: string;

  @ApiProperty({ example: 640 })
  readonly width!: number;

  @ApiProperty({ example: 640 })
  readonly height!: number;

  @ApiProperty({
    description: 'JPEG fallback, 640 px wide.',
    example: '/images/products/tec-cbl-usbc-640.jpg',
  })
  readonly src!: string;

  @ApiProperty({ type: [ImageSourceSchema], description: 'Modern formats for <picture>.' })
  readonly sources!: readonly ImageSourceResponse[];
}

@ApiSchema({ name: 'Stock' })
export class StockSchema implements StockView {
  @ApiProperty({ description: 'Units that can be bought now.', example: 12 })
  readonly available!: number;

  @ApiProperty({ enum: STOCK_STATUSES, example: 'IN_STOCK' })
  readonly status!: StockStatus;
}

@ApiSchema({ name: 'ProductSummary' })
export class ProductSummarySchema implements ProductSummaryResponse {
  @ApiProperty({ format: 'uuid', example: '7d094266-0b4e-4789-9522-96e1cd7ffa60' })
  readonly id!: string;

  @ApiProperty({ example: 'TEC-CBL-USBC' })
  readonly sku!: string;

  @ApiProperty({ example: 'Cable USB-C a USB-C 2 m (100 W)' })
  readonly name!: string;

  @ApiProperty({ example: 'Carga rápida de hasta 100 W y transferencia de datos USB 2.0.' })
  readonly shortDescription!: string;

  @ApiProperty({ type: MoneySchema })
  readonly price!: MoneySchema;

  @ApiProperty({ type: StockSchema })
  readonly stock!: StockSchema;

  @ApiProperty({ type: ImageSchema })
  readonly image!: ImageSchema;
}

@ApiSchema({ name: 'ProductDetail' })
export class ProductDetailSchema extends ProductSummarySchema implements ProductDetailResponse {
  @ApiProperty()
  readonly description!: string;

  @ApiProperty({ description: 'Shipping weight.', example: 150 })
  readonly weightGrams!: number;

  @ApiProperty({ type: [ImageSchema] })
  readonly images!: readonly ImageResponse[];

  @ApiProperty({ description: 'min(available stock, units allowed per order).', example: 5 })
  readonly maxUnitsPerOrder!: number;
}

@ApiSchema({ name: 'ProductList' })
export class ProductListSchema implements ProductListResponse {
  @ApiProperty({ type: [ProductSummarySchema] })
  readonly data!: readonly ProductSummaryResponse[];

  @ApiProperty({ type: ListMetaSchema })
  readonly meta!: ListMetaSchema;
}

@ApiSchema({ name: 'ProductStock' })
export class ProductStockSchema extends StockSchema implements ProductStockResponse {
  @ApiProperty({ format: 'uuid' })
  readonly productId!: string;

  @ApiProperty({ format: 'date-time' })
  readonly updatedAt!: string;
}

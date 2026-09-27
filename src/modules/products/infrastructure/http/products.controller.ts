import { Controller, Get, Header, HttpStatus, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { ApiProblemResponses } from '../../../../shared/infrastructure/http/openapi/problem-details.openapi';
import { parseUuidParam } from '../../../../shared/infrastructure/http/parse-uuid-param';
import { toHttpResponse } from '../../../../shared/infrastructure/http/to-http-response';
import { GetProductStock } from '../../application/get-product-stock.use-case';
import { GetProduct } from '../../application/get-product.use-case';
import { ListProducts } from '../../application/list-products.use-case';

import { ProductDetailSchema, ProductListSchema, ProductStockSchema } from './product.openapi';
import {
  toProductDetailResponse,
  toProductListResponse,
  toProductStockResponse,
  type ProductDetailResponse,
  type ProductListResponse,
  type ProductStockResponse,
} from './product.presenter';

const PRODUCT_ID_PARAM = { name: 'productId', format: 'uuid', description: 'Product id.' } as const;

@ApiTags('Products')
@ApiProblemResponses(HttpStatus.INTERNAL_SERVER_ERROR)
@Controller('products')
export class ProductsController {
  constructor(
    private readonly listProducts: ListProducts,
    private readonly getProduct: GetProduct,
    private readonly getProductStock: GetProductStock,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({ summary: 'List the active catalog in display order' })
  @ApiOkResponse({ type: ProductListSchema })
  async list(): Promise<ProductListResponse> {
    return toProductListResponse(await toHttpResponse(this.listProducts.execute()));
  }

  @Get(':productId')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({ summary: 'Get a product with its images, stock and order limit' })
  @ApiParam(PRODUCT_ID_PARAM)
  @ApiOkResponse({ type: ProductDetailSchema })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async detail(
    @Param('productId', parseUuidParam('productId')) productId: string,
  ): Promise<ProductDetailResponse> {
    return toProductDetailResponse(await toHttpResponse(this.getProduct.execute(productId)));
  }

  @Get(':productId/stock')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get the current stock of a product (never cached)' })
  @ApiParam(PRODUCT_ID_PARAM)
  @ApiOkResponse({ type: ProductStockSchema })
  @ApiProblemResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  async stock(
    @Param('productId', parseUuidParam('productId')) productId: string,
  ): Promise<ProductStockResponse> {
    return toProductStockResponse(await toHttpResponse(this.getProductStock.execute(productId)));
  }
}

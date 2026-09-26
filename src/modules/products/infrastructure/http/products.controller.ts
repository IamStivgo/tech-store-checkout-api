import { Controller, Get, Header, Param } from '@nestjs/common';

import { parseUuidParam } from '../../../../shared/infrastructure/http/parse-uuid-param';
import { toHttpResponse } from '../../../../shared/infrastructure/http/to-http-response';
import { GetProductStock } from '../../application/get-product-stock.use-case';
import { GetProduct } from '../../application/get-product.use-case';
import { ListProducts } from '../../application/list-products.use-case';

import {
  toProductDetailResponse,
  toProductListResponse,
  toProductStockResponse,
  type ProductDetailResponse,
  type ProductListResponse,
  type ProductStockResponse,
} from './product.presenter';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly listProducts: ListProducts,
    private readonly getProduct: GetProduct,
    private readonly getProductStock: GetProductStock,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-cache')
  async list(): Promise<ProductListResponse> {
    return toProductListResponse(await toHttpResponse(this.listProducts.execute()));
  }

  @Get(':productId')
  @Header('Cache-Control', 'no-cache')
  async detail(
    @Param('productId', parseUuidParam('productId')) productId: string,
  ): Promise<ProductDetailResponse> {
    return toProductDetailResponse(await toHttpResponse(this.getProduct.execute(productId)));
  }

  @Get(':productId/stock')
  @Header('Cache-Control', 'no-store')
  async stock(
    @Param('productId', parseUuidParam('productId')) productId: string,
  ): Promise<ProductStockResponse> {
    return toProductStockResponse(await toHttpResponse(this.getProductStock.execute(productId)));
  }
}

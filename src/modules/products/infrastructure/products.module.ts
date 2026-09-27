import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Module } from '@nestjs/common';

import type { AppConfig } from '../../../config/app-config';
import { APP_CONFIG } from '../../../config/app-config.token';
import { DYNAMODB_DOCUMENT_CLIENT } from '../../../shared/infrastructure/persistence/dynamodb-document-client.token';
import { GetProductStock } from '../application/get-product-stock.use-case';
import { GetProduct } from '../application/get-product.use-case';
import { ListProducts } from '../application/list-products.use-case';
import type { ProductRepository } from '../domain/product.repository.port';

import { ProductsController } from './http/products.controller';
import { DynamoDbProductRepository } from './persistence/dynamodb-product.repository';
import { PRODUCT_REPOSITORY } from './product-repository.token';

@Module({
  controllers: [ProductsController],
  providers: [
    {
      provide: PRODUCT_REPOSITORY,
      inject: [DYNAMODB_DOCUMENT_CLIENT, APP_CONFIG],
      useFactory: (client: DynamoDBDocumentClient, config: AppConfig): ProductRepository =>
        new DynamoDbProductRepository(client, config.tables.products),
    },
    {
      provide: ListProducts,
      inject: [PRODUCT_REPOSITORY, APP_CONFIG],
      useFactory: (products: ProductRepository, config: AppConfig) =>
        new ListProducts(products, config.catalog),
    },
    {
      provide: GetProduct,
      inject: [PRODUCT_REPOSITORY, APP_CONFIG],
      useFactory: (products: ProductRepository, config: AppConfig) =>
        new GetProduct(products, config.catalog),
    },
    {
      provide: GetProductStock,
      inject: [PRODUCT_REPOSITORY, APP_CONFIG],
      useFactory: (products: ProductRepository, config: AppConfig) =>
        new GetProductStock(products, config.catalog),
    },
  ],
  exports: [PRODUCT_REPOSITORY],
})
export class ProductsModule {}

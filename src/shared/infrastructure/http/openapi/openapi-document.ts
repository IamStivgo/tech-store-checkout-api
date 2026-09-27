import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

export const OPENAPI_TITLE = 'Tech Store Checkout API';

/**
 * Builds the OpenAPI contract from the controllers of a configured app (global prefix and
 * versioning applied). The web repository generates its types from this document.
 */
export const createOpenApiDocument = (app: INestApplication, version: string): OpenAPIObject =>
  SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(OPENAPI_TITLE)
      .setDescription(
        'Catalog, delivery coverage and checkout of a tech accessories store. Errors follow RFC 9457 Problem Details.',
      )
      .setVersion(version)
      .addServer('/', 'Same origin (CloudFront routes /api/* to the API)')
      .build(),
    { operationIdFactory: toOperationId },
  );

/** ProductsController#detail → productsDetail: short, stable names for generated clients. */
export const toOperationId = (controllerKey: string, methodKey: string): string => {
  const resource = controllerKey.replace(/Controller$/, '');
  return `${resource.charAt(0).toLowerCase()}${resource.slice(1)}${methodKey.charAt(0).toUpperCase()}${methodKey.slice(1)}`;
};

/** Stable JSON text of the contract, as committed in docs/openapi.json. */
export const serializeOpenApiDocument = (document: OpenAPIObject): string =>
  `${JSON.stringify(document, null, 2)}\n`;

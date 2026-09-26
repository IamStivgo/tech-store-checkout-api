import { z } from 'zod';

import { Money } from '../../../../shared/domain/money.vo';
import { PersistenceError } from '../../../../shared/domain/persistence-error';
import { err, type Result } from '../../../../shared/domain/result';
import { Product } from '../../domain/product.entity';
import { Stock } from '../../domain/stock.vo';

const imageSchema = z.object({
  basePath: z.string().min(1),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  formats: z.array(z.enum(['avif', 'webp', 'jpg'])).min(1),
});

const productItemSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  shortDescription: z.string(),
  description: z.string(),
  priceInCents: z.number(),
  currency: z.string(),
  stockAvailable: z.number(),
  stockReserved: z.number(),
  stockSold: z.number(),
  weightGrams: z.number(),
  images: z.tuple([imageSchema], imageSchema),
  active: z.boolean(),
  updatedAt: z.iso.datetime(),
});

const MAPPING_OPERATION = 'products.toDomain';

/** Items that do not match the model are corrupt data: an internal error, never a client error. */
export const toProduct = (item: Record<string, unknown>): Result<Product, PersistenceError> => {
  const parsed = productItemSchema.safeParse(item);

  if (!parsed.success) {
    return err(new PersistenceError(MAPPING_OPERATION, parsed.error));
  }

  const row = parsed.data;

  return Money.create(row.priceInCents, row.currency)
    .andThen((price) =>
      Stock.create({
        available: row.stockAvailable,
        reserved: row.stockReserved,
        sold: row.stockSold,
      }).map((stock) => ({ price, stock })),
    )
    .andThen(({ price, stock }) =>
      Product.create({
        id: row.productId,
        sku: row.sku,
        name: row.name,
        shortDescription: row.shortDescription,
        description: row.description,
        price,
        stock,
        weightGrams: row.weightGrams,
        images: row.images,
        active: row.active,
        updatedAt: new Date(row.updatedAt),
      }),
    )
    .mapErr((error) => new PersistenceError(MAPPING_OPERATION, error));
};

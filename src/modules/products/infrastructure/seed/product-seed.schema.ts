import { z } from 'zod';

import { productImagesSchema } from '../persistence/product-images.schema';

const productSeedSchema = z.object({
  productId: z.uuid({ version: 'v4' }),
  sku: z.string().regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/),
  name: z.string().min(1),
  shortDescription: z.string().min(1),
  description: z.string().min(1),
  priceInCents: z.number().int().positive(),
  weightGrams: z.number().int().positive(),
  initialStock: z.number().int().min(0),
  displayOrder: z.number().int().min(0),
  active: z.boolean(),
  images: productImagesSchema,
});

const hasUniqueValues = (values: readonly unknown[]): boolean =>
  new Set(values).size === values.length;

const catalogSeedSchema = z
  .array(productSeedSchema)
  .min(1)
  .refine((products) => hasUniqueValues(products.map((product) => product.productId)), {
    message: 'productId must be unique',
  })
  .refine((products) => hasUniqueValues(products.map((product) => product.sku)), {
    message: 'sku must be unique',
  })
  .refine((products) => hasUniqueValues(products.map((product) => product.displayOrder)), {
    message: 'displayOrder must be unique',
  });

export type ProductSeed = z.infer<typeof productSeedSchema>;

/** Validates the catalog seed file; throws with every problem found, since it is a script input. */
export const parseCatalogSeed = (data: unknown): ProductSeed[] => catalogSeedSchema.parse(data);

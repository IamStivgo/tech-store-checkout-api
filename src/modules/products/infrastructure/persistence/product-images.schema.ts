import { z } from 'zod';

const productImageSchema = z.object({
  basePath: z.string().min(1),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  formats: z.array(z.enum(['avif', 'webp', 'jpg'])).min(1),
});

/** Non-empty list: the first image is the main image of the product. */
export const productImagesSchema = z.tuple([productImageSchema], productImageSchema);

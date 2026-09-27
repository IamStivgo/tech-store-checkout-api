import { z } from 'zod';

import { DomainHttpException } from '../../../../shared/infrastructure/http/domain-http.exception';
import { toValidationError } from '../../../../shared/infrastructure/http/zod-validation-error';
import type { QuoteCheckoutCommand } from '../../application/quote-checkout.use-case';

const quoteQuerySchema = z.object({
  productId: z.uuidv4({ error: 'productId must be a UUID v4' }),
  quantity: z.coerce
    .number({ error: 'quantity must be a whole number of units' })
    .int({ error: 'quantity must be a whole number of units' })
    .min(1, { error: 'quantity must be at least 1' }),
  cityCode: z.string().regex(/^\d{5}$/, { error: 'cityCode must be a 5-digit DIVIPOLA code' }),
});

/** Parses the query string, answering 400 VALIDATION_ERROR with every invalid field. */
export const parseQuoteQuery = (query: Readonly<Record<string, unknown>>): QuoteCheckoutCommand => {
  const parsed = quoteQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw new DomainHttpException(toValidationError(parsed.error));
  }
  return parsed.data;
};

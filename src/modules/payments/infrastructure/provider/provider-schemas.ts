import { z } from 'zod';

import { PROVIDER_PAYMENT_STATUSES } from '../../domain/provider-payment';

const acceptanceSchema = z.object({ acceptance_token: z.string().min(1), permalink: z.url() });

export const merchantResponseSchema = z.object({
  data: z.object({
    presigned_acceptance: acceptanceSchema,
    presigned_personal_data_auth: acceptanceSchema,
  }),
});

export const tokenizationKeyResponseSchema = z.object({
  data: z.object({ publicKey: z.string().min(1) }),
});

export const transactionSchema = z.object({
  id: z.string().min(1),
  reference: z.string(),
  status: z.enum(PROVIDER_PAYMENT_STATUSES),
  amount_in_cents: z.number().int(),
  currency: z.string(),
  status_message: z.string().nullish(),
  payment_method: z
    .object({
      extra: z.object({ brand: z.string().nullish(), last_four: z.string().nullish() }).nullish(),
    })
    .nullish(),
});

export type ProviderTransaction = z.infer<typeof transactionSchema>;

export const transactionResponseSchema = z.object({ data: transactionSchema });

export const transactionListResponseSchema = z.object({ data: z.array(transactionSchema) });

/** `{ error: { type, messages: { field: [..] } } }`: the first field names what was rejected. */
export const providerErrorSchema = z.object({
  error: z.object({ messages: z.record(z.string(), z.unknown()).optional() }),
});

import { z } from 'zod';

import { DomainHttpException } from '../../../../shared/infrastructure/http/domain-http.exception';
import { toValidationError } from '../../../../shared/infrastructure/http/zod-validation-error';
import type { CreateTransactionCommand } from '../../application/create-transaction.use-case';
import type { ProcessPaymentCommand } from '../../application/process-payment.use-case';

const requiredText = (field: string) =>
  z.string({
    error: (issue) =>
      issue.input === undefined ? `${field} is required` : `${field} must be a string`,
  });
const optionalText = (field: string) => requiredText(field).nullish();

// Only the shape is checked here: the business rules live in the domain. Amounts are not part
// of the request, so a client that sends a total or a price gets 400 (api contract §4).
const createTransactionSchema = z.strictObject(
  {
    productId: z.uuidv4({ error: 'productId must be a UUID v4' }),
    quantity: z
      .number({ error: 'quantity must be a whole number of units' })
      .int({ error: 'quantity must be a whole number of units' })
      .min(1, { error: 'quantity must be at least 1' }),
    customerId: z.uuidv4({ error: 'customerId must be a UUID v4' }),
    shippingAddress: z.strictObject(
      {
        recipientName: requiredText('shippingAddress.recipientName'),
        phone: requiredText('shippingAddress.phone'),
        addressLine1: requiredText('shippingAddress.addressLine1'),
        addressLine2: optionalText('shippingAddress.addressLine2'),
        departmentCode: requiredText('shippingAddress.departmentCode'),
        cityCode: requiredText('shippingAddress.cityCode'),
        postalCode: optionalText('shippingAddress.postalCode'),
        notes: optionalText('shippingAddress.notes'),
      },
      { error: 'shippingAddress must be an object' },
    ),
  },
  { error: 'the request body must be a JSON object' },
);

// JSON Merge Patch with the only change allowed: cancelling.
const updateTransactionSchema = z.strictObject(
  { status: z.literal('CANCELLED', { error: 'status can only be changed to CANCELLED' }) },
  { error: 'the request body must be a JSON object' },
);

const MAX_TOKEN_LENGTH = 4096;
const JWT = /^[\w-]+\.[\w-]+\.[\w-]+$/;

const payTransactionSchema = z.strictObject(
  {
    cardToken: z
      .string({ error: 'cardToken is required' })
      .max(100, { error: 'cardToken must be a card token' })
      .regex(/^tok_\w+$/, { error: 'cardToken must be a card token' }),
    installments: z
      .number({ error: 'installments must be a whole number from 1 to 36' })
      .int({ error: 'installments must be a whole number from 1 to 36' })
      .min(1, { error: 'installments must be a whole number from 1 to 36' })
      .max(36, { error: 'installments must be a whole number from 1 to 36' }),
    acceptanceToken: z
      .string({ error: 'acceptanceToken is required' })
      .max(MAX_TOKEN_LENGTH, { error: 'acceptanceToken must be a signed token' })
      .regex(JWT, { error: 'acceptanceToken must be a signed token' }),
    personalDataAuthToken: z
      .string({ error: 'personalDataAuthToken is required' })
      .max(MAX_TOKEN_LENGTH, { error: 'personalDataAuthToken must be a signed token' })
      .regex(JWT, { error: 'personalDataAuthToken must be a signed token' }),
  },
  { error: 'the request body must be a JSON object' },
);

const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new DomainHttpException(toValidationError(parsed.error));
  }
  return parsed.data;
};

export const parseCreateTransactionBody = (body: unknown): CreateTransactionCommand =>
  parse(createTransactionSchema, body);

export const parseUpdateTransactionBody = (body: unknown): void => {
  parse(updateTransactionSchema, body);
};

export const parsePayTransactionBody = (
  transactionId: string,
  body: unknown,
): ProcessPaymentCommand => ({ transactionId, ...parse(payTransactionSchema, body) });

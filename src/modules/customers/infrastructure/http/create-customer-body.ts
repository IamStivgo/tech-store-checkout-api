import { z } from 'zod';

import { DomainHttpException } from '../../../../shared/infrastructure/http/domain-http.exception';
import { toValidationError } from '../../../../shared/infrastructure/http/zod-validation-error';
import type { CreateCustomerCommand } from '../../application/create-customer.use-case';

const requiredText = (field: string) =>
  z.string({
    error: (issue) =>
      issue.input === undefined ? `${field} is required` : `${field} must be a string`,
  });

// Only the shape is checked here; the business rules of each field live in the domain.
const createCustomerBodySchema = z.strictObject(
  {
    fullName: requiredText('fullName'),
    email: requiredText('email'),
    phone: requiredText('phone'),
    legalIdType: requiredText('legalIdType'),
    legalId: requiredText('legalId'),
  },
  { error: 'the request body must be a JSON object' },
);

/** Parses the body, answering 400 VALIDATION_ERROR for missing, mistyped or unknown fields. */
export const parseCreateCustomerBody = (body: unknown): CreateCustomerCommand => {
  const parsed = createCustomerBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainHttpException(toValidationError(parsed.error));
  }
  return parsed.data;
};

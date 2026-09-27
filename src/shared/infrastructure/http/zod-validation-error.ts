import type { z } from 'zod';

import { ValidationError, type FieldError } from '../../domain/validation-error';

const ROOT_FIELD = 'body';

const toFieldErrors = (issue: z.core.$ZodIssue): FieldError[] => {
  // Unknown fields are rejected by name, e.g. a client that tries to send the total.
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => ({ field: key, message: `${key} is not allowed` }));
  }
  return [{ field: issue.path.join('.') || ROOT_FIELD, message: issue.message }];
};

/** Maps every Zod issue to a field error of a 400 VALIDATION_ERROR. */
export const toValidationError = (error: z.ZodError): ValidationError =>
  new ValidationError(error.issues.flatMap(toFieldErrors));

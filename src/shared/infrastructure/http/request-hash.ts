import { createHash } from 'node:crypto';

// Object keys sorted at every level: `{a,b}` and `{b,a}` are the same request.
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : 1))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
};

/** SHA-256 (hex) of the canonical JSON of a request body; a missing body hashes as `null`. */
export const hashRequestBody = (body: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(canonicalize(body ?? null)))
    .digest('hex');

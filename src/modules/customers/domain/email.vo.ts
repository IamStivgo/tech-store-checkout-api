import { err, ok, type Result } from '../../../shared/domain/result';
import { ValidationError } from '../../../shared/domain/validation-error';

const MAX_LENGTH = 254;
// Pragmatic check (RFC 5321 length, one @, a dotted domain); delivery proves the rest.
const FORMAT = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export class Email {
  private constructor(readonly value: string) {}

  /** Trims and lowercases the address before validating it. */
  static create(raw: string): Result<Email, ValidationError> {
    const value = raw.trim().toLowerCase();

    if (value.length > MAX_LENGTH || !FORMAT.test(value)) {
      return err(ValidationError.forField('email', 'email must be a valid email address'));
    }
    return ok(new Email(value));
  }

  /** `ana.gomez@example.com` → `a***@example.com` */
  masked(): string {
    return `${this.value.charAt(0)}***${this.value.slice(this.value.indexOf('@'))}`;
  }
}

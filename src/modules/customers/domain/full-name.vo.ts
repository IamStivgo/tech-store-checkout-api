import { err, ok, type Result } from '../../../shared/domain/result';
import { ValidationError } from '../../../shared/domain/validation-error';

const FIELD = 'fullName';
const MIN_LENGTH = 3;
const MAX_LENGTH = 80;
const MIN_WORDS = 2;
// Letters in any script (with accents and ñ), spaces, apostrophes, hyphens and dots.
const ALLOWED_CHARACTERS = /^[\p{L}\p{M}' .-]+$/u;
const LETTER = /\p{L}/u;

const invalid = (message: string): Result<never, ValidationError> =>
  err(ValidationError.forField(FIELD, message));

export class FullName {
  private constructor(readonly value: string) {}

  /** Trims and collapses spaces; needs at least a first name and a last name. */
  static create(raw: string): Result<FullName, ValidationError> {
    const value = raw.normalize('NFC').trim().replace(/\s+/g, ' ');

    if (value.length < MIN_LENGTH || value.length > MAX_LENGTH) {
      return invalid(`fullName must have between ${MIN_LENGTH} and ${MAX_LENGTH} characters`);
    }
    if (!ALLOWED_CHARACTERS.test(value)) {
      return invalid('fullName may only contain letters, spaces, apostrophes, hyphens and dots');
    }
    if (value.split(' ').filter((word) => LETTER.test(word)).length < MIN_WORDS) {
      return invalid('fullName must include a first name and a last name');
    }
    return ok(new FullName(value));
  }

  /** `Ana María Gómez` → `Ana M. G.` */
  masked(): string {
    // A valid name always has a space: the first word stays, the others become initials.
    const firstSpace = this.value.indexOf(' ');
    const initials = this.value
      .slice(firstSpace + 1)
      .split(' ')
      .flatMap((word) => {
        const initial = LETTER.exec(word)?.[0];
        return initial ? [`${initial}.`] : [];
      });
    return [this.value.slice(0, firstSpace), ...initials].join(' ');
  }
}

export interface IdGenerator {
  /** Random UUID v4, used as public, non-guessable identifier. */
  uuid(): string;
  /** Random string in Crockford Base32 (0-9, A-Z without I, L, O, U). */
  randomBase32(length: number): string;
}

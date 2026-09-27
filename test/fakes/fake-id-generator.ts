import type { IdGenerator } from '../../src/shared/domain/id-generator.port';

/** Returns the given UUIDs in order (the last one repeats) and a fixed Base32 string. */
export class FakeIdGenerator implements IdGenerator {
  private next = 0;

  constructor(private readonly uuids: readonly [string, ...string[]]) {}

  uuid(): string {
    const uuid = this.uuids[Math.min(this.next, this.uuids.length - 1)] ?? this.uuids[0];
    this.next += 1;
    return uuid;
  }

  randomBase32(length: number): string {
    return 'A'.repeat(length);
  }
}

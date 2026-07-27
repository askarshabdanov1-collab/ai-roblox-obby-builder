import { createHash } from "node:crypto";

export const GENERATOR_PRNG_ALGORITHM = "mulberry32-v1" as const;

export function deriveDomainSeed(identity: string, domain: string): number {
  const digest = createHash("sha256")
    .update(
      `obby-generator-domain-v1\0${identity}\0${domain.normalize("NFC")}`,
      "utf8",
    )
    .digest();
  return digest.readUInt32BE(0);
}

export class DeterministicRandom {
  private state: number;

  public constructor(seed: number) {
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff)
      throw new RangeError("seed must be an unsigned 32-bit integer");
    this.state = seed >>> 0;
  }

  private uint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  }

  public integer(minimum: number, maximum: number): number {
    if (
      !Number.isSafeInteger(minimum) ||
      !Number.isSafeInteger(maximum) ||
      maximum < minimum
    )
      throw new RangeError("integer bounds must be ordered safe integers");
    const width = maximum - minimum + 1;
    if (width === 1) return minimum;
    if (width <= 0 || width > 0x1_0000_0000)
      throw new RangeError("integer range exceeds uint32 capacity");
    const limit = Math.floor(0x1_0000_0000 / width) * width;
    for (let attempt = 0; attempt < 128; attempt += 1) {
      const value = this.uint32();
      if (value < limit) return minimum + (value % width);
    }
    throw new Error(
      "bounded rejection sampling exhausted its deterministic work limit",
    );
  }

  public choose<T>(values: readonly T[]): T {
    if (values.length === 0)
      throw new RangeError("cannot choose from an empty sequence");
    return values[this.integer(0, values.length - 1)] as T;
  }
}

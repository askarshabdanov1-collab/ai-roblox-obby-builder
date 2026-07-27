import { DeterministicRandom, deriveDomainSeed } from "@obby/obby-generator";
import { describe, expect, it } from "vitest";

describe("deterministic random source", () => {
  it("repeats the same mulberry32-v1 sequence", () => {
    const first = new DeterministicRandom(
      deriveDomainSeed("sha256:" + "a".repeat(64), "stages"),
    );
    const second = new DeterministicRandom(
      deriveDomainSeed("sha256:" + "a".repeat(64), "stages"),
    );
    expect(Array.from({ length: 20 }, () => first.integer(0, 7))).toEqual(
      Array.from({ length: 20 }, () => second.integer(0, 7)),
    );
  });

  it("separates stage, mechanic, and hazard domains", () => {
    const identity = "sha256:" + "b".repeat(64);
    expect(
      new Set(
        ["stages", "mechanics", "hazards"].map((domain) =>
          deriveDomainSeed(identity, domain),
        ),
      ).size,
    ).toBe(3);
  });

  it("supports exact inclusive integer limits", () => {
    const random = new DeterministicRandom(1);
    expect(Array.from({ length: 10 }, () => random.integer(5, 5))).toEqual(
      Array(10).fill(5),
    );
    expect(() => random.integer(5, 4)).toThrow();
  });
});

import { describe, expect, it } from "vitest";

import { canonicalStringify, normalizeNumber, sha256 } from "../src/index.js";

describe("canonical JSON", () => {
  it("sorts object keys recursively while preserving array order", () => {
    expect(canonicalStringify({ z: 1, a: { y: 2, x: [3, 1] } })).toBe(
      '{"a":{"x":[3,1],"y":2},"z":1}',
    );
  });

  it("normalizes negative zero and rejects unsafe values", () => {
    expect(canonicalStringify({ value: -0 })).toBe('{"value":0}');
    expect(() => canonicalStringify({ value: Number.NaN })).toThrow();
    expect(() => canonicalStringify({ value: undefined })).toThrow();
    expect(normalizeNumber(1.23456789)).toBe(1.234568);
  });

  it("produces stable SHA-256 identifiers", () => {
    expect(sha256({ b: 2, a: 1 })).toBe(sha256({ a: 1, b: 2 }));
    expect(sha256({ a: 1 })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

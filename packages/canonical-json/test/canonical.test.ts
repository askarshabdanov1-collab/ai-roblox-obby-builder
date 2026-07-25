import { describe, expect, it } from "vitest";

import {
  canonicalBytes,
  canonicalStringify,
  normalizeNumber,
  sha256,
  sortSemanticSet,
} from "../src/index.js";

describe("canonical JSON", () => {
  it("sorts object keys recursively while preserving array order", () => {
    expect(canonicalStringify({ z: 1, a: { y: 2, x: [3, 1] } })).toBe(
      '{"a":{"x":[3,1],"y":2},"z":1}',
    );
  });

  it("normalizes negative zero and rejects unsafe values", () => {
    expect(canonicalStringify({ value: -0 })).toBe('{"value":0}');
    expect(() => canonicalStringify({ value: Number.NaN })).toThrow();
    expect(() =>
      canonicalStringify({ value: Number.POSITIVE_INFINITY }),
    ).toThrow();
    expect(() => canonicalStringify({ value: undefined })).toThrow();
    expect(() => canonicalStringify({ value: 1n })).toThrow();
    expect(() => canonicalStringify({ value: Symbol("invalid") })).toThrow();
    expect(() => canonicalStringify({ value: () => undefined })).toThrow();
    expect(normalizeNumber(1.23456789)).toBe(1.234568);
  });

  it("normalizes Unicode strings and keys to NFC", () => {
    expect(canonicalStringify({ value: "e\u0301" })).toBe('{"value":"é"}');
    expect(canonicalStringify({ "e\u0301": 1 })).toBe('{"é":1}');
    expect(() => canonicalStringify({ é: 1, "e\u0301": 2 })).toThrow(
      /normalization makes object keys duplicate/i,
    );
  });

  it("preserves semantic arrays and sorts only declared semantic sets", () => {
    expect(canonicalStringify({ route: ["b", "a"] })).toBe(
      '{"route":["b","a"]}',
    );
    expect(sortSemanticSet(["b", "a"], (value) => value)).toEqual(["a", "b"]);
    expect(() =>
      sortSemanticSet(
        [
          { id: "same", value: 1 },
          { id: "same", value: 2 },
        ],
        (value) => value.id,
      ),
    ).toThrow(/duplicate semantic-set key/i);
  });

  it("handles nested null and absent fields explicitly", () => {
    expect(canonicalStringify({ present: null, nested: [{ ok: true }] })).toBe(
      '{"nested":[{"ok":true}],"present":null}',
    );
    expect(canonicalStringify({})).toBe("{}");
    expect(() => canonicalStringify({ absent: undefined })).toThrow();
    const sparse = Array<number>(2);
    sparse[1] = 1;
    expect(() => canonicalStringify(sparse)).toThrow(/sparse/i);
  });

  it("normalizes exponent spelling and emits deterministic UTF-8 bytes", () => {
    expect(
      canonicalStringify({
        fixedShorter: 1.25,
        large: 1e21,
        small: 1e-7,
        exponentialShorter: 100_000,
      }),
    ).toBe(
      '{"exponentialShorter":1e5,"fixedShorter":1.25,"large":1e21,"small":1e-7}',
    );
    expect([...canonicalBytes({ value: "é" })]).toEqual([
      123, 34, 118, 97, 108, 117, 101, 34, 58, 34, 195, 169, 34, 125,
    ]);
  });

  it("produces stable SHA-256 identifiers", () => {
    expect(sha256({ b: 2, a: 1 })).toBe(sha256({ a: 1, b: 2 }));
    expect(sha256({ a: 1 })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

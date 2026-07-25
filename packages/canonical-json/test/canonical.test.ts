import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  CanonicalJsonValidationError,
  canonicalStringify,
  evaluatorCanonicalize,
  canonicalizeEvaluatorSnapshot,
  snapshotEvaluatorInput,
  evaluatorCanonicalStringify,
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

  it("normalizes Unicode strings and keys to NFC in evaluator v1", () => {
    expect(evaluatorCanonicalStringify({ value: "e\u0301" })).toBe(
      '{"value":"é"}',
    );
    expect(evaluatorCanonicalStringify({ "e\u0301": 1 })).toBe('{"é":1}');
    expect(() => evaluatorCanonicalStringify({ é: 1, "e\u0301": 2 })).toThrow(
      /normalized-key collision/i,
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
    expect(() => evaluatorCanonicalStringify(sparse)).toThrow(/sparse/i);
  });

  it("normalizes exponent spelling and emits deterministic UTF-8 bytes", () => {
    expect(
      evaluatorCanonicalStringify({
        fixedShorter: 1.25,
        large: 1e21,
        small: 1e-7,
        exponentialShorter: 100_000,
      }),
    ).toBe(
      '{"exponentialShorter":1e5,"fixedShorter":1.25,"large":1e21,"small":1e-7}',
    );
    expect([
      ...new TextEncoder().encode(evaluatorCanonicalStringify({ value: "é" })),
    ]).toEqual([
      123, 34, 118, 97, 108, 117, 101, 34, 58, 34, 195, 169, 34, 125,
    ]);
  });

  it("produces stable SHA-256 identifiers", () => {
    expect(sha256({ b: 2, a: 1 })).toBe(sha256({ a: 1, b: 2 }));
    expect(sha256({ a: 1 })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("obby-canonical-json-v1 trusted snapshot", () => {
  it("separates descriptor snapshotting from canonical serialization", () => {
    const trusted = snapshotEvaluatorInput({
      value: "e\u0301",
      nested: [1, -0],
    });
    expect(trusted).toEqual({ nested: [1, 0], value: "\u00e9" });
    const canonical = canonicalizeEvaluatorSnapshot(trusted);
    expect(canonical.canonicalText).toBe('{"nested":[1,0],"value":"\u00e9"}');
    expect(new TextDecoder().decode(canonical.canonicalBytes)).toBe(
      canonical.canonicalText,
    );
  });
  it("preserves the committed Phase 0 serializer and hash identity", async () => {
    const fixture = JSON.parse(
      await readFile(
        new URL("../fixtures/phase0-identities.json", import.meta.url),
        "utf8",
      ),
    ) as { canonicalText: string; sha256: string };
    const value = { exponential: 100_000, unicode: "e\u0301" };
    expect(canonicalStringify(value)).toBe(fixture.canonicalText);
    expect(sha256(value)).toBe(fixture.sha256);
  });

  it("snapshots accessors once and hashes the exact returned bytes", () => {
    let reads = 0;
    const value = {};
    Object.defineProperty(value, "changing", {
      enumerable: true,
      get: () => {
        reads += 1;
        return reads;
      },
    });
    expect(() => evaluatorCanonicalize(value)).toThrow(
      /accessor properties are not supported/i,
    );
    expect(reads).toBe(0);
  });

  it.each([
    ["Date", new Date("2030-01-01T00:00:00Z")],
    ["Map", new Map([["a", 1]])],
    ["Set", new Set(["a"])],
    ["typed array", new Uint8Array([1, 2])],
    [
      "class instance",
      new (class Example {
        public readonly value = 1;
      })(),
    ],
  ])("rejects %s host objects", (_name, value) => {
    expect(() => evaluatorCanonicalStringify(value)).toThrow(
      CanonicalJsonValidationError,
    );
  });

  it("rejects symbols, inherited enumerable data, and trap failures", () => {
    const symbolValue = { ok: true, [Symbol("hidden")]: 1 };
    expect(() => evaluatorCanonicalStringify(symbolValue)).toThrow(/symbol/i);

    const inherited = Object.create({ inherited: true }) as Record<
      string,
      unknown
    >;
    inherited.own = true;
    expect(() => evaluatorCanonicalStringify(inherited)).toThrow(/prototype/i);

    const trapped = new Proxy(
      { ok: true },
      {
        ownKeys() {
          throw new Error("trap");
        },
      },
    );
    expect(() => evaluatorCanonicalStringify(trapped)).toThrow(
      CanonicalJsonValidationError,
    );
  });

  it("rejects normalized key collisions and orders astral Unicode scalars", () => {
    expect(() => evaluatorCanonicalStringify({ é: 1, "e\u0301": 2 })).toThrow(
      /normalized-key collision/i,
    );
    expect(evaluatorCanonicalStringify({ "\u{1F600}": 1, "\uE000": 2 })).toBe(
      '{"":2,"😀":1}',
    );
    expect(evaluatorCanonicalStringify({ value: "e\u0301" })).toBe(
      '{"value":"é"}',
    );
  });

  it("enforces depth, property, array, node, and byte limits at boundaries", () => {
    expect(evaluatorCanonicalStringify({ a: { b: 1 } }, { maxDepth: 2 })).toBe(
      '{"a":{"b":1}}',
    );
    expect(() =>
      evaluatorCanonicalStringify({ a: { b: { c: 1 } } }, { maxDepth: 2 }),
    ).toThrow(/maximum nesting depth/i);
    expect(
      evaluatorCanonicalStringify({ a: 1, b: 2 }, { maxObjectProperties: 2 }),
    ).toBe('{"a":1,"b":2}');
    expect(() =>
      evaluatorCanonicalStringify(
        { a: 1, b: 2, c: 3 },
        { maxObjectProperties: 2 },
      ),
    ).toThrow(/object property count/i);
    expect(evaluatorCanonicalStringify([1, 2], { maxArrayLength: 2 })).toBe(
      "[1,2]",
    );
    expect(() =>
      evaluatorCanonicalStringify([1, 2, 3], { maxArrayLength: 2 }),
    ).toThrow(/array length/i);
    expect(evaluatorCanonicalStringify([1, 2], { maxTotalNodes: 3 })).toBe(
      "[1,2]",
    );
    expect(() =>
      evaluatorCanonicalStringify([1, 2], { maxTotalNodes: 2 }),
    ).toThrow(/visited node/i);
    expect(evaluatorCanonicalStringify("é", { maxCanonicalBytes: 4 })).toBe(
      '"é"',
    );
    expect(() =>
      evaluatorCanonicalStringify("é", { maxCanonicalBytes: 3 }),
    ).toThrow(/canonical byte length/i);
  });
});

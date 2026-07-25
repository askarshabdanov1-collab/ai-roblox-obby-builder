import { createHash } from "node:crypto";

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const textEncoder = new TextEncoder();

// Phase 0 compatibility API: preserve @obby/canonical-json 0.2.0 exactly.
function legacySerialize(value: unknown, ancestors: Set<object>): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not support non-finite numbers");
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value !== "object") {
    throw new TypeError(`Canonical JSON does not support ${typeof value}`);
  }
  if (ancestors.has(value)) {
    throw new TypeError("Canonical JSON does not support cyclic values");
  }
  ancestors.add(value);
  let result: string;
  if (Array.isArray(value)) {
    result = `[${value
      .map((entry) => legacySerialize(entry, ancestors))
      .join(",")}]`;
  } else {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical JSON only supports plain objects");
    }
    const record = value as Record<string, unknown>;
    result = `{${Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${legacySerialize(record[key], ancestors)}`,
      )
      .join(",")}}`;
  }
  ancestors.delete(value);
  return result;
}

export function canonicalStringify(value: unknown): string {
  return legacySerialize(value, new Set());
}

export function canonicalBytes(value: unknown): Uint8Array {
  return textEncoder.encode(canonicalStringify(value));
}

export function sha256(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(canonicalStringify(value), "utf8")
    .digest("hex")}`;
}

export const EVALUATOR_CANONICAL_JSON_ALGORITHM = "obby-canonical-json-v1";

export type EvaluatorCanonicalLimits = {
  maxDepth: number;
  maxObjectProperties: number;
  maxArrayLength: number;
  maxTotalNodes: number;
  maxCanonicalBytes: number;
};

export const DEFAULT_EVALUATOR_CANONICAL_LIMITS: Readonly<EvaluatorCanonicalLimits> =
  Object.freeze({
    maxDepth: 64,
    maxObjectProperties: 4_096,
    maxArrayLength: 100_000,
    maxTotalNodes: 200_000,
    maxCanonicalBytes: 16 * 1024 * 1024,
  });

export type CanonicalJsonErrorCode =
  | "unsupported-value"
  | "unexpected-prototype"
  | "accessor-property"
  | "symbol-key"
  | "inherited-enumerable-property"
  | "sparse-array"
  | "array-property"
  | "cycle"
  | "normalized-key-collision"
  | "maximum-depth"
  | "maximum-properties"
  | "maximum-array-length"
  | "maximum-nodes"
  | "maximum-bytes"
  | "descriptor-inspection-failed";

export class CanonicalJsonValidationError extends TypeError {
  public constructor(
    public readonly code: CanonicalJsonErrorCode,
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = "CanonicalJsonValidationError";
  }
}

type SnapshotContext = {
  limits: EvaluatorCanonicalLimits;
  nodes: number;
  ancestors: Set<object>;
};

function compareUnicodeScalars(left: string, right: string): number {
  const leftPoints = Array.from(left, (part) => part.codePointAt(0) ?? 0);
  const rightPoints = Array.from(right, (part) => part.codePointAt(0) ?? 0);
  for (
    let index = 0;
    index < Math.min(leftPoints.length, rightPoints.length);
    index += 1
  ) {
    const difference = (leftPoints[index] ?? 0) - (rightPoints[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

function fail(
  code: CanonicalJsonErrorCode,
  path: string,
  message: string,
): never {
  throw new CanonicalJsonValidationError(code, path, message);
}

function propertyPath(path: string, key: string): string {
  return `${path === "/" ? "" : path}/${key
    .replaceAll("~", "~0")
    .replaceAll("/", "~1")}`;
}

function ownKeys(value: object, path: string): PropertyKey[] {
  try {
    return Reflect.ownKeys(value);
  } catch {
    return fail(
      "descriptor-inspection-failed",
      path,
      "deterministic own-property inspection failed",
    );
  }
}

function descriptor(
  value: object,
  key: PropertyKey,
  path: string,
): PropertyDescriptor {
  try {
    const result = Object.getOwnPropertyDescriptor(value, key);
    if (result !== undefined) return result;
  } catch {
    // Converted to the stable error below.
  }
  return fail(
    "descriptor-inspection-failed",
    path,
    "property changed or descriptor inspection failed during snapshot",
  );
}

function assertPrototype(value: object, path: string): void {
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
  } catch {
    return fail(
      "descriptor-inspection-failed",
      path,
      "prototype inspection failed",
    );
  }
  if (
    prototype !== null &&
    prototype !== Object.prototype &&
    !(Array.isArray(value) && prototype === Array.prototype)
  ) {
    fail(
      "unexpected-prototype",
      path,
      "only dense arrays and plain objects with standard or null prototypes are supported",
    );
  }
  for (let current = prototype; current !== null;) {
    for (const key of ownKeys(current, path)) {
      if (descriptor(current, key, path).enumerable) {
        fail(
          "inherited-enumerable-property",
          path,
          `inherited enumerable property ${String(key)} is not supported`,
        );
      }
    }
    try {
      current = Object.getPrototypeOf(current) as object | null;
    } catch {
      return fail(
        "descriptor-inspection-failed",
        path,
        "prototype-chain inspection failed",
      );
    }
  }
}

function snapshot(
  value: unknown,
  path: string,
  depth: number,
  context: SnapshotContext,
): JsonValue {
  if (depth > context.limits.maxDepth) {
    fail("maximum-depth", path, "maximum nesting depth exceeded");
  }
  context.nodes += 1;
  if (context.nodes > context.limits.maxTotalNodes) {
    fail("maximum-nodes", path, "maximum visited node count exceeded");
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return value.normalize("NFC");
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("unsupported-value", path, "non-finite numbers are not supported");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") {
    return fail(
      "unsupported-value",
      path,
      `${typeof value} values are not supported`,
    );
  }

  assertPrototype(value, path);
  if (context.ancestors.has(value)) {
    fail("cycle", path, "cyclic values are not supported");
  }
  context.ancestors.add(value);
  try {
    const keys = ownKeys(value, path);
    for (const key of keys) {
      if (typeof key === "symbol") {
        fail("symbol-key", path, "symbol-keyed properties are not supported");
      }
    }

    if (Array.isArray(value)) {
      const lengthProperty = descriptor(value, "length", `${path}/length`);
      const lengthValue: unknown = lengthProperty.value;
      if (
        "get" in lengthProperty ||
        "set" in lengthProperty ||
        typeof lengthValue !== "number" ||
        !Number.isSafeInteger(lengthValue) ||
        lengthValue < 0
      ) {
        fail(
          "descriptor-inspection-failed",
          `${path}/length`,
          "array length is not a stable non-negative data property",
        );
      }
      const length = lengthValue;
      if (length > context.limits.maxArrayLength) {
        fail("maximum-array-length", path, "maximum array length exceeded");
      }
      const entries: JsonValue[] = [];
      const expected = new Set([
        ...Array.from({ length }, (_, index) => String(index)),
        "length",
      ]);
      for (const key of keys) {
        if (typeof key === "string" && !expected.has(key)) {
          const item = descriptor(value, key, propertyPath(path, key));
          if (item.enumerable) {
            fail(
              "array-property",
              propertyPath(path, key),
              "extra enumerable array properties are not supported",
            );
          }
        }
      }
      for (let index = 0; index < length; index += 1) {
        const key = String(index);
        if (!keys.includes(key)) {
          fail(
            "sparse-array",
            `${path}/${index}`,
            "sparse arrays are not supported",
          );
        }
        const item = descriptor(value, key, `${path}/${index}`);
        if ("get" in item || "set" in item) {
          fail(
            "accessor-property",
            `${path}/${index}`,
            "accessor properties are not supported",
          );
        }
        entries.push(
          snapshot(item.value, `${path}/${index}`, depth + 1, context),
        );
      }
      return Object.freeze(entries) as JsonValue[];
    }

    const enumerableEntries: (readonly [string, PropertyDescriptor])[] = [];
    for (const key of keys) {
      if (typeof key !== "string") continue;
      const item = descriptor(value, key, propertyPath(path, key));
      if (item.enumerable) enumerableEntries.push([key, item]);
    }
    if (enumerableEntries.length > context.limits.maxObjectProperties) {
      fail(
        "maximum-properties",
        path,
        "maximum object property count exceeded",
      );
    }
    const normalized = new Map<string, { original: string; value: unknown }>();
    for (const [key, item] of enumerableEntries) {
      if ("get" in item || "set" in item) {
        fail(
          "accessor-property",
          propertyPath(path, key),
          "accessor properties are not supported",
        );
      }
      const normalizedKey = key.normalize("NFC");
      if (normalized.has(normalizedKey)) {
        fail(
          "normalized-key-collision",
          path,
          `normalized-key collision for ${JSON.stringify(normalizedKey)}`,
        );
      }
      normalized.set(normalizedKey, { original: key, value: item.value });
    }
    const result: Record<string, JsonValue> = Object.create(null) as Record<
      string,
      JsonValue
    >;
    for (const [key, item] of [...normalized].sort(([left], [right]) =>
      compareUnicodeScalars(left, right),
    )) {
      result[key] = snapshot(
        item.value,
        propertyPath(path, item.original),
        depth + 1,
        context,
      );
    }
    return Object.freeze(result);
  } finally {
    context.ancestors.delete(value);
  }
}

function evaluatorNumber(value: number): string {
  const candidates = [JSON.stringify(value), value.toExponential()].map(
    (serialized) => {
      const exponentIndex = serialized.indexOf("e");
      if (exponentIndex === -1) return serialized;
      return `${serialized.slice(0, exponentIndex)}e${Number(
        serialized.slice(exponentIndex + 1),
      )}`;
    },
  );
  const shortest = candidates.sort(
    (left, right) =>
      left.length - right.length || (left < right ? -1 : left > right ? 1 : 0),
  )[0];
  if (shortest === undefined) {
    return fail(
      "unsupported-value",
      "/",
      "canonical number serialization failed",
    );
  }
  return shortest;
}

function serializeSnapshot(value: JsonValue): string {
  if (value === null || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return evaluatorNumber(value);
  if (Array.isArray(value)) {
    return `[${value.map(serializeSnapshot).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort(compareUnicodeScalars)
    .map((key) => {
      const entry = value[key];
      if (entry === undefined) {
        return fail(
          "descriptor-inspection-failed",
          propertyPath("/", key),
          "trusted snapshot unexpectedly lost a property",
        );
      }
      return `${JSON.stringify(key)}:${serializeSnapshot(entry)}`;
    })
    .join(",")}}`;
}

export type EvaluatorCanonicalResult = {
  snapshot: JsonValue;
  canonicalText: string;
  canonicalBytes: Uint8Array;
};

export function evaluatorCanonicalize(
  value: unknown,
  limits: Partial<EvaluatorCanonicalLimits> = {},
): EvaluatorCanonicalResult {
  const resolved = { ...DEFAULT_EVALUATOR_CANONICAL_LIMITS, ...limits };
  for (const [name, limit] of Object.entries(resolved)) {
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new CanonicalJsonValidationError(
        "unsupported-value",
        "/",
        `${name} must be a non-negative safe integer`,
      );
    }
  }
  const trusted = snapshot(value, "/", 0, {
    limits: resolved,
    nodes: 0,
    ancestors: new Set(),
  });
  const canonicalText = serializeSnapshot(trusted);
  const resultBytes = textEncoder.encode(canonicalText);
  if (resultBytes.byteLength > resolved.maxCanonicalBytes) {
    fail("maximum-bytes", "/", "maximum canonical byte length exceeded");
  }
  return { snapshot: trusted, canonicalText, canonicalBytes: resultBytes };
}

export function evaluatorCanonicalStringify(
  value: unknown,
  limits?: Partial<EvaluatorCanonicalLimits>,
): string {
  return evaluatorCanonicalize(value, limits).canonicalText;
}

export function evaluatorCanonicalBytes(
  value: unknown,
  limits?: Partial<EvaluatorCanonicalLimits>,
): Uint8Array {
  return evaluatorCanonicalize(value, limits).canonicalBytes;
}

export function sha256Bytes(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function sortSemanticSet<T>(
  values: readonly T[],
  stableKey: (value: T) => string,
): T[] {
  const keyed = values.map((value) => ({
    key: stableKey(value).normalize("NFC"),
    value,
  }));
  const seen = new Set<string>();
  for (const entry of keyed) {
    if (seen.has(entry.key)) {
      throw new TypeError(`Duplicate semantic-set key: ${entry.key}`);
    }
    seen.add(entry.key);
  }
  return keyed
    .sort((left, right) => compareUnicodeScalars(left.key, right.key))
    .map((entry) => entry.value);
}

export function normalizeNumber(value: number, precision = 6): number {
  if (!Number.isFinite(value)) {
    throw new TypeError("Cannot normalize a non-finite number");
  }
  const normalized = Number(value.toFixed(precision));
  return Object.is(normalized, -0) ? 0 : normalized;
}

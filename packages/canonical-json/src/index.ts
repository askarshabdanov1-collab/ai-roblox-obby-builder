import { createHash } from "node:crypto";

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const textEncoder = new TextEncoder();

function compareUnicodeScalarValues(left: string, right: string): number {
  const leftPoints = Array.from(left, (value) => value.codePointAt(0) ?? 0);
  const rightPoints = Array.from(right, (value) => value.codePointAt(0) ?? 0);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftPoints[index] ?? 0) - (rightPoints[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

function serializeNumber(value: number): string {
  if (!Number.isFinite(value))
    throw new TypeError("Canonical JSON does not support non-finite numbers");
  if (Object.is(value, -0)) return "0";
  const fixed = JSON.stringify(value);
  const exponential = value.toExponential();
  const candidates = [fixed, exponential].map((serialized) => {
    const exponentIndex = serialized.indexOf("e");
    if (exponentIndex === -1) return serialized;
    const mantissa = serialized.slice(0, exponentIndex);
    const exponent = Number(serialized.slice(exponentIndex + 1));
    return `${mantissa}e${exponent}`;
  });
  const shortest = candidates.sort(
    (left, right) =>
      left.length - right.length || (left < right ? -1 : left > right ? 1 : 0),
  )[0];
  if (shortest === undefined) {
    throw new TypeError("Canonical number serialization failed");
  }
  return shortest;
}

function serialize(value: unknown, ancestors: Set<object>): string {
  if (value === null || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));

  if (typeof value === "number") {
    return serializeNumber(value);
  }

  if (typeof value !== "object") {
    throw new TypeError(`Canonical JSON does not support ${typeof value}`);
  }

  if (ancestors.has(value))
    throw new TypeError("Canonical JSON does not support cyclic values");
  ancestors.add(value);

  let result: string;
  if (Array.isArray(value)) {
    const entries: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value))
        throw new TypeError("Canonical JSON does not support sparse arrays");
      entries.push(serialize(value[index], ancestors));
    }
    result = `[${entries.join(",")}]`;
  } else {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical JSON only supports plain objects");
    }
    const record = value as Record<string, unknown>;
    const normalizedKeys = new Map<string, string>();
    for (const key of Object.keys(record)) {
      const normalized = key.normalize("NFC");
      if (normalizedKeys.has(normalized)) {
        throw new TypeError(
          "Unicode normalization makes object keys duplicate",
        );
      }
      normalizedKeys.set(normalized, key);
    }
    const entries = [...normalizedKeys]
      .sort(([left], [right]) => compareUnicodeScalarValues(left, right))
      .map(
        ([normalized, original]) =>
          `${JSON.stringify(normalized)}:${serialize(record[original], ancestors)}`,
      );
    result = `{${entries.join(",")}}`;
  }

  ancestors.delete(value);
  return result;
}

export function canonicalStringify(value: unknown): string {
  return serialize(value, new Set());
}

export function canonicalBytes(value: unknown): Uint8Array {
  return textEncoder.encode(canonicalStringify(value));
}

export function sha256(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalBytes(value)).digest("hex")}`;
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
    if (seen.has(entry.key))
      throw new TypeError(`Duplicate semantic-set key: ${entry.key}`);
    seen.add(entry.key);
  }
  return keyed
    .sort((left, right) => compareUnicodeScalarValues(left.key, right.key))
    .map((entry) => entry.value);
}

export function normalizeNumber(value: number, precision = 6): number {
  if (!Number.isFinite(value))
    throw new TypeError("Cannot normalize a non-finite number");
  const normalized = Number(value.toFixed(precision));
  return Object.is(normalized, -0) ? 0 : normalized;
}

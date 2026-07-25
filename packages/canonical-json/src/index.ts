import { createHash } from "node:crypto";

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function serialize(value: unknown, ancestors: Set<object>): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError("Canonical JSON does not support non-finite numbers");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }

  if (typeof value !== "object") {
    throw new TypeError(`Canonical JSON does not support ${typeof value}`);
  }

  if (ancestors.has(value))
    throw new TypeError("Canonical JSON does not support cyclic values");
  ancestors.add(value);

  let result: string;
  if (Array.isArray(value)) {
    result = `[${value.map((entry) => serialize(entry, ancestors)).join(",")}]`;
  } else {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical JSON only supports plain objects");
    }
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${serialize(record[key], ancestors)}`,
      );
    result = `{${entries.join(",")}}`;
  }

  ancestors.delete(value);
  return result;
}

export function canonicalStringify(value: unknown): string {
  return serialize(value, new Set());
}

export function sha256(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalStringify(value), "utf8").digest("hex")}`;
}

export function normalizeNumber(value: number, precision = 6): number {
  if (!Number.isFinite(value))
    throw new TypeError("Cannot normalize a non-finite number");
  const normalized = Number(value.toFixed(precision));
  return Object.is(normalized, -0) ? 0 : normalized;
}

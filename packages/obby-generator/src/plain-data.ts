import { isProxy } from "node:util/types";

import { GeneratorContractError } from "@obby/obby-generator-contracts";

const MAX_PLAIN_ARRAY_ITEMS = 1_024;

function structuralError(label: string, detail: string): never {
  throw new GeneratorContractError(
    "validation",
    `${label} is not accepted plain data: ${detail}`,
  );
}

function assertNonProxyObject(
  input: unknown,
  label: string,
): asserts input is object {
  if (input === null || typeof input !== "object")
    structuralError(label, "an object is required");
  if (isProxy(input)) structuralError(label, "Proxy objects are prohibited");
}

export function plainDataRecord(
  input: unknown,
  label: string,
): Record<string, unknown> {
  assertNonProxyObject(input, label);
  if (Array.isArray(input))
    structuralError(label, "an object, not an array, is required");
  const prototype = Object.getPrototypeOf(input) as object | null;
  if (prototype !== Object.prototype && prototype !== null)
    structuralError(label, "custom and inherited prototypes are prohibited");
  return input as Record<string, unknown>;
}

export function ownDataValue(
  input: Record<string, unknown>,
  key: string,
  label: string,
  required = true,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (descriptor === undefined) {
    const prototype = Object.getPrototypeOf(input) as object | null;
    if (
      prototype !== null &&
      Object.getOwnPropertyDescriptor(Object.prototype, key) !== undefined
    )
      structuralError(label, `${key} must not be inherited`);
    if (required)
      structuralError(label, `own data property ${key} is required`);
    return undefined;
  }
  if (!("value" in descriptor))
    structuralError(label, `accessor property ${key} is prohibited`);
  return descriptor.value;
}

export function plainArrayLength(input: unknown, label: string): number {
  assertNonProxyObject(input, label);
  if (!Array.isArray(input)) structuralError(label, "an array is required");
  if (Object.getPrototypeOf(input) !== Array.prototype)
    structuralError(
      label,
      "array subclasses and custom prototypes are prohibited",
    );
  const lengthDescriptor = Object.getOwnPropertyDescriptor(input, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    (lengthDescriptor.value as number) < 0
  )
    structuralError(
      label,
      "array length must be an own safe-integer data property",
    );
  return lengthDescriptor.value as number;
}

function snapshotArray(
  input: unknown[],
  label: string,
  active: WeakSet<object>,
): unknown[] {
  const length = plainArrayLength(input, label);
  if (length > MAX_PLAIN_ARRAY_ITEMS)
    structuralError(label, `array length exceeds ${MAX_PLAIN_ARRAY_ITEMS}`);
  const keys = Reflect.ownKeys(input);
  if (keys.some((key) => typeof key === "symbol"))
    structuralError(label, "symbol properties are prohibited");
  if (keys.length !== length + 1)
    structuralError(
      label,
      "sparse arrays and custom properties are prohibited",
    );
  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    )
      structuralError(
        label,
        `array index ${key} must be an enumerable data property`,
      );
    snapshot.push(
      snapshotPlainData(descriptor.value, `${label}[${key}]`, active),
    );
  }
  return snapshot;
}

function snapshotRecord(
  input: Record<string, unknown>,
  label: string,
  active: WeakSet<object>,
): Record<string, unknown> {
  const snapshot: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key === "symbol")
      structuralError(label, "symbol properties are prohibited");
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    )
      structuralError(label, `${key} must be an enumerable data property`);
    snapshot[key] = snapshotPlainData(
      descriptor.value,
      `${label}.${key}`,
      active,
    );
  }
  return snapshot;
}

export function snapshotPlainData(
  input: unknown,
  label: string,
  active = new WeakSet<object>(),
): unknown {
  if (
    input === null ||
    typeof input === "string" ||
    typeof input === "boolean" ||
    typeof input === "number"
  )
    return input;
  if (typeof input !== "object")
    structuralError(
      label,
      "only JSON-compatible primitive and container values are accepted",
    );
  assertNonProxyObject(input, label);
  if (active.has(input)) structuralError(label, "cycles are prohibited");
  active.add(input);
  try {
    if (Array.isArray(input)) return snapshotArray(input, label, active);
    return snapshotRecord(plainDataRecord(input, label), label, active);
  } finally {
    active.delete(input);
  }
}

import { assertValidSceneManifest, type SceneManifest } from "@obby/contracts";

function indent(level: number): string {
  return " ".repeat(level * 4);
}

function emitValue(value: unknown, level: number): string {
  if (value === null) return "nil";
  if (typeof value === "boolean" || typeof value === "number")
    return String(value);
  if (typeof value === "string") return JSON.stringify(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "{}";
    const entries = value.map(
      (entry) => `${indent(level + 1)}${emitValue(entry, level + 1)},`,
    );
    return `{\n${entries.join("\n")}\n${indent(level)}}`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${indent(level + 1)}[${JSON.stringify(key)}] = ${emitValue(record[key], level + 1)},`,
      );
    if (entries.length === 0) return "{}";
    return `{\n${entries.join("\n")}\n${indent(level)}}`;
  }

  throw new TypeError(`Cannot emit ${typeof value} to Luau`);
}

export function emitManifestModule(input: unknown): string {
  const manifest: SceneManifest = assertValidSceneManifest(input);
  return [
    "-- This file is generated from examples/vertical-slice/place-spec.json.",
    "-- Do not edit it by hand; run `npm run fixtures:generate`.",
    `return ${emitValue(manifest, 0)}`,
    "",
  ].join("\n");
}

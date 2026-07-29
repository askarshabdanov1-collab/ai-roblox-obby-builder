import {
  assertValidSceneManifestV03,
  type SceneManifestV03,
} from "@obby/contracts";

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
    return `{
${value.map((entry) => `${indent(level + 1)}${emitValue(entry, level + 1)},`).join("\n")}
${indent(level)}}`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${indent(level + 1)}[${JSON.stringify(key)}] = ${emitValue(record[key], level + 1)},`,
      );
    return entries.length === 0
      ? "{}"
      : `{
${entries.join("\n")}
${indent(level)}}`;
  }
  throw new TypeError(`Cannot emit ${typeof value} to Luau`);
}

export function emitManifestModuleV03(input: unknown): string {
  const manifest: SceneManifestV03 = assertValidSceneManifestV03(input);
  return [
    "-- Generated SceneManifest 0.3 validation transport.",
    "-- Runtime construction is intentionally not enabled in Phase G1c.",
    `return ${emitValue(manifest, 0)}`,
    "",
  ].join("\n");
}

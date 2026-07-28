import {
  EVALUATOR_CANONICAL_JSON_ALGORITHM,
  evaluatorCanonicalize,
  sha256Bytes,
} from "@obby/canonical-json";

import type { ContentHash } from "./types.js";

export function hashGeneratorPreimage(
  value: object,
  ownHashField?: string,
): ContentHash {
  const payload: Record<string, unknown> = { ...value };
  if (ownHashField !== undefined) Reflect.deleteProperty(payload, ownHashField);
  if (ownHashField === "configurationHash") {
    const limits = payload.limits;
    if (
      limits !== null &&
      typeof limits === "object" &&
      !Array.isArray(limits)
    ) {
      const semanticLimits = { ...(limits as Record<string, unknown>) };
      Reflect.deleteProperty(semanticLimits, "maxWorkUnits");
      payload.limits = semanticLimits;
    }
  }
  const canonical = evaluatorCanonicalize({
    canonicalizationAlgorithm: EVALUATOR_CANONICAL_JSON_ALGORITHM,
    identityDomain: ownHashField ?? "generation-request",
    payload,
  });
  return sha256Bytes(canonical.canonicalBytes);
}

export function assertContentHash(value: object, field: string): void {
  const actual = (value as Record<string, unknown>)[field];
  const expected = hashGeneratorPreimage(value, field);
  if (actual !== expected) {
    throw new GeneratorContractError(
      "hash-mismatch",
      `${field} content mismatch: expected ${expected}, received ${String(actual)}`,
    );
  }
}

export type GeneratorContractErrorCode =
  | "usage"
  | "input"
  | "validation"
  | "schema"
  | "stage-count"
  | "checkpoint-frequency"
  | "contradictory-mechanics"
  | "contradictory-accessibility"
  | "unknown-mechanic"
  | "deferred-mechanic"
  | "hash-mismatch"
  | "duplicate-id"
  | "invalid-reference"
  | "invariant"
  | "work-limit"
  | "maximum-work-units"
  | "path-safety"
  | "output-conflict"
  | "output-publication"
  | "cleanup-failed"
  | "input-too-large";

export class GeneratorContractError extends Error {
  public constructor(
    public readonly code: GeneratorContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GeneratorContractError";
  }
}

import {
  EVALUATOR_CANONICAL_JSON_ALGORITHM,
  canonicalizeEvaluatorSnapshot,
  compareUnicodeScalars,
  sha256Bytes,
  snapshotEvaluatorInput,
} from "@obby/canonical-json";

import { LayoutContractError } from "./types.js";

export type LayoutHashResult = {
  hash: `sha256:${string}`;
  canonicalBytes: Uint8Array;
};

function record(input: unknown, label: string): Record<string, unknown> {
  let snapshot;
  try {
    snapshot = snapshotEvaluatorInput(input);
  } catch {
    throw new LayoutContractError(
      "schema",
      `${label} must be immutable-compatible plain data`,
    );
  }
  if (
    snapshot === null ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot)
  )
    throw new LayoutContractError("schema", `${label} must be an object`);
  return snapshot;
}

function omitOwnHash(
  input: unknown,
  ownHashField: string,
  label: string,
): Record<string, unknown> {
  const payload = { ...record(input, label) };
  Reflect.deleteProperty(payload, ownHashField);
  return payload;
}

function strings(input: unknown): unknown {
  if (!Array.isArray(input)) return input;
  return input
    .map((item: unknown) => item)
    .sort((left, right) => compareUnicodeScalars(String(left), String(right)));
}

function recordsBy(
  input: unknown,
  key: (record: Record<string, unknown>) => string,
): unknown {
  if (!Array.isArray(input)) return input;
  return input
    .map((item: unknown) => item)
    .sort((left, right) =>
      compareUnicodeScalars(
        key(left as Record<string, unknown>),
        key(right as Record<string, unknown>),
      ),
    );
}

function namedHash(
  identityDomain: string,
  payload: Record<string, unknown>,
): LayoutHashResult {
  const preimage = snapshotEvaluatorInput({
    canonicalizationAlgorithm: EVALUATOR_CANONICAL_JSON_ALGORITHM,
    identityDomain,
    payload,
  });
  const canonical = canonicalizeEvaluatorSnapshot(preimage);
  return {
    hash: sha256Bytes(canonical.canonicalBytes),
    canonicalBytes: canonical.canonicalBytes,
  };
}

export function hashLayoutConfiguration(input: unknown): LayoutHashResult {
  const payload = omitOwnHash(
    input,
    "configurationHash",
    "LayoutConfigurationPreimage",
  );
  const limits = payload.limits;
  if (limits !== null && typeof limits === "object" && !Array.isArray(limits)) {
    const semanticLimits = { ...(limits as Record<string, unknown>) };
    Reflect.deleteProperty(semanticLimits, "maxWorkUnits");
    payload.limits = semanticLimits;
  }
  payload.numericParameters = recordsBy(
    payload.numericParameters,
    (parameter) => String(parameter.parameterId),
  );
  return namedHash("LayoutConfigurationPreimage", payload);
}

export function hashMechanicLayoutDefinition(input: unknown): LayoutHashResult {
  const payload = omitOwnHash(
    input,
    "mechanicLayoutDefinitionHash",
    "MechanicLayoutDefinitionPreimage",
  );
  payload.supportedShapes = strings(payload.supportedShapes);
  if (Array.isArray(payload.difficultyProfiles)) {
    payload.difficultyProfiles = payload.difficultyProfiles
      .map((profile) => {
        const value = { ...(profile as Record<string, unknown>) };
        value.parameters = recordsBy(value.parameters, (parameter) =>
          String(parameter.parameterId),
        );
        return value;
      })
      .sort(
        (left, right) =>
          Number(left.difficultyLevel) - Number(right.difficultyLevel),
      );
  }
  return namedHash("MechanicLayoutDefinitionPreimage", payload);
}

export function hashLayoutSpec(input: unknown): LayoutHashResult {
  const payload = omitOwnHash(input, "layoutSpecHash", "LayoutSpecPreimage");
  payload.mechanicLayoutDefinitionHashes = strings(
    payload.mechanicLayoutDefinitionHashes,
  );
  if (Array.isArray(payload.stages))
    payload.stages = payload.stages.map((stage) => {
      const value = { ...(stage as Record<string, unknown>) };
      value.hazardObjectIds = strings(value.hazardObjectIds);
      value.decorativeZoneIds = strings(value.decorativeZoneIds);
      return value;
    });
  if (Array.isArray(payload.objects))
    payload.objects = recordsBy(
      payload.objects.map((object) => {
        const value = { ...(object as Record<string, unknown>) };
        const references = value.sourceReferences;
        if (
          references !== null &&
          typeof references === "object" &&
          !Array.isArray(references)
        ) {
          const normalized = { ...(references as Record<string, unknown>) };
          normalized.sourceAssetIntentIds = strings(
            normalized.sourceAssetIntentIds,
          );
          value.sourceReferences = normalized;
        }
        return value;
      }),
      (object) => String(object.objectId),
    );
  if (Array.isArray(payload.decorativeZones))
    payload.decorativeZones = recordsBy(
      payload.decorativeZones.map((zone) => {
        const value = { ...(zone as Record<string, unknown>) };
        value.sourceAssetIntentIds = strings(value.sourceAssetIntentIds);
        return value;
      }),
      (zone) => String(zone.zoneId),
    );
  if (Array.isArray(payload.limitations))
    payload.limitations = recordsBy(
      payload.limitations.map((limitation) => {
        const value = { ...(limitation as Record<string, unknown>) };
        value.relatedSourceIds = strings(value.relatedSourceIds);
        return value;
      }),
      (limitation) =>
        `${String(limitation.code)}\u0000${String(limitation.message)}`,
    );
  if (Array.isArray(payload.findings))
    payload.findings = recordsBy(
      payload.findings.map((finding) => {
        const value = { ...(finding as Record<string, unknown>) };
        value.relatedSourceIds = strings(value.relatedSourceIds);
        return value;
      }),
      (finding) => `${String(finding.code)}\u0000${String(finding.message)}`,
    );
  return namedHash("LayoutSpecPreimage", payload);
}

export function hashLayoutBundle(input: unknown): LayoutHashResult {
  const payload = omitOwnHash(
    input,
    "layoutBundleHash",
    "LayoutBundlePreimage",
  );
  payload.mechanicLayoutDefinitionRefs = recordsBy(
    payload.mechanicLayoutDefinitionRefs,
    (definition) => String(definition.mechanicLayoutDefinitionId),
  );
  return namedHash("LayoutBundlePreimage", payload);
}

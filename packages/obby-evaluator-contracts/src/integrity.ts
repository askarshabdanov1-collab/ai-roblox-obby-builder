import {
  canonicalizeEvaluatorSnapshot,
  evaluatorCanonicalStringify,
  snapshotEvaluatorInput,
  type JsonValue,
} from "@obby/canonical-json";

import type {
  EvaluationPlan,
  EvaluationRequest,
  EvidenceRecord,
  MetricCatalog,
  MetricDefinition,
  ScoringProfile,
} from "./generated/evaluator-contracts.js";
import {
  verifyEvaluationPlanConfigurationIdentity,
  verifyEvaluationRequestIdentity,
  verifyEvidenceContentIdentity,
  verifyMetricCatalogIdentity,
  verifyMetricDefinitionIdentity,
  verifyScoringProfileIdentity,
  ContentHashMismatchError,
} from "./hashing.js";
import { ContractValidationError } from "./validation.js";
import { assertAcyclicResolvedEvidenceGraph } from "./internal/evidence-cycle.js";

function reject(
  contractName: string,
  code: string,
  path: string,
  message: string,
): never {
  throw new ContractValidationError(contractName, [
    { kind: "semantic", code, path, message },
  ]);
}

type SemanticVersionParts = readonly [number, number, number];

function parseVersion(value: string): SemanticVersionParts | undefined {
  const match = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(value);
  if (match === null) return undefined;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) return undefined;
  return parts as unknown as SemanticVersionParts;
}

function compareVersions(
  left: SemanticVersionParts,
  right: SemanticVersionParts,
): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function versionSatisfiesSupportedRange(
  version: string,
  range: string,
): boolean {
  const parsedVersion = parseVersion(version);
  if (parsedVersion === undefined) return false;
  const exact = parseVersion(range);
  if (exact !== undefined) return compareVersions(parsedVersion, exact) === 0;
  const tokens = range.split(" ");
  if (tokens.length < 1 || tokens.length > 2 || tokens.includes(""))
    return false;
  return tokens.every((token) => {
    const match = /^(>=|>|<=|<)([0-9]+\.[0-9]+\.[0-9]+)$/.exec(token);
    if (match === null) return false;
    const boundaryText = match[2];
    if (boundaryText === undefined) return false;
    const boundary = parseVersion(boundaryText);
    if (boundary === undefined) return false;
    const comparison = compareVersions(parsedVersion, boundary);
    switch (match[1]) {
      case ">=":
        return comparison >= 0;
      case ">":
        return comparison > 0;
      case "<=":
        return comparison <= 0;
      case "<":
        return comparison < 0;
      default:
        return false;
    }
  });
}

function assertVerifiedEvaluationRequestMatchesPlan(
  request: EvaluationRequest,
  plan: EvaluationPlan,
  catalog: MetricCatalog,
  profile: ScoringProfile,
): EvaluationRequest {
  const mismatches: string[] = [];
  if (request.configurationHash !== plan.configurationHash) {
    mismatches.push("configurationHash");
  }
  if (
    request.scene.manifestHash !== plan.scene.manifestHash ||
    request.scene.manifestSchemaVersion !== plan.scene.manifestSchemaVersion
  ) {
    mismatches.push("scene");
  }
  if (
    request.profile.profileId !== plan.profile.profileId ||
    request.profile.profileVersion !== plan.profile.profileVersion ||
    request.profile.scoringProfileHash !== plan.profile.scoringProfileHash ||
    request.profile.compatibilityClass !== plan.profile.compatibilityClass
  ) {
    mismatches.push("profile");
  }
  if (
    request.catalog.catalogId !== plan.catalog.catalogId ||
    request.catalog.catalogVersion !== plan.catalog.catalogVersion ||
    request.catalog.metricCatalogHash !== plan.catalog.metricCatalogHash
  ) {
    mismatches.push("catalog");
  }
  if (
    request.deterministicRequestOptions.seed !== plan.seed ||
    request.deterministicRequestOptions.partialEvidencePolicy !==
      plan.partialEvidencePolicy ||
    request.deterministicRequestOptions.comparisonGroupId !==
      plan.comparisonGroupId
  ) {
    mismatches.push("deterministicRequestOptions");
  }
  if (
    catalog.catalogId !== plan.catalog.catalogId ||
    catalog.catalogVersion !== plan.catalog.catalogVersion ||
    catalog.metricCatalogHash !== plan.catalog.metricCatalogHash
  ) {
    mismatches.push("catalogIdentity");
  }
  if (
    profile.profileId !== plan.profile.profileId ||
    profile.profileVersion !== plan.profile.profileVersion ||
    profile.scoringProfileHash !== plan.profile.scoringProfileHash ||
    profile.compatibilityClass !== plan.profile.compatibilityClass
  ) {
    mismatches.push("profileIdentity");
  }
  if (mismatches.length > 0) {
    reject(
      "EvaluationRequestPlanBinding",
      "request-plan-mismatch",
      "/",
      `request differs from its verified plan: ${mismatches.join(", ")}`,
    );
  }
  return request;
}

type CanonicallyOrderedInput = {
  snapshot: JsonValue;
  semanticIdentity: string;
  withoutResultHash: string;
  completePayload: string;
};

function compareCanonicalText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function snapshotObject(
  value: JsonValue,
): Record<string, JsonValue> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : undefined;
}

function snapshotString(
  value: Record<string, JsonValue> | undefined,
  field: string,
): string {
  const candidate = value?.[field];
  return typeof candidate === "string" ? candidate : "<invalid>";
}

function canonicalWithoutRootField(
  snapshot: JsonValue,
  resultHashField: string,
): string {
  const object = snapshotObject(snapshot);
  if (object === undefined) {
    return canonicalizeEvaluatorSnapshot(snapshot).canonicalText;
  }
  const preimage: Record<string, JsonValue> = Object.create(null) as Record<
    string,
    JsonValue
  >;
  for (const [key, value] of Object.entries(object)) {
    if (key !== resultHashField) preimage[key] = value;
  }
  return canonicalizeEvaluatorSnapshot(preimage).canonicalText;
}

function orderBeforeIdentityVerification(
  inputs: readonly unknown[],
  resultHashField: string,
  semanticIdentity: (value: Record<string, JsonValue> | undefined) => string,
): CanonicallyOrderedInput[] {
  return inputs
    .map((input) => {
      const snapshot = snapshotEvaluatorInput(input);
      return {
        snapshot,
        semanticIdentity: semanticIdentity(snapshotObject(snapshot)),
        withoutResultHash: canonicalWithoutRootField(snapshot, resultHashField),
        completePayload: canonicalizeEvaluatorSnapshot(snapshot).canonicalText,
      };
    })
    .sort(
      (left, right) =>
        compareCanonicalText(left.semanticIdentity, right.semanticIdentity) ||
        compareCanonicalText(left.withoutResultHash, right.withoutResultHash) ||
        compareCanonicalText(left.completePayload, right.completePayload),
    );
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function verifyOrderedIdentityCollection<T>(
  ordered: readonly CanonicallyOrderedInput[],
  contractName: string,
  issueCode: string,
  pathPrefix: string,
  verify: (input: unknown) => T,
): T[] {
  const verified: T[] = [];
  const identityIssues: {
    kind: "semantic";
    code: string;
    path: string;
    message: string;
  }[] = [];
  for (const entry of ordered) {
    try {
      verified.push(verify(entry.snapshot));
    } catch (caught) {
      if (!(caught instanceof ContentHashMismatchError)) throw caught;
      identityIssues.push({
        kind: "semantic",
        code: issueCode,
        path: `${pathPrefix}/${escapeJsonPointer(entry.semanticIdentity)}`,
        message: `${entry.semanticIdentity}: ${caught.identityName} expected ${caught.expected}, received ${caught.actual ?? "missing"}`,
      });
    }
  }
  if (identityIssues.length > 0) {
    throw new ContractValidationError(contractName, identityIssues);
  }
  return verified;
}

export type EvaluatorConfigurationGraphInput = {
  metricDefinitions: readonly unknown[];
  catalog: unknown;
  profile: unknown;
  plan: unknown;
  request: unknown;
  evaluatorVersion: string;
  componentVersions: Readonly<Record<string, string>>;
};

export type ValidatedEvaluatorConfigurationGraph = {
  metricDefinitions: MetricDefinition[];
  catalog: MetricCatalog;
  profile: ScoringProfile;
  plan: EvaluationPlan;
  request: EvaluationRequest;
};

export function assertValidEvaluatorConfigurationGraph(
  input: EvaluatorConfigurationGraphInput,
): ValidatedEvaluatorConfigurationGraph {
  const definitions = verifyOrderedIdentityCollection(
    orderBeforeIdentityVerification(
      input.metricDefinitions,
      "metricDefinitionHash",
      (value) =>
        `${snapshotString(value, "schemaVersion")}:${snapshotString(value, "metricId")}@${snapshotString(value, "metricVersion")}`,
    ),
    "EvaluatorConfigurationGraph",
    "metric-definition-identity-mismatch",
    "/metricDefinitions",
    verifyMetricDefinitionIdentity,
  );
  const byIdentity = new Map<string, MetricDefinition>();
  const byId = new Map<string, MetricDefinition[]>();
  for (const definition of definitions) {
    const identity = `${definition.metricId}@${definition.metricVersion}`;
    if (byIdentity.has(identity)) {
      reject(
        "EvaluatorConfigurationGraph",
        "duplicate-definition-identity",
        "/metricDefinitions",
        `duplicate supplied definition ${identity}`,
      );
    }
    byIdentity.set(identity, definition);
    byId.set(definition.metricId, [
      ...(byId.get(definition.metricId) ?? []),
      definition,
    ]);
  }

  const catalog = verifyMetricCatalogIdentity(input.catalog);
  if (catalog.metricDefinitions.length !== definitions.length) {
    reject(
      "EvaluatorConfigurationGraph",
      "definition-set-mismatch",
      "/catalog/metricDefinitions",
      "catalog entries and supplied definitions must resolve one-to-one",
    );
  }
  for (const reference of catalog.metricDefinitions.toSorted((left, right) =>
    `${left.metricId}@${left.metricVersion}`.localeCompare(
      `${right.metricId}@${right.metricVersion}`,
    ),
  )) {
    const identity = `${reference.metricId}@${reference.metricVersion}`;
    const definition = byIdentity.get(identity);
    if (definition?.metricDefinitionHash !== reference.metricDefinitionHash) {
      reject(
        "EvaluatorConfigurationGraph",
        "unknown-definition-reference",
        "/catalog/metricDefinitions",
        `catalog definition ${identity} does not resolve to exactly one verified definition`,
      );
    }
  }

  const invariantIds = new Set(
    catalog.invariantGates.map((gate) => gate.invariantId),
  );
  const visitState = new Map<string, "visiting" | "visited">();
  const visitMetric = (metricId: string): void => {
    if (visitState.get(metricId) === "visiting") {
      reject(
        "EvaluatorConfigurationGraph",
        "derived-metric-cycle",
        "/metricDefinitions/parentMetricIds",
        `derived metric graph contains a cycle at ${metricId}`,
      );
    }
    if (visitState.get(metricId) === "visited") return;
    const candidates = byId.get(metricId);
    if (candidates?.length !== 1) {
      reject(
        "EvaluatorConfigurationGraph",
        "ambiguous-derived-metric",
        "/metricDefinitions",
        `metric ID ${metricId} must resolve to exactly one supplied version`,
      );
    }
    const definition = candidates[0];
    if (definition === undefined) {
      reject(
        "EvaluatorConfigurationGraph",
        "ambiguous-derived-metric",
        "/metricDefinitions",
        `metric ID ${metricId} did not resolve after validation`,
      );
    }
    visitState.set(metricId, "visiting");
    for (const parentId of definition.parentMetricIds.toSorted()) {
      if (parentId === metricId) {
        reject(
          "EvaluatorConfigurationGraph",
          "derived-self-reference",
          "/metricDefinitions/parentMetricIds",
          `derived metric ${metricId} cannot reference itself`,
        );
      }
      if (!byId.has(parentId)) {
        reject(
          "EvaluatorConfigurationGraph",
          "unknown-derived-parent",
          "/metricDefinitions/parentMetricIds",
          `unknown derived parent metric ${parentId}`,
        );
      }
      visitMetric(parentId);
    }
    visitState.set(metricId, "visited");
  };
  for (const definition of definitions) {
    if (
      definition.invariantGateId !== undefined &&
      !invariantIds.has(definition.invariantGateId)
    ) {
      reject(
        "EvaluatorConfigurationGraph",
        "unknown-definition-invariant",
        "/metricDefinitions/invariantGateId",
        `unknown invariant gate ${definition.invariantGateId}`,
      );
    }
    visitMetric(definition.metricId);
  }

  for (const supported of catalog.supportedVersions.toSorted((left, right) =>
    left.component.localeCompare(right.component),
  )) {
    const actual = input.componentVersions[supported.component];
    if (
      actual === undefined ||
      !versionSatisfiesSupportedRange(actual, supported.versionRange)
    ) {
      reject(
        "EvaluatorConfigurationGraph",
        "unsupported-component-version",
        "/catalog/supportedVersions",
        `${supported.component} ${actual ?? "missing"} does not satisfy ${supported.versionRange}`,
      );
    }
  }
  const request = verifyEvaluationRequestIdentity(input.request);
  if (
    !versionSatisfiesSupportedRange(
      input.evaluatorVersion,
      request.evaluatorVersionConstraint,
    )
  ) {
    reject(
      "EvaluatorConfigurationGraph",
      "unsupported-evaluator-version",
      "/request/evaluatorVersionConstraint",
      "evaluator version does not satisfy the request constraint",
    );
  }

  const profile = verifyScoringProfileIdentity(input.profile);
  if (profile.metricCatalogHash !== catalog.metricCatalogHash) {
    reject(
      "EvaluatorConfigurationGraph",
      "profile-catalog-mismatch",
      "/profile/metricCatalogHash",
      "profile does not reference the verified catalog",
    );
  }
  const selected = new Set([
    ...profile.requiredMetricIds,
    ...profile.optionalMetricIds,
  ]);
  for (const metricId of [...selected].toSorted()) {
    if (!byId.has(metricId)) {
      reject(
        "EvaluatorConfigurationGraph",
        "unknown-profile-metric",
        "/profile/requiredMetricIds",
        `profile references unknown metric ${metricId}`,
      );
    }
  }
  for (const threshold of profile.thresholds.toSorted((left, right) =>
    left.thresholdId.localeCompare(right.thresholdId),
  )) {
    if (!selected.has(threshold.metricId)) {
      reject(
        "EvaluatorConfigurationGraph",
        "unknown-profile-threshold-metric",
        "/profile/thresholds",
        `profile threshold references unselected metric ${threshold.metricId}`,
      );
    }
  }
  const profileInvariants = new Set(profile.invariantGateIds);
  for (const invariantId of [...profileInvariants].toSorted()) {
    if (!invariantIds.has(invariantId)) {
      reject(
        "EvaluatorConfigurationGraph",
        "unknown-profile-invariant",
        "/profile/invariantGateIds",
        `profile references unknown invariant ${invariantId}`,
      );
    }
  }
  for (const invariantId of [...invariantIds].toSorted()) {
    if (!profileInvariants.has(invariantId)) {
      reject(
        "EvaluatorConfigurationGraph",
        "missing-required-invariant",
        "/profile/invariantGateIds",
        `profile cannot omit invariant gate ${invariantId}`,
      );
    }
  }
  const categoryIds = new Set<string>(
    profile.categories.map((category) => category.categoryId),
  );
  for (const gate of catalog.invariantGates.toSorted((left, right) =>
    left.invariantId.localeCompare(right.invariantId),
  )) {
    for (const categoryId of gate.affectedCategoryIds.toSorted()) {
      if (!categoryIds.has(categoryId)) {
        reject(
          "EvaluatorConfigurationGraph",
          "unknown-invariant-category-dependency",
          "/catalog/invariantGates/affectedCategoryIds",
          `invariant ${gate.invariantId} references unknown category ${categoryId}`,
        );
      }
    }
  }

  const plan = verifyEvaluationPlanConfigurationIdentity(input.plan);
  const include = new Set(plan.metricInclude);
  for (const metricId of [
    ...plan.metricInclude,
    ...plan.metricExclude,
  ].toSorted()) {
    if (!byId.has(metricId) || !selected.has(metricId)) {
      reject(
        "EvaluatorConfigurationGraph",
        "unknown-plan-metric",
        "/plan/metricInclude",
        `plan metric ${metricId} is not selected by the verified profile/catalog`,
      );
    }
  }
  for (const metricId of plan.metricExclude.toSorted()) {
    if (include.has(metricId)) {
      reject(
        "EvaluatorConfigurationGraph",
        "plan-metric-overlap",
        "/plan/metricExclude",
        `plan includes and excludes ${metricId}`,
      );
    }
  }
  for (const definition of definitions) {
    if (
      definition.invariantGateId !== undefined &&
      (!include.has(definition.metricId) ||
        plan.metricExclude.includes(definition.metricId))
    ) {
      reject(
        "EvaluatorConfigurationGraph",
        "plan-excludes-required-invariant-metric",
        "/plan/metricExclude",
        `plan cannot exclude required invariant metric ${definition.metricId}`,
      );
    }
  }
  assertVerifiedEvaluationRequestMatchesPlan(request, plan, catalog, profile);
  return { metricDefinitions: definitions, catalog, profile, plan, request };
}

function subjectKey(subject: EvidenceRecord["subject"]): string {
  return evaluatorCanonicalStringify(subject);
}

function subjectsCompatible(
  parent: EvidenceRecord,
  child: EvidenceRecord,
): boolean {
  return (
    parent.subject.kind === "scene" ||
    ((child.kind === "finish-topology" ||
      child.kind === "route-playability-summary") &&
      child.subject.kind === "scene") ||
    subjectKey(parent.subject) === subjectKey(child.subject)
  );
}

export function assertValidEvidenceGraph(
  inputs: readonly unknown[],
): EvidenceRecord[] {
  const records = verifyOrderedIdentityCollection(
    orderBeforeIdentityVerification(inputs, "evidenceContentHash", (value) => {
      const subject = value?.subject;
      const subjectIdentity =
        subject === undefined
          ? "<invalid>"
          : canonicalizeEvaluatorSnapshot(subject).canonicalText;
      return `${snapshotString(value, "schemaVersion")}:${snapshotString(value, "evidenceId")}:${snapshotString(value, "kind")}:${snapshotString(value, "manifestHash")}:${subjectIdentity}`;
    }),
    "EvidenceGraph",
    "evidence-content-identity-mismatch",
    "/evidence",
    verifyEvidenceContentIdentity,
  ).sort((left, right) =>
    left.evidenceContentHash.localeCompare(right.evidenceContentHash),
  );
  const byHash = new Map<string, EvidenceRecord>();
  const evidenceIds = new Set<string>();
  for (const record of records) {
    if (byHash.has(record.evidenceContentHash)) {
      reject(
        "EvidenceGraph",
        "duplicate-evidence-content-hash",
        "/",
        `duplicate evidence hash ${record.evidenceContentHash}`,
      );
    }
    if (record.evidenceId !== undefined) {
      if (evidenceIds.has(record.evidenceId)) {
        reject(
          "EvidenceGraph",
          "duplicate-evidence-id",
          "/evidenceId",
          `duplicate evidence ID ${record.evidenceId}`,
        );
      }
      evidenceIds.add(record.evidenceId);
    }
    byHash.set(record.evidenceContentHash, record);
  }
  for (const record of records) {
    for (const parentHash of record.parentEvidenceHashes.toSorted()) {
      const parent = byHash.get(parentHash);
      if (parent === undefined) {
        reject(
          "EvidenceGraph",
          "unknown-parent-evidence",
          "/parentEvidenceHashes",
          `unknown parent evidence reference ${parentHash}`,
        );
      }
      if (parent.manifestHash !== record.manifestHash) {
        reject(
          "EvidenceGraph",
          "manifest-scope-mismatch",
          "/parentEvidenceHashes",
          `parent ${parentHash} has a different manifest scope`,
        );
      }
      if (!subjectsCompatible(parent, record)) {
        reject(
          "EvidenceGraph",
          "subject-scope-mismatch",
          "/parentEvidenceHashes",
          `parent ${parentHash} has an incompatible subject scope`,
        );
      }
    }
  }
  assertAcyclicResolvedEvidenceGraph(
    records.map((record) => ({
      identity: record.evidenceContentHash,
      parentIdentities: record.parentEvidenceHashes,
    })),
  );
  return records;
}

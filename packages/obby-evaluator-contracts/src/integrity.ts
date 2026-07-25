import { evaluatorCanonicalStringify } from "@obby/canonical-json";

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

export type RequestPlanIdentityContext = {
  metricDefinitions: readonly unknown[];
  catalog: unknown;
  profile: unknown;
};

function verifyRequestPlanIdentityContext(
  identities: RequestPlanIdentityContext | undefined,
): { catalog: MetricCatalog; profile: ScoringProfile } {
  if (
    identities === undefined ||
    !Array.isArray(identities.metricDefinitions) ||
    identities.catalog === undefined ||
    identities.profile === undefined
  ) {
    reject(
      "EvaluationRequestPlanBinding",
      "missing-identity-context",
      "/identities",
      "request-plan binding requires metric definitions, catalog, and profile objects",
    );
  }
  const definitions = identities.metricDefinitions.map(
    verifyMetricDefinitionIdentity,
  );
  const byIdentity = new Map(
    definitions.map((definition) => [
      `${definition.metricId}@${definition.metricVersion}`,
      definition.metricDefinitionHash,
    ]),
  );
  const catalog = verifyMetricCatalogIdentity(identities.catalog);
  if (
    byIdentity.size !== definitions.length ||
    catalog.metricDefinitions.length !== definitions.length
  ) {
    reject(
      "EvaluationRequestPlanBinding",
      "catalog-definition-set-mismatch",
      "/identities/metricDefinitions",
      "catalog entries must resolve one-to-one to verified metric definitions",
    );
  }
  for (const reference of catalog.metricDefinitions.toSorted((left, right) =>
    `${left.metricId}@${left.metricVersion}`.localeCompare(
      `${right.metricId}@${right.metricVersion}`,
    ),
  )) {
    const identity = `${reference.metricId}@${reference.metricVersion}`;
    if (byIdentity.get(identity) !== reference.metricDefinitionHash) {
      reject(
        "EvaluationRequestPlanBinding",
        "unknown-catalog-definition",
        "/identities/catalog/metricDefinitions",
        `catalog definition ${identity} is not backed by a verified definition`,
      );
    }
  }
  const profile = verifyScoringProfileIdentity(identities.profile);
  if (profile.metricCatalogHash !== catalog.metricCatalogHash) {
    reject(
      "EvaluationRequestPlanBinding",
      "profile-catalog-mismatch",
      "/identities/profile/metricCatalogHash",
      "profile is not backed by the verified catalog",
    );
  }
  const metricIds = new Set(
    definitions.map((definition) => definition.metricId),
  );
  for (const metricId of [
    ...profile.requiredMetricIds,
    ...profile.optionalMetricIds,
  ].toSorted()) {
    if (!metricIds.has(metricId)) {
      reject(
        "EvaluationRequestPlanBinding",
        "unknown-profile-metric",
        "/identities/profile",
        `profile metric ${metricId} is not backed by the verified catalog graph`,
      );
    }
  }
  return { catalog, profile };
}

export function assertEvaluationRequestMatchesPlan(
  requestInput: unknown,
  planInput: unknown,
  identities: RequestPlanIdentityContext | undefined,
): EvaluationRequest {
  const verifiedIdentities = verifyRequestPlanIdentityContext(identities);
  const request = verifyEvaluationRequestIdentity(requestInput);
  const plan = verifyEvaluationPlanConfigurationIdentity(planInput);
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
  const catalog = verifiedIdentities.catalog;
  if (
    catalog.catalogId !== plan.catalog.catalogId ||
    catalog.catalogVersion !== plan.catalog.catalogVersion ||
    catalog.metricCatalogHash !== plan.catalog.metricCatalogHash
  ) {
    mismatches.push("catalogIdentity");
  }
  const profile = verifiedIdentities.profile;
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
  const definitions = input.metricDefinitions
    .map(verifyMetricDefinitionIdentity)
    .sort((left, right) =>
      `${left.metricId}@${left.metricVersion}`.localeCompare(
        `${right.metricId}@${right.metricVersion}`,
      ),
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
  if (
    !versionSatisfiesSupportedRange(
      input.evaluatorVersion,
      verifyEvaluationRequestIdentity(input.request).evaluatorVersionConstraint,
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
  const request = assertEvaluationRequestMatchesPlan(input.request, plan, {
    metricDefinitions: definitions,
    catalog,
    profile,
  });
  return { metricDefinitions: definitions, catalog, profile, plan, request };
}

function subjectKey(subject: EvidenceRecord["subject"]): string {
  return evaluatorCanonicalStringify(subject);
}

function subjectsCompatible(
  parent: EvidenceRecord["subject"],
  child: EvidenceRecord["subject"],
): boolean {
  return parent.kind === "scene" || subjectKey(parent) === subjectKey(child);
}

export function assertValidEvidenceGraph(
  inputs: readonly unknown[],
): EvidenceRecord[] {
  const records = inputs
    .map(verifyEvidenceContentIdentity)
    .sort((left, right) =>
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
      if (!subjectsCompatible(parent.subject, record.subject)) {
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

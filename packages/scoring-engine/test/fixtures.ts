import { readFileSync } from "node:fs";

import {
  hashAvailabilityRecord,
  hashEvaluationPlanConfiguration,
  hashEvaluationRequest,
  type AvailabilityRecord,
  type EvaluationPlan,
  type EvaluationRequest,
  type EvidenceRecordContract,
  type Finding,
  type MetricCatalog,
  type MetricDefinition,
  type ScoringProfile,
} from "@obby/obby-evaluator-contracts";

import {
  RUNTIME_CAPABILITY_VERSION,
  runtimeCapabilitySubjectHash,
} from "../src/availability.js";

export type E1bFixtureBundle = {
  schemaVersion: "0.1";
  manifestHash: `sha256:${string}`;
  evidence: EvidenceRecordContract[];
  findings: Finding[];
};

function jsonFixture(path: string): unknown {
  return JSON.parse(
    readFileSync(new URL(path, import.meta.url), "utf8"),
  ) as unknown;
}

export function evaluatorFixtureGraph(manifestHash?: `sha256:${string}`) {
  const metricDefinitions = jsonFixture(
    "../../obby-evaluator-contracts/fixtures/generated/e1-metric-definitions.json",
  ) as MetricDefinition[];
  const catalog = jsonFixture(
    "../../obby-evaluator-contracts/fixtures/generated/e1-metric-catalog.json",
  ) as MetricCatalog;
  const profile = jsonFixture(
    "../../obby-evaluator-contracts/fixtures/generated/e1-scoring-profile.json",
  ) as ScoringProfile;
  const evidenceBundle = jsonFixture(
    "../../route-playability-evaluator/fixtures/generated/vertical-slice-evidence.json",
  ) as E1bFixtureBundle;
  const sceneHash = manifestHash ?? evidenceBundle.manifestHash;
  const planSource: EvaluationPlan = {
    schemaVersion: "0.1",
    planId: "e1-static-plan",
    scene: { manifestHash: sceneHash, manifestSchemaVersion: "1.0.0" },
    profile: {
      profileId: profile.profileId,
      profileVersion: profile.profileVersion,
      scoringProfileHash: profile.scoringProfileHash,
      compatibilityClass: profile.compatibilityClass,
    },
    catalog: {
      catalogId: catalog.catalogId,
      catalogVersion: catalog.catalogVersion,
      metricCatalogHash: catalog.metricCatalogHash,
    },
    requiredCapabilities: ["geometry", "route", "coarse-jump"],
    views: [],
    avatarProfiles: ["roblox-default-r15"],
    deviceProfiles: [],
    metricInclude: metricDefinitions.map((definition) => definition.metricId),
    metricExclude: [],
    budgets: {
      maxObjects: 2048,
      maxEvidenceRecords: 4096,
      maxBytes: 8_388_608,
      maxDepth: 64,
    },
    partialEvidencePolicy: "finalize-with-missing",
    seed: 42,
    createdAt: "2030-01-01T00:00:00Z",
    configurationHash: `sha256:${"0".repeat(64)}`,
  };
  const plan: EvaluationPlan = {
    ...planSource,
    configurationHash: hashEvaluationPlanConfiguration(planSource).hash,
  };
  const requestSource: EvaluationRequest = {
    schemaVersion: "0.1",
    requestId: "e1c-test-request",
    submittedAt: "2030-01-01T00:00:00Z",
    callerId: "e1c-test",
    transport: "test-harness",
    retryAttempt: 0,
    scene: plan.scene,
    configurationHash: plan.configurationHash,
    evaluatorVersionConstraint: ">=0.1.0 <0.2.0",
    profile: plan.profile,
    catalog: plan.catalog,
    requestedEvidenceRequirements: {
      requiredCapabilityIds: ["geometry", "route", "coarse-jump"],
      evidenceKindIds: [
        "geometry-fact",
        "route-graph",
        "route-transition",
        "coarse-transition-state",
        "route-playability-summary",
        "checkpoint-topology",
        "finish-topology",
        "hazard-relationship",
        "skip-candidate",
      ],
      coverageProfileIds: ["e1-static-complete"],
    },
    deterministicRequestOptions: {
      seed: 42,
      partialEvidencePolicy: "finalize-with-missing",
    },
    requestedOutputs: [
      { outputKind: "report-payload", outputFormat: "json" },
      { outputKind: "rendered-report", outputFormat: "markdown" },
    ],
    evaluationRequestHash: `sha256:${"0".repeat(64)}`,
  };
  const request: EvaluationRequest = {
    ...requestSource,
    evaluationRequestHash: hashEvaluationRequest(requestSource).hash,
  };
  return { metricDefinitions, catalog, profile, plan, request, evidenceBundle };
}

export function deferredRuntimeAvailability(
  manifestHash = evaluatorFixtureGraph().plan.scene.manifestHash,
): AvailabilityRecord {
  const contentHash = runtimeCapabilitySubjectHash(manifestHash);
  const source: AvailabilityRecord = {
    schemaVersion: "0.1",
    subject: {
      kind: "reference",
      stableId: "capability:runtime",
      contentHash,
    },
    availabilityState: "restricted",
    reasonCode: "phase-deferred",
    reasonDetails: [
      { code: "capability-id", value: "runtime" },
      { code: "capability-version", value: RUNTIME_CAPABILITY_VERSION },
      { code: "manifest-hash", value: manifestHash },
    ],
    authority: {
      authorityKind: "evaluator-policy",
      authorityId: "evaluator-policy:e1c",
    },
    producer: { component: "scoring-engine", version: "0.1.0" },
    effectiveSequence: 1,
    supersedesAvailabilityRecordHashes: [],
    policy: { component: "e1-scope-policy", version: "1.0.0" },
    impactScope: {
      scopeKind: "subject-only",
      affectedIdentityHashes: [contentHash],
    },
    availabilityRecordHash: `sha256:${"0".repeat(64)}`,
  };
  return {
    ...source,
    availabilityRecordHash: hashAvailabilityRecord(source).hash,
  };
}

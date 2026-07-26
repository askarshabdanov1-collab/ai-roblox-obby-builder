import { sha256 } from "@obby/canonical-json";

import {
  hashEvaluationPlanConfiguration,
  hashEvaluationRequest,
  hashMetricCatalog,
  hashMetricDefinition,
  hashScoringProfile,
} from "../src/hashing.js";

export const TEST_IDENTITY_SOURCES = Object.freeze({
  manifest: "fixture:scene-manifest:vertical-slice:v1",
  geometry: "fixture:normalized-geometry:platform-a:v1",
  calculationConfiguration: "fixture:calculation-config:route-completeness:v1",
  producerBuild: "fixture:producer-build:geometry-evaluator:0.1.0",
  ruleBuild: "fixture:rule-build:route-completeness:1.0.0",
  calculationBundle: "fixture:calculation-bundle:e1a:v1",
  availabilitySubject: "fixture:availability-subject:geometry-scene:v1",
});

function pinnedIdentity(source: string): `sha256:${string}` {
  return sha256({ domain: "evaluator-test-fixture-v1", source });
}

export const TEST_IDENTITIES = Object.freeze({
  manifestHash: pinnedIdentity(TEST_IDENTITY_SOURCES.manifest),
  geometryHash: pinnedIdentity(TEST_IDENTITY_SOURCES.geometry),
  calculationConfigurationHash: pinnedIdentity(
    TEST_IDENTITY_SOURCES.calculationConfiguration,
  ),
  producerBuildHash: pinnedIdentity(TEST_IDENTITY_SOURCES.producerBuild),
  ruleBuildHash: pinnedIdentity(TEST_IDENTITY_SOURCES.ruleBuild),
  calculationBundleHash: pinnedIdentity(
    TEST_IDENTITY_SOURCES.calculationBundle,
  ),
  availabilitySubjectHash: pinnedIdentity(
    TEST_IDENTITY_SOURCES.availabilitySubject,
  ),
});

export function metricDefinition(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const value: Record<string, unknown> = {
    schemaVersion: "0.1",
    metricId: "playability.route-completeness",
    metricVersion: "1.0.0",
    resultKind: "deterministic-fact",
    implementationStatus: "planned",
    calculationAvailability: "unavailable-in-e1a",
    valueDefinition: {
      kind: "number",
      unit: "ratio",
      minimum: 0,
      maximum: 1,
    },
    applicability: "required",
    zeroObservationBehavior: "missing-evidence",
    requiredEvidenceKinds: ["route-transition", "geometry-fact"],
    requiredCapabilities: ["route", "geometry"],
    calculation: {
      methodId: "route-completeness",
      version: "1.0.0",
      configurationHash: TEST_IDENTITIES.calculationConfigurationHash,
    },
    confidenceMethod: {
      methodId: "exact-input-coverage",
      version: "1.0.0",
    },
    invariantGateId: "required-route-topology",
    blockingEligibility: "invariant",
    thresholds: [
      {
        thresholdId: "complete-route",
        thresholdKind: "invariant",
        classification: "invariant",
        operator: "eq",
        value: 1,
      },
    ],
    normalizationRule: "identity",
    limitationsTemplate: ["Does not assert physical feasibility."],
    comparisonCompatibilityClass: "e1-static-v1",
    calibrationStatus: "invariant",
    parentMetricIds: [],
    metricDefinitionHash: TEST_IDENTITIES.calculationConfigurationHash,
    ...overrides,
  };
  value.metricDefinitionHash = hashMetricDefinition(value).hash;
  return value;
}

export function catalog(definitionHash: string): Record<string, unknown> {
  const value: Record<string, unknown> = {
    schemaVersion: "0.1",
    catalogId: "e1-static",
    catalogVersion: "1.0.0",
    metricDefinitions: [
      {
        metricId: "playability.route-completeness",
        metricVersion: "1.0.0",
        metricDefinitionHash: definitionHash,
      },
    ],
    invariantGates: [
      {
        invariantId: "required-route-topology",
        blocking: true,
        outcomeEffect: "fail",
        requiredEvidenceKinds: ["route-transition"],
      },
    ],
    supportedVersions: [
      { component: "obby-evaluator-contracts", versionRange: ">=0.1.0 <0.2.0" },
    ],
    metricCatalogHash: TEST_IDENTITIES.calculationConfigurationHash,
  };
  value.metricCatalogHash = hashMetricCatalog(value).hash;
  return value;
}

export function scoringProfile(catalogHash: string): Record<string, unknown> {
  const value: Record<string, unknown> = {
    schemaVersion: "0.1",
    profileId: "e1-static-default",
    profileVersion: "1.0.0",
    metricCatalogHash: catalogHash,
    requiredMetricIds: ["playability.route-completeness"],
    optionalMetricIds: [],
    invariantGateIds: ["required-route-topology"],
    categories: [
      {
        categoryId: "playability",
        metricIds: ["playability.route-completeness"],
        availability: "available",
      },
    ],
    thresholds: [],
    evidenceCompleteness: "require-all-required",
    missingCategoryPolicy: "unavailable-no-renormalization",
    aggregateScore: false,
    calibrationStatus: "provisional",
    compatibilityClass: "e1-static-v1",
    scoringProfileHash: TEST_IDENTITIES.calculationConfigurationHash,
  };
  value.scoringProfileHash = hashScoringProfile(value).hash;
  return value;
}

function defaultConfigurationReferences(): {
  catalog: Record<string, unknown>;
  profile: Record<string, unknown>;
} {
  const definition = metricDefinition();
  const metricCatalog = catalog(definition.metricDefinitionHash as string);
  const profile = scoringProfile(metricCatalog.metricCatalogHash as string);
  return { catalog: metricCatalog, profile };
}

export function evaluationPlan(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const references = defaultConfigurationReferences();
  const value: Record<string, unknown> = {
    schemaVersion: "0.1",
    planId: "e1-static-plan",
    scene: {
      manifestHash: TEST_IDENTITIES.manifestHash,
      manifestSchemaVersion: "1.0.0",
    },
    profile: {
      profileId: references.profile.profileId,
      profileVersion: references.profile.profileVersion,
      scoringProfileHash: references.profile.scoringProfileHash,
      compatibilityClass: references.profile.compatibilityClass,
    },
    catalog: {
      catalogId: references.catalog.catalogId,
      catalogVersion: references.catalog.catalogVersion,
      metricCatalogHash: references.catalog.metricCatalogHash,
    },
    requiredCapabilities: ["geometry", "route"],
    views: [],
    avatarProfiles: ["roblox-default-r15"],
    deviceProfiles: [],
    metricInclude: ["playability.route-completeness"],
    metricExclude: [],
    budgets: {
      maxObjects: 2048,
      maxEvidenceRecords: 4096,
      maxBytes: 8_388_608,
      maxDepth: 64,
    },
    partialEvidencePolicy: "reject",
    seed: 42,
    createdAt: "2030-01-01T00:00:00Z",
    configurationHash: TEST_IDENTITIES.calculationConfigurationHash,
    ...overrides,
  };
  value.configurationHash = hashEvaluationPlanConfiguration(value).hash;
  return value;
}

export function evaluationRequest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const defaultPlan = evaluationPlan();
  const value: Record<string, unknown> = {
    schemaVersion: "0.1",
    requestId: "request-0001",
    submittedAt: "2030-01-01T00:00:00Z",
    callerId: "caller-a",
    transport: "local-api",
    retryAttempt: 0,
    scene: defaultPlan.scene,
    configurationHash: defaultPlan.configurationHash,
    evaluatorVersionConstraint: ">=0.1.0 <0.2.0",
    profile: defaultPlan.profile,
    catalog: defaultPlan.catalog,
    requestedEvidenceRequirements: {
      requiredCapabilityIds: ["geometry", "route"],
      evidenceKindIds: ["geometry-fact", "route-transition"],
      coverageProfileIds: ["static-complete"],
    },
    deterministicRequestOptions: {
      seed: 42,
      partialEvidencePolicy: "reject",
    },
    requestedOutputs: [
      { outputKind: "report-payload" },
      { outputKind: "evidence-index" },
    ],
    evaluationRequestHash: TEST_IDENTITIES.calculationConfigurationHash,
    ...overrides,
  };
  value.evaluationRequestHash = hashEvaluationRequest(value).hash;
  return value;
}

export function positiveEvaluatorFixtures(): Record<string, unknown>[] {
  const definition = metricDefinition();
  const metricCatalog = catalog(definition.metricDefinitionHash as string);
  const profile = scoringProfile(metricCatalog.metricCatalogHash as string);
  return [
    definition,
    metricCatalog,
    profile,
    evaluationPlan(),
    evaluationRequest(),
  ];
}

export const ZERO_HASH = `sha256:${"0".repeat(64)}`;

export function metricDefinition(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: "0.1",
    metricId: "playability.route-completeness",
    metricVersion: "1.0.0",
    resultKind: "deterministic-fact",
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
      configurationHash: ZERO_HASH,
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
    metricDefinitionHash: ZERO_HASH,
    ...overrides,
  };
}

export function catalog(definitionHash = ZERO_HASH): Record<string, unknown> {
  return {
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
    metricCatalogHash: ZERO_HASH,
  };
}

export function scoringProfile(
  catalogHash = ZERO_HASH,
): Record<string, unknown> {
  return {
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
    scoringProfileHash: ZERO_HASH,
  };
}

export function evaluationPlan(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: "0.1",
    planId: "e1-static-plan",
    scene: {
      manifestHash: ZERO_HASH,
      manifestSchemaVersion: "1.0.0",
    },
    profile: {
      profileId: "e1-static-default",
      profileVersion: "1.0.0",
      scoringProfileHash: ZERO_HASH,
      compatibilityClass: "e1-static-v1",
    },
    catalog: {
      catalogId: "e1-static",
      catalogVersion: "1.0.0",
      metricCatalogHash: ZERO_HASH,
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
    configurationHash: ZERO_HASH,
    ...overrides,
  };
}

export function evaluationRequest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: "0.1",
    requestId: "request-0001",
    submittedAt: "2030-01-01T00:00:00Z",
    callerId: "caller-a",
    transport: "local-api",
    retryAttempt: 0,
    scene: {
      manifestHash: ZERO_HASH,
      manifestSchemaVersion: "1.0.0",
    },
    configurationHash: ZERO_HASH,
    evaluatorVersionConstraint: ">=0.1.0 <0.2.0",
    profile: {
      profileId: "e1-static-default",
      profileVersion: "1.0.0",
      scoringProfileHash: ZERO_HASH,
      compatibilityClass: "e1-static-v1",
    },
    catalog: {
      catalogId: "e1-static",
      catalogVersion: "1.0.0",
      metricCatalogHash: ZERO_HASH,
    },
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
    evaluationRequestHash: ZERO_HASH,
    ...overrides,
  };
}

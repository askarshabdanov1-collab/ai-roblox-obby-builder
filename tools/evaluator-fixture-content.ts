import { canonicalStringify } from "@obby/canonical-json";
import {
  hashAvailabilityRecord,
  hashCalculationBundle,
  hashEvaluationPlanConfiguration,
  hashEvaluationRequest,
  hashEvidenceContent,
  hashMetricCatalog,
  hashMetricDefinition,
  hashScoringProfile,
} from "@obby/obby-evaluator-contracts";

const ZERO_HASH = `sha256:${"0".repeat(64)}`;

const definitionBase = {
  schemaVersion: "0.1",
  metricVersion: "1.0.0",
  resultKind: "deterministic-fact",
  applicability: "required",
  zeroObservationBehavior: "missing-evidence",
  requiredEvidenceKinds: ["route-transition", "geometry-fact"],
  requiredCapabilities: ["route", "geometry"],
  confidenceMethod: {
    methodId: "exact-input-coverage",
    version: "1.0.0",
  },
  blockingEligibility: "invariant",
  normalizationRule: "identity",
  comparisonCompatibilityClass: "e1-static-v1",
  calibrationStatus: "invariant",
  parentMetricIds: [],
  metricDefinitionHash: ZERO_HASH,
} as const;

const definitionSources = [
  {
    ...definitionBase,
    metricId: "playability.route-completeness",
    valueDefinition: {
      kind: "number",
      unit: "ratio",
      minimum: 0,
      maximum: 1,
    },
    calculation: {
      methodId: "route-completeness",
      version: "1.0.0",
      configurationHash: ZERO_HASH,
    },
    invariantGateId: "required-route-topology",
    thresholds: [
      {
        thresholdId: "complete-route",
        thresholdKind: "invariant",
        classification: "invariant",
        operator: "eq",
        value: 1,
      },
    ],
    limitationsTemplate: ["Does not assert physical feasibility."],
  },
  {
    ...definitionBase,
    metricId: "policy.decorative-collision-violations",
    valueDefinition: {
      kind: "integer",
      unit: "objects",
      minimum: 0,
      maximum: 100000,
    },
    calculation: {
      methodId: "decorative-collision-audit",
      version: "1.0.0",
      configurationHash: ZERO_HASH,
    },
    invariantGateId: "decorative-gameplay-collision",
    thresholds: [
      {
        thresholdId: "no-decorative-collision",
        thresholdKind: "invariant",
        classification: "invariant",
        operator: "eq",
        value: 0,
      },
    ],
    limitationsTemplate: [
      "Covers validated manifest geometry only; no Studio observation is collected in E1a.",
    ],
  },
];

function withHash<T extends { metricDefinitionHash: string }>(source: T): T {
  return { ...source, metricDefinitionHash: hashMetricDefinition(source).hash };
}

const metricDefinitions = definitionSources.map(withHash);

const catalogSource = {
  schemaVersion: "0.1",
  catalogId: "e1-static",
  catalogVersion: "1.0.0",
  metricDefinitions: metricDefinitions.map((definition) => ({
    metricId: definition.metricId,
    metricVersion: definition.metricVersion,
    metricDefinitionHash: definition.metricDefinitionHash,
  })),
  invariantGates: [
    {
      invariantId: "required-route-topology",
      blocking: true,
      outcomeEffect: "fail",
      requiredEvidenceKinds: ["route-transition"],
    },
    {
      invariantId: "decorative-gameplay-collision",
      blocking: true,
      outcomeEffect: "fail",
      requiredEvidenceKinds: ["geometry-fact"],
    },
  ],
  supportedVersions: [
    {
      component: "obby-evaluator-contracts",
      versionRange: ">=0.1.0 <0.2.0",
    },
    { component: "geometry-evaluator", versionRange: ">=0.1.0 <0.2.0" },
  ],
  metricCatalogHash: ZERO_HASH,
};
const metricCatalog = {
  ...catalogSource,
  metricCatalogHash: hashMetricCatalog(catalogSource).hash,
};

const profileSource = {
  schemaVersion: "0.1",
  profileId: "e1-static-default",
  profileVersion: "1.0.0",
  metricCatalogHash: metricCatalog.metricCatalogHash,
  requiredMetricIds: metricDefinitions.map((definition) => definition.metricId),
  optionalMetricIds: [],
  invariantGateIds: [
    "required-route-topology",
    "decorative-gameplay-collision",
  ],
  categories: [
    {
      categoryId: "playability",
      metricIds: ["playability.route-completeness"],
      availability: "available",
    },
    {
      categoryId: "policy",
      metricIds: ["policy.decorative-collision-violations"],
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
const scoringProfile = {
  ...profileSource,
  scoringProfileHash: hashScoringProfile(profileSource).hash,
};

const plan = {
  schemaVersion: "0.1",
  planId: "e1-static-plan",
  scene: {
    manifestHash: ZERO_HASH,
    manifestSchemaVersion: "1.0.0",
  },
  profile: {
    profileId: scoringProfile.profileId,
    profileVersion: scoringProfile.profileVersion,
    scoringProfileHash: scoringProfile.scoringProfileHash,
    compatibilityClass: scoringProfile.compatibilityClass,
  },
  catalog: {
    catalogId: metricCatalog.catalogId,
    catalogVersion: metricCatalog.catalogVersion,
    metricCatalogHash: metricCatalog.metricCatalogHash,
  },
  requiredCapabilities: ["geometry", "route"],
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
  partialEvidencePolicy: "reject",
  seed: 42,
  createdAt: "2030-01-01T00:00:00Z",
  configurationHash: ZERO_HASH,
};
const configurationHash = hashEvaluationPlanConfiguration(plan).hash;

const request = {
  schemaVersion: "0.1",
  requestId: "golden-request",
  submittedAt: "2030-01-01T00:00:00Z",
  callerId: "fixture-generator",
  transport: "test-harness",
  retryAttempt: 0,
  scene: plan.scene,
  configurationHash,
  evaluatorVersionConstraint: ">=0.1.0 <0.2.0",
  profile: plan.profile,
  catalog: plan.catalog,
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
};

const evidence = {
  schemaVersion: "0.1",
  kind: "geometry-fact",
  manifestHash: ZERO_HASH,
  subject: { kind: "scene" },
  producer: {
    component: "geometry-evaluator",
    version: "0.1.0",
    buildHash: ZERO_HASH,
  },
  payload: {
    kind: "geometry-fact",
    objectIds: ["platform-a"],
    factKind: "normalized-object",
    geometryHash: ZERO_HASH,
  },
  parentEvidenceHashes: [],
  artifactHashes: [],
  quality: { completeness: "complete", validityCodes: ["finite"] },
  limitations: [],
  evidenceContentHash: ZERO_HASH,
};

const calculation = {
  schemaVersion: "0.1",
  manifestHash: ZERO_HASH,
  configurationHash,
  evaluatorVersion: "0.1.0",
  metricCatalogHash: metricCatalog.metricCatalogHash,
  scoringProfileHash: scoringProfile.scoringProfileHash,
  environmentCompatibilityClass: "static-native-parts-v1",
  evidence: [
    {
      kind: "geometry-fact",
      subjectKey: "scene",
      evidenceContentHash: hashEvidenceContent(evidence).hash,
    },
  ],
  ruleVersions: [
    {
      component: "geometry-evaluator",
      version: "0.1.0",
      buildHash: ZERO_HASH,
    },
  ],
  calculationBundleHash: ZERO_HASH,
};

const availability = {
  schemaVersion: "0.1",
  subject: {
    kind: "evidence",
    stableId: "geometry:scene",
    contentHash: hashEvidenceContent(evidence).hash,
  },
  availabilityState: "available",
  reasonCode: "created",
  reasonDetails: [],
  authority: {
    authorityKind: "evaluator",
    authorityId: "evaluator:local",
  },
  effectiveSequence: 0,
  supersedesAvailabilityRecordHashes: [],
  policy: {
    component: "availability",
    version: "1.0.0",
    buildHash: ZERO_HASH,
  },
  impactScope: {
    scopeKind: "subject-only",
    affectedIdentityHashes: [hashEvidenceContent(evidence).hash],
  },
  availabilityRecordHash: ZERO_HASH,
};

const vectors = [
  ["MetricDefinitionPreimage", hashMetricDefinition(metricDefinitions[0])],
  ["MetricCatalogPreimage", hashMetricCatalog(metricCatalog)],
  ["ScoringProfilePreimage", hashScoringProfile(scoringProfile)],
  [
    "EvaluationPlanConfigurationPreimage",
    hashEvaluationPlanConfiguration(plan),
  ],
  ["EvaluationRequestPreimage", hashEvaluationRequest(request)],
  ["EvidenceContentPreimage", hashEvidenceContent(evidence)],
  ["CalculationBundlePreimage", hashCalculationBundle(calculation)],
  ["AvailabilityRecordPreimage", hashAvailabilityRecord(availability)],
] as const;

function json(value: unknown): string {
  return `${canonicalStringify(value)}\n`;
}

export function expectedEvaluatorFixtures(): Record<string, string> {
  return {
    "packages/obby-evaluator-contracts/fixtures/generated/e1-metric-definitions.json":
      json(metricDefinitions),
    "packages/obby-evaluator-contracts/fixtures/generated/e1-metric-catalog.json":
      json(metricCatalog),
    "packages/obby-evaluator-contracts/fixtures/generated/e1-scoring-profile.json":
      json(scoringProfile),
    "packages/obby-evaluator-contracts/fixtures/generated/hash-vectors.json":
      json(
        vectors.map(([preimageName, result]) => ({
          preimageName,
          hash: result.hash,
          canonicalPayloadUtf8: new TextDecoder().decode(result.canonicalBytes),
        })),
      ),
  };
}

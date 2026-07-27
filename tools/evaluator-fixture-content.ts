import {
  canonicalStringify,
  EVALUATOR_CANONICAL_JSON_ALGORITHM,
  evaluatorCanonicalize,
  sha256Bytes,
} from "@obby/canonical-json";
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

function semanticIdentity(
  identityId: string,
  identityDomain: string,
  semanticFixture: Record<string, unknown>,
) {
  const source = {
    schemaVersion: "0.1",
    identityId,
    identityDomain,
    semanticFixture,
  };
  const canonical = evaluatorCanonicalize({
    canonicalizationAlgorithm: EVALUATOR_CANONICAL_JSON_ALGORITHM,
    ...source,
  });
  return { ...source, identityHash: sha256Bytes(canonical.canonicalBytes) };
}

const identitySources = [
  semanticIdentity("manifest-e1a-fixture-v1", "SceneManifest", {
    manifestSchemaVersion: "1.0.0",
    sceneId: "e1a-static-native-parts",
    generatorVersion: "0.1.0",
    seed: 42,
  }),
  semanticIdentity("geometry-e1a-fixture-v1", "NormalizedGeometry", {
    algorithm: "native-part-geometry-v1",
    objectIds: ["platform-a"],
    units: "studs",
  }),
  semanticIdentity("producer-build-e1a-v1", "ProducerBuild", {
    component: "geometry-evaluator",
    version: "0.1.0",
    sourceRevision: "phase-e1a-fixture",
  }),
  semanticIdentity("rule-build-e1a-v1", "RuleBuild", {
    component: "geometry-evaluator",
    ruleSet: "geometry-foundation",
    version: "0.1.0",
  }),
  semanticIdentity("availability-policy-build-v1", "PolicyBuild", {
    component: "availability",
    policyId: "local-evidence-availability",
    version: "1.0.0",
  }),
  semanticIdentity("fixture-generator-build-v1", "FixtureGeneratorBuild", {
    component: "evaluator-fixture-content",
    version: "1.0.0",
  }),
];

const identityHash = (identityId: string): string => {
  const identity = identitySources.find(
    (candidate) => candidate.identityId === identityId,
  );
  if (identity === undefined)
    throw new Error(`missing identity source ${identityId}`);
  return identity.identityHash;
};

const SELF_HASH_SENTINEL = identityHash("fixture-generator-build-v1");
const MANIFEST_HASH = identityHash("manifest-e1a-fixture-v1");
const GEOMETRY_HASH = identityHash("geometry-e1a-fixture-v1");
const PRODUCER_BUILD_HASH = identityHash("producer-build-e1a-v1");
const RULE_BUILD_HASH = identityHash("rule-build-e1a-v1");
const AVAILABILITY_POLICY_BUILD_HASH = identityHash(
  "availability-policy-build-v1",
);

const definitionBase = {
  schemaVersion: "0.1",
  metricVersion: "1.0.0",
  resultKind: "deterministic-fact",
  implementationStatus: "implemented",
  calculationAvailability: "available",
  applicability: "required",
  zeroObservationBehavior: "missing-evidence",
  confidenceMethod: {
    methodId: "exact-input-coverage",
    version: "1.0.0",
  },
  blockingEligibility: "none",
  normalizationRule: "identity",
  comparisonCompatibilityClass: "e1-static-v1",
  calibrationStatus: "provisional",
  parentMetricIds: [],
  metricDefinitionHash: SELF_HASH_SENTINEL,
} as const;

function semanticConfiguration(
  configurationId: string,
  rules: Record<string, unknown>,
) {
  const configuration = {
    schemaVersion: "0.1",
    configurationId,
    rules,
  };
  const canonical = evaluatorCanonicalize({
    canonicalizationAlgorithm: EVALUATOR_CANONICAL_JSON_ALGORITHM,
    identityDomain: "SemanticCalculationConfiguration",
    configuration,
  });
  return {
    ...configuration,
    configurationHash: sha256Bytes(canonical.canonicalBytes),
  };
}

const semanticConfigurations = [
  semanticConfiguration("route-completeness-v1", {
    requireSingleGlobalSafeRoute: true,
    requireReachableFinishReference: true,
  }),
  semanticConfiguration("decorative-collision-audit-v1", {
    candidateOnCanCollide: true,
    candidateOnCanTouch: true,
    evidenceAuthority: "validated-e1b-geometry",
  }),
  semanticConfiguration("required-transition-feasibility-v1", {
    preserveModelRelativeStates: true,
    indeterminateIsNotPass: true,
  }),
  semanticConfiguration("checkpoint-topology-v1", {
    requireForwardOrdering: true,
    zeroCheckpoints: "not-applicable",
  }),
  semanticConfiguration("finish-topology-v1", {
    requireSingleReachableAuthoritativeFinish: true,
  }),
  semanticConfiguration("hazard-candidates-v1", {
    candidateSemanticsOnly: true,
  }),
  semanticConfiguration("skip-candidates-v1", {
    candidateSemanticsOnly: true,
  }),
  semanticConfiguration("evidence-completeness-v1", {
    requireAllRequiredMetrics: true,
    resolveEveryReference: true,
  }),
  semanticConfiguration("runtime-isolation-availability-v1", {
    e1RuntimeCapability: "deferred",
    zeroObservations: "missing-evidence",
  }),
  semanticConfiguration("native-part-count-v1", {
    countGeometryEvidenceObjectIds: true,
  }),
];

const configurationHash = (configurationId: string): string => {
  const configuration = semanticConfigurations.find(
    (candidate) => candidate.configurationId === configurationId,
  );
  if (configuration === undefined) {
    throw new Error(`missing semantic configuration ${configurationId}`);
  }
  return configuration.configurationHash;
};

const definitionSources = [
  {
    ...definitionBase,
    metricId: "playability.route-completeness",
    requiredEvidenceKinds: [
      "route-graph",
      "route-transition",
      "finish-topology",
    ],
    requiredCapabilities: ["route", "geometry"],
    valueDefinition: {
      kind: "number",
      unit: "ratio",
      minimum: 0,
      maximum: 1,
    },
    calculation: {
      methodId: "route-completeness",
      version: "1.0.0",
      configurationHash: configurationHash("route-completeness-v1"),
    },
    invariantGateId: "required-route-topology",
    blockingEligibility: "invariant",
    calibrationStatus: "invariant",
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
    metricId: "playability.required-transition-feasibility",
    resultKind: "heuristic-estimate",
    requiredEvidenceKinds: [
      "coarse-transition-state",
      "route-playability-summary",
    ],
    requiredCapabilities: ["route", "coarse-jump"],
    valueDefinition: {
      kind: "state",
      allowedValues: [
        "feasible-under-model",
        "infeasible-under-model",
        "indeterminate",
      ],
    },
    calculation: {
      methodId: "required-transition-feasibility",
      version: "1.0.0",
      configurationHash: configurationHash(
        "required-transition-feasibility-v1",
      ),
    },
    blockingEligibility: "profile",
    thresholds: [
      {
        thresholdId: "all-required-transitions-feasible-under-model",
        thresholdKind: "profile",
        classification: "provisional",
        operator: "eq",
        value: "feasible-under-model",
      },
    ],
    limitationsTemplate: [
      "Model-relative feasibility is not universal Roblox physics proof.",
    ],
  },
  {
    ...definitionBase,
    metricId: "checkpoint.topology-validity",
    applicability: "conditional",
    zeroObservationBehavior: "not-applicable",
    requiredEvidenceKinds: ["route-graph", "checkpoint-topology"],
    requiredCapabilities: ["route"],
    valueDefinition: { kind: "boolean" },
    calculation: {
      methodId: "checkpoint-topology-validity",
      version: "1.0.0",
      configurationHash: configurationHash("checkpoint-topology-v1"),
    },
    invariantGateId: "checkpoint-ordering",
    blockingEligibility: "invariant",
    calibrationStatus: "invariant",
    thresholds: [
      {
        thresholdId: "valid-checkpoint-ordering",
        thresholdKind: "invariant",
        classification: "invariant",
        operator: "eq",
        value: true,
      },
    ],
    limitationsTemplate: [
      "Static topology does not establish runtime player isolation.",
    ],
  },
  {
    ...definitionBase,
    metricId: "finish.topology-validity",
    requiredEvidenceKinds: ["finish-topology"],
    requiredCapabilities: ["route"],
    valueDefinition: { kind: "boolean" },
    calculation: {
      methodId: "finish-topology-validity",
      version: "1.0.0",
      configurationHash: configurationHash("finish-topology-v1"),
    },
    invariantGateId: "finish-topology",
    blockingEligibility: "invariant",
    calibrationStatus: "invariant",
    thresholds: [
      {
        thresholdId: "valid-finish-topology",
        thresholdKind: "invariant",
        classification: "invariant",
        operator: "eq",
        value: true,
      },
    ],
    limitationsTemplate: [
      "Structural reachability does not prove physical reachability.",
    ],
  },
  {
    ...definitionBase,
    metricId: "hazard.relationship-candidate-count",
    resultKind: "heuristic-estimate",
    applicability: "conditional",
    zeroObservationBehavior: "exact-zero",
    requiredEvidenceKinds: ["route-playability-summary"],
    requiredCapabilities: ["geometry", "route"],
    valueDefinition: {
      kind: "integer",
      unit: "candidates",
      minimum: 0,
      maximum: 100000,
    },
    calculation: {
      methodId: "hazard-candidate-count",
      version: "1.0.0",
      configurationHash: configurationHash("hazard-candidates-v1"),
    },
    thresholds: [],
    limitationsTemplate: [
      "Broad-phase hazard candidates are not confirmed gameplay failures.",
    ],
  },
  {
    ...definitionBase,
    metricId: "playability.skip-candidate-count",
    resultKind: "heuristic-estimate",
    applicability: "conditional",
    zeroObservationBehavior: "exact-zero",
    requiredEvidenceKinds: ["route-playability-summary"],
    requiredCapabilities: ["geometry", "route", "coarse-jump"],
    valueDefinition: {
      kind: "integer",
      unit: "candidates",
      minimum: 0,
      maximum: 100000,
    },
    calculation: {
      methodId: "skip-candidate-count",
      version: "1.0.0",
      configurationHash: configurationHash("skip-candidates-v1"),
    },
    thresholds: [],
    limitationsTemplate: [
      "Conservative skip candidates are not confirmed executable skips.",
    ],
  },
  {
    ...definitionBase,
    metricId: "policy.evidence-completeness",
    requiredEvidenceKinds: ["route-graph"],
    requiredCapabilities: ["geometry", "route"],
    valueDefinition: { kind: "boolean" },
    calculation: {
      methodId: "evidence-completeness",
      version: "1.0.0",
      configurationHash: configurationHash("evidence-completeness-v1"),
    },
    invariantGateId: "required-metric-availability",
    blockingEligibility: "invariant",
    calibrationStatus: "invariant",
    thresholds: [
      {
        thresholdId: "required-evidence-complete",
        thresholdKind: "invariant",
        classification: "invariant",
        operator: "eq",
        value: true,
      },
    ],
    limitationsTemplate: [
      "Optional deferred capabilities remain explicit and are not converted to pass.",
    ],
  },
  {
    ...definitionBase,
    metricId: "runtime.checkpoint-isolation-availability",
    applicability: "optional",
    requiredEvidenceKinds: ["runtime-observation"],
    requiredCapabilities: ["runtime"],
    valueDefinition: {
      kind: "state",
      allowedValues: ["available", "unavailable"],
    },
    calculation: {
      methodId: "runtime-isolation-availability",
      version: "1.0.0",
      configurationHash: configurationHash("runtime-isolation-availability-v1"),
    },
    thresholds: [],
    limitationsTemplate: [
      "Studio multiplayer isolation evidence is deferred beyond E1c.",
    ],
  },
  {
    ...definitionBase,
    metricId: "policy.decorative-collision-violations",
    requiredEvidenceKinds: ["geometry-fact"],
    requiredCapabilities: ["geometry"],
    valueDefinition: {
      kind: "integer",
      unit: "objects",
      minimum: 0,
      maximum: 100000,
    },
    calculation: {
      methodId: "decorative-collision-audit",
      version: "1.0.0",
      configurationHash: configurationHash("decorative-collision-audit-v1"),
    },
    invariantGateId: "decorative-gameplay-collision",
    blockingEligibility: "invariant",
    calibrationStatus: "invariant",
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
  {
    ...definitionBase,
    metricId: "performance.native-part-count",
    zeroObservationBehavior: "exact-zero",
    requiredEvidenceKinds: ["geometry-fact"],
    requiredCapabilities: ["geometry"],
    valueDefinition: {
      kind: "integer",
      unit: "objects",
      minimum: 0,
      maximum: 100000,
    },
    calculation: {
      methodId: "native-part-count",
      version: "1.0.0",
      configurationHash: configurationHash("native-part-count-v1"),
    },
    thresholds: [],
    limitationsTemplate: [
      "Static native-Part count is not a runtime performance measurement.",
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
      invariantId: "required-reference-resolution",
      blocking: true,
      outcomeEffect: "fail",
      requiredEvidenceKinds: ["route-transition"],
    },
    {
      invariantId: "checkpoint-ordering",
      blocking: true,
      outcomeEffect: "fail",
      requiredEvidenceKinds: ["route-graph"],
    },
    {
      invariantId: "finish-topology",
      blocking: true,
      outcomeEffect: "fail",
      requiredEvidenceKinds: ["finish-topology"],
    },
    {
      invariantId: "gameplay-route-authority",
      blocking: true,
      outcomeEffect: "fail",
      requiredEvidenceKinds: ["geometry-fact", "route-graph"],
    },
    {
      invariantId: "evidence-graph-integrity",
      blocking: true,
      outcomeEffect: "fail",
      requiredEvidenceKinds: ["route-graph"],
    },
    {
      invariantId: "required-metric-availability",
      blocking: true,
      outcomeEffect: "fail",
      requiredEvidenceKinds: ["route-graph"],
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
    {
      component: "route-playability-evaluator",
      versionRange: ">=0.1.0 <0.2.0",
    },
    { component: "scoring-engine", versionRange: ">=0.1.0 <0.2.0" },
  ],
  metricCatalogHash: SELF_HASH_SENTINEL,
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
  requiredMetricIds: metricDefinitions
    .filter((definition) => definition.applicability !== "optional")
    .map((definition) => definition.metricId),
  optionalMetricIds: ["runtime.checkpoint-isolation-availability"],
  invariantGateIds: catalogSource.invariantGates.map(
    (gate) => gate.invariantId,
  ),
  categories: [
    {
      categoryId: "playability",
      metricIds: [
        "playability.route-completeness",
        "playability.required-transition-feasibility",
        "finish.topology-validity",
        "playability.skip-candidate-count",
      ],
      availability: "available",
    },
    {
      categoryId: "checkpoint",
      metricIds: [
        "checkpoint.topology-validity",
        "runtime.checkpoint-isolation-availability",
      ],
      availability: "available",
    },
    {
      categoryId: "hazard",
      metricIds: ["hazard.relationship-candidate-count"],
      availability: "available",
    },
    {
      categoryId: "policy",
      metricIds: [
        "policy.evidence-completeness",
        "policy.decorative-collision-violations",
      ],
      availability: "available",
    },
    {
      categoryId: "performance",
      metricIds: ["performance.native-part-count"],
      availability: "available",
    },
  ],
  thresholds: [
    {
      thresholdId: "required-transition-feasibility",
      metricId: "playability.required-transition-feasibility",
      classification: "provisional",
      operator: "eq",
      value: "feasible-under-model",
    },
  ],
  evidenceCompleteness: "require-all-required",
  missingCategoryPolicy: "unavailable-no-renormalization",
  aggregateScore: false,
  calibrationStatus: "provisional",
  compatibilityClass: "e1-static-v1",
  scoringProfileHash: SELF_HASH_SENTINEL,
};
const scoringProfile = {
  ...profileSource,
  scoringProfileHash: hashScoringProfile(profileSource).hash,
};

const plan = {
  schemaVersion: "0.1",
  planId: "e1-static-plan",
  scene: {
    manifestHash: MANIFEST_HASH,
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
  partialEvidencePolicy: "reject",
  seed: 42,
  createdAt: "2030-01-01T00:00:00Z",
  configurationHash: SELF_HASH_SENTINEL,
};
const planConfigurationHash = hashEvaluationPlanConfiguration(plan).hash;

const request = {
  schemaVersion: "0.1",
  requestId: "golden-request",
  submittedAt: "2030-01-01T00:00:00Z",
  callerId: "fixture-generator",
  transport: "test-harness",
  retryAttempt: 0,
  scene: plan.scene,
  configurationHash: planConfigurationHash,
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
  evaluationRequestHash: SELF_HASH_SENTINEL,
};

const evidence = {
  schemaVersion: "0.1",
  kind: "geometry-fact",
  manifestHash: MANIFEST_HASH,
  subject: { kind: "scene" },
  producer: {
    component: "geometry-evaluator",
    version: "0.1.0",
    buildHash: PRODUCER_BUILD_HASH,
  },
  payload: {
    kind: "geometry-fact",
    objectIds: ["platform-a"],
    gameplayAuthoritativeObjectIds: ["platform-a"],
    decorativeObjectIds: [],
    decorativeGameplayCollisionCount: 0,
    factKind: "normalized-object",
    geometryHash: GEOMETRY_HASH,
  },
  parentEvidenceHashes: [],
  artifactHashes: [],
  quality: { completeness: "complete", validityCodes: ["finite"] },
  limitations: [],
  evidenceContentHash: SELF_HASH_SENTINEL,
};

const calculation = {
  schemaVersion: "0.1",
  manifestHash: MANIFEST_HASH,
  configurationHash: planConfigurationHash,
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
      buildHash: RULE_BUILD_HASH,
    },
  ],
  calculationBundleHash: SELF_HASH_SENTINEL,
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
    buildHash: AVAILABILITY_POLICY_BUILD_HASH,
  },
  impactScope: {
    scopeKind: "subject-only",
    affectedIdentityHashes: [hashEvidenceContent(evidence).hash],
  },
  availabilityRecordHash: SELF_HASH_SENTINEL,
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
  const fixtures = {
    "packages/obby-evaluator-contracts/fixtures/generated/e1-metric-definitions.json":
      json(metricDefinitions),
    "packages/obby-evaluator-contracts/fixtures/generated/e1-metric-catalog.json":
      json(metricCatalog),
    "packages/obby-evaluator-contracts/fixtures/generated/e1-scoring-profile.json":
      json(scoringProfile),
    "packages/obby-evaluator-contracts/fixtures/generated/e1-semantic-configurations.json":
      json(semanticConfigurations),
    "packages/obby-evaluator-contracts/fixtures/generated/e1-identity-sources.json":
      json(identitySources),
    "packages/obby-evaluator-contracts/fixtures/generated/hash-vectors.json":
      json(
        vectors.map(([preimageName, result]) => ({
          preimageName,
          hash: result.hash,
          canonicalPayloadUtf8: new TextDecoder().decode(result.canonicalBytes),
        })),
      ),
  };
  const allZeroHash = `sha256:${"0".repeat(64)}`;
  for (const [path, content] of Object.entries(fixtures)) {
    if (content.includes(allZeroHash)) {
      throw new Error(`${path} contains a forbidden all-zero fixture identity`);
    }
  }
  return fixtures;
}

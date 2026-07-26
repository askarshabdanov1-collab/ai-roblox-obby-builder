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
  implementationStatus: "planned",
  calculationAvailability: "unavailable-in-e1a",
  applicability: "required",
  zeroObservationBehavior: "missing-evidence",
  confidenceMethod: {
    methodId: "exact-input-coverage",
    version: "1.0.0",
  },
  blockingEligibility: "invariant",
  normalizationRule: "identity",
  comparisonCompatibilityClass: "e1-static-v1",
  calibrationStatus: "invariant",
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
    finalFindingOutsidePhase: true,
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
    requiredEvidenceKinds: ["route-transition", "geometry-fact"],
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
      availability: "planned",
    },
    {
      categoryId: "policy",
      metricIds: ["policy.decorative-collision-violations"],
      availability: "planned",
    },
  ],
  thresholds: [],
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

/* Generated from evaluator-contracts.schema.json. Do not edit. */

export type EvaluatorContract =
  | MetricDefinition
  | MetricCatalog
  | ScoringProfile
  | EvaluationPlan
  | EvaluationRequest
  | EvaluationRun
  | EvaluationMetric
  | EvidenceRecordContract
  | RuntimeObservationContentContract
  | RuntimeObservationEnvelope
  | AvailabilityRecordContract
  | Finding
  | GeometryObjectInput
  | TransitionInput
  | CalculationBundlePreimage;
export type SchemaVersion = "0.1";
export type StableId = string;
export type SemanticVersion = string;
export type ResultKind =
  | "deterministic-fact"
  | "heuristic-estimate"
  | "learned-estimate"
  | "analytics-derived-estimate"
  | "human-judgment"
  | "derived-composite";
export type MetricValueDefinition =
  | {
      kind: "number" | "integer";
      unit: StableId;
      minimum: number;
      maximum: number;
    }
  | {
      kind: "boolean";
    }
  | {
      kind: "state";
      /**
       * @minItems 1
       * @maxItems 32
       */
      allowedValues: [StableId, ...StableId[]];
    };
export type EvidenceKind =
  | "geometry-fact"
  | "route-transition"
  | "runtime-observation"
  | "screenshot"
  | "image-feature"
  | "performance-sample"
  | "reference-comparison"
  | "analytics-aggregate"
  | "human-label";
export type Capability =
  | "geometry"
  | "route"
  | "coarse-jump"
  | "runtime-controller-trials"
  | "runtime"
  | "screenshots"
  | "visual"
  | "reference"
  | "analytics";
export type ContentHash = string;
export type Timestamp = string;
export type OpaqueId = string;
export type EvaluationMetric =
  DeterministicFact | HeuristicEstimate | LearnedEstimate | AnalyticsDerivedEstimate | HumanJudgment | DerivedComposite;
export type DeterministicFact = MetricResultBase & {
  resultKind: "deterministic-fact";
  sourceKind: "deterministic";
  confidence: Confidence & {
    value?: 1;
  };
  method: VersionRef;
};
export type SourceKind = "deterministic" | "heuristic" | "learned" | "analytics-derived" | "subjective" | "derived";
export type MetricValue =
  | {
      kind: "number";
      value: number;
      unit: StableId;
    }
  | {
      kind: "integer";
      value: number;
      unit: StableId;
    }
  | {
      kind: "boolean";
      value: boolean;
    }
  | {
      kind: "state";
      value: StableId;
    };
export type HeuristicEstimate = MetricResultBase & {
  resultKind: "heuristic-estimate";
  sourceKind: "heuristic";
  confidence: Confidence;
  /**
   * @minItems 1
   */
  limitations?: [unknown, ...unknown[]];
};
export type LearnedEstimate = MetricResultBase & {
  resultKind: "learned-estimate";
  sourceKind: "learned";
  confidence: Confidence;
  model: VersionRef;
  /**
   * @minItems 1
   */
  limitations?: [unknown, ...unknown[]];
};
export type AnalyticsDerivedEstimate = MetricResultBase & {
  resultKind: "analytics-derived-estimate";
  sourceKind: "analytics-derived";
  confidence: Confidence;
  sourceSnapshotHash: ContentHash;
  /**
   * @minItems 1
   */
  limitations?: [unknown, ...unknown[]];
};
export type HumanJudgment = MetricResultBase & {
  resultKind: "human-judgment";
  sourceKind: "subjective";
  /**
   * @minItems 1
   * @maxItems 100000
   */
  labelPayloadHashes: [ContentHash, ...ContentHash[]];
  studyVersion: SemanticVersion;
  /**
   * @minItems 1
   */
  limitations?: [unknown, ...unknown[]];
};
export type DerivedComposite = MetricResultBase & {
  resultKind: "derived-composite";
  sourceKind: "derived";
  confidence: Confidence;
  /**
   * @minItems 1
   * @maxItems 64
   */
  parentMetricIds: [StableId, ...StableId[]];
  calculationDefinitionHash: ContentHash;
  /**
   * @minItems 1
   */
  limitations?: [unknown, ...unknown[]];
};
export type EvidenceRecordContract = Omit<EvidenceRecord, "kind" | "payload"> & (
  | { kind: "geometry-fact"; payload: GeometryFactPayload }
  | { kind: "route-transition"; payload: RouteTransitionPayload }
  | { kind: "runtime-observation"; payload: RuntimeObservationReferencePayload }
);
export type EvaluationSubject =
  | {
      kind: "scene";
    }
  | {
      kind: "object";
      objectId: StableId;
    }
  | {
      kind: "transition";
      fromObjectId: StableId;
      toObjectId: StableId;
      fromGlobalIndex: number;
      toGlobalIndex: number;
    }
  | {
      kind: "point";
      point: Vector3;
    };
export type RuntimeObservationContentContract = Omit<RuntimeObservationContent, "kind" | "payload"> & (
  | { kind: "scene-loaded"; payload: Extract<RuntimeObservationContent["payload"], { kind: "scene-loaded" }> }
  | { kind: "character-spawned"; payload: Extract<RuntimeObservationContent["payload"], { kind: "character-spawned" }> }
  | { kind: "transition-attempt"; payload: Extract<RuntimeObservationContent["payload"], { kind: "transition-attempt" }> }
);
export type AvailabilityRecordContract = Omit<AvailabilityRecord, "effectiveAt" | "effectiveSequence"> & (
  | { effectiveAt: Timestamp; effectiveSequence?: never }
  | { effectiveAt?: never; effectiveSequence: number }
);

export interface MetricDefinition {
  schemaVersion: SchemaVersion;
  metricId: StableId;
  metricVersion: SemanticVersion;
  resultKind: ResultKind;
  implementationStatus: "implemented" | "planned";
  calculationAvailability: "available" | "unavailable-in-e1a";
  valueDefinition: MetricValueDefinition;
  applicability: "required" | "optional" | "conditional";
  zeroObservationBehavior: "not-applicable" | "missing-evidence" | "exact-zero";
  /**
   * @maxItems 16
   */
  requiredEvidenceKinds: EvidenceKind[];
  /**
   * @maxItems 16
   */
  requiredCapabilities: Capability[];
  calculation: {
    methodId: StableId;
    version: SemanticVersion;
    configurationHash: ContentHash;
  };
  confidenceMethod: {
    methodId: StableId;
    version: SemanticVersion;
  };
  invariantGateId?: StableId;
  blockingEligibility: "none" | "profile" | "invariant";
  /**
   * @maxItems 32
   */
  thresholds: {
    thresholdId: StableId;
    thresholdKind: "invariant" | "profile" | "advisory";
    classification: "invariant" | "provisional" | "calibration-required";
    operator: "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
    value: boolean | number | string;
  }[];
  normalizationRule: StableId;
  /**
   * @maxItems 64
   */
  limitationsTemplate: string[];
  comparisonCompatibilityClass: StableId;
  calibrationStatus: "invariant" | "provisional" | "calibration-required";
  /**
   * @maxItems 64
   */
  parentMetricIds: StableId[];
  metricDefinitionHash: ContentHash;
}
export interface MetricCatalog {
  schemaVersion: SchemaVersion;
  catalogId: StableId;
  catalogVersion: SemanticVersion;
  /**
   * @minItems 1
   * @maxItems 256
   */
  metricDefinitions: [
    {
      metricId: StableId;
      metricVersion: SemanticVersion;
      metricDefinitionHash: ContentHash;
    },
    ...{
      metricId: StableId;
      metricVersion: SemanticVersion;
      metricDefinitionHash: ContentHash;
    }[]
  ];
  /**
   * @maxItems 64
   */
  invariantGates: {
    invariantId: StableId;
    blocking: true;
    outcomeEffect: "fail";
    /**
     * @maxItems 16
     */
    requiredEvidenceKinds: EvidenceKind[];
  }[];
  /**
   * @minItems 1
   * @maxItems 32
   */
  supportedVersions: [
    {
      component: StableId;
      versionRange: string;
    },
    ...{
      component: StableId;
      versionRange: string;
    }[]
  ];
  metricCatalogHash: ContentHash;
}
export interface ScoringProfile {
  schemaVersion: SchemaVersion;
  profileId: StableId;
  profileVersion: SemanticVersion;
  metricCatalogHash: ContentHash;
  /**
   * @maxItems 256
   */
  requiredMetricIds: StableId[];
  /**
   * @maxItems 256
   */
  optionalMetricIds: StableId[];
  /**
   * @maxItems 64
   */
  invariantGateIds: StableId[];
  /**
   * @minItems 1
   * @maxItems 16
   */
  categories: [
    {
      categoryId: "playability" | "checkpoint" | "hazard" | "policy" | "performance";
      /**
       * @maxItems 256
       */
      metricIds: StableId[];
      availability: "available" | "planned";
    },
    ...{
      categoryId: "playability" | "checkpoint" | "hazard" | "policy" | "performance";
      /**
       * @maxItems 256
       */
      metricIds: StableId[];
      availability: "available" | "planned";
    }[]
  ];
  /**
   * @maxItems 64
   */
  thresholds: {
    thresholdId: StableId;
    metricId: StableId;
    classification: "provisional" | "calibration-required";
    operator: "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
    value: boolean | number | string;
  }[];
  evidenceCompleteness: "require-all-required";
  missingCategoryPolicy: "unavailable-no-renormalization";
  aggregateScore: false;
  calibrationStatus: "provisional";
  compatibilityClass: StableId;
  scoringProfileHash: ContentHash;
}
export interface EvaluationPlan {
  schemaVersion: SchemaVersion;
  planId: StableId;
  scene: SceneIdentity;
  profile: ProfileIdentity;
  catalog: CatalogIdentity;
  /**
   * @maxItems 16
   */
  requiredCapabilities: Capability[];
  /**
   * @maxItems 64
   */
  views: StableId[];
  /**
   * @maxItems 32
   */
  avatarProfiles: StableId[];
  /**
   * @maxItems 32
   */
  deviceProfiles: StableId[];
  /**
   * @maxItems 256
   */
  metricInclude: StableId[];
  /**
   * @maxItems 256
   */
  metricExclude: StableId[];
  budgets: {
    maxObjects: number;
    maxEvidenceRecords: number;
    maxBytes: number;
    maxDepth: number;
  };
  partialEvidencePolicy: "reject" | "finalize-with-missing";
  comparisonGroupId?: StableId;
  seed: number;
  createdAt: Timestamp;
  configurationHash: ContentHash;
}
export interface SceneIdentity {
  manifestHash: ContentHash;
  manifestSchemaVersion: SemanticVersion;
}
export interface ProfileIdentity {
  profileId: StableId;
  profileVersion: SemanticVersion;
  scoringProfileHash: ContentHash;
  compatibilityClass: StableId;
}
export interface CatalogIdentity {
  catalogId: StableId;
  catalogVersion: SemanticVersion;
  metricCatalogHash: ContentHash;
}
export interface EvaluationRequest {
  schemaVersion: SchemaVersion;
  requestId?: OpaqueId;
  submittedAt?: Timestamp;
  callerId?: OpaqueId;
  transport?: "local-api" | "test-harness" | "library";
  retryAttempt?: number;
  scene: SceneIdentity;
  configurationHash: ContentHash;
  evaluatorVersionConstraint: string;
  profile: ProfileIdentity;
  catalog: CatalogIdentity;
  requestedEvidenceRequirements: {
    /**
     * @maxItems 16
     */
    requiredCapabilityIds: Capability[];
    /**
     * @maxItems 16
     */
    evidenceKindIds: EvidenceKind[];
    /**
     * @maxItems 32
     */
    coverageProfileIds: StableId[];
  };
  deterministicRequestOptions: {
    seed: number;
    partialEvidencePolicy: "reject" | "finalize-with-missing";
    comparisonGroupId?: StableId;
  };
  /**
   * @minItems 1
   * @maxItems 16
   */
  requestedOutputs: [
    {
      outputKind: "report-payload" | "rendered-report" | "evidence-index" | "explanation";
      outputFormat?: "json" | "markdown" | "html";
      renderProfileId?: StableId;
    },
    ...{
      outputKind: "report-payload" | "rendered-report" | "evidence-index" | "explanation";
      outputFormat?: "json" | "markdown" | "html";
      renderProfileId?: StableId;
    }[]
  ];
  evaluationRequestHash: ContentHash;
}
export interface EvaluationRun {
  schemaVersion: SchemaVersion;
  executionId: OpaqueId;
  planId: StableId;
  manifestHash: ContentHash;
  configurationHash: ContentHash;
  evaluatorVersion: SemanticVersion;
  metricCatalogHash: ContentHash;
  scoringProfileHash: ContentHash;
  status: "queued" | "validating" | "analyzing" | "finalized" | "rejected" | "cancelled" | "failed";
  /**
   * @maxItems 64
   */
  stageStates: {
    stageId: StableId;
    attempt: number;
    status: "queued" | "running" | "complete" | "failed" | "cancelled";
    startedAt?: Timestamp;
    finishedAt?: Timestamp;
    errorCode?: StableId;
  }[];
  startedAt: Timestamp;
  finishedAt?: Timestamp;
  supersedesExecutionId?: OpaqueId;
  /**
   * @maxItems 64
   */
  sessionIds: OpaqueId[];
  /**
   * @maxItems 16
   */
  capabilityResults: {
    capability: Capability;
    status: "complete" | "partial" | "missing" | "failed";
    /**
     * @maxItems 4096
     */
    evidenceIds: OpaqueId[];
  }[];
  environment: {
    compatibilityClass: StableId;
    os?: StableId;
    architecture?: StableId;
  };
  calculationBundleHash?: ContentHash;
  reportPayloadHash?: ContentHash;
  executionEnvelopeHash?: ContentHash;
}
export interface MetricResultBase {
  schemaVersion: SchemaVersion;
  metricId: StableId;
  metricVersion: SemanticVersion;
  metricDefinitionHash: ContentHash;
  category:
    | "playability"
    | "readability"
    | "checkpoint"
    | "hazard"
    | "composition"
    | "style"
    | "performance"
    | "difficulty"
    | "onboarding"
    | "retention-readiness"
    | "confidence"
    | "policy";
  resultKind: ResultKind;
  sourceKind: SourceKind;
  status: "available" | "not-applicable" | "missing-evidence" | "failed";
  value: MetricValue;
  normalizedScore?: number;
  severity: "info" | "warning" | "error" | "blocking";
  blocking: boolean;
  invariantId?: StableId;
  /**
   * @minItems 1
   * @maxItems 4096
   */
  evidenceIds: [string, ...string[]];
  /**
   * @maxItems 64
   */
  thresholdsApplied: {
    thresholdId: StableId;
    classification: "invariant" | "provisional" | "calibration-required";
    matched: boolean;
  }[];
  /**
   * @maxItems 64
   */
  limitations: string[];
  calculationHash: ContentHash;
}
export interface Confidence {
  value: number;
  basis: StableId;
  /**
   * @maxItems 64
   */
  limitations: string[];
  sampleCount?: number;
}
export interface VersionRef {
  component: StableId;
  version: SemanticVersion;
  buildHash?: ContentHash;
}
export interface EvidenceRecord {
  schemaVersion: SchemaVersion;
  evidenceId?: OpaqueId;
  executionId?: OpaqueId;
  capturedAt?: Timestamp;
  kind: "geometry-fact" | "route-transition" | "runtime-observation";
  manifestHash: ContentHash;
  subject: EvaluationSubject;
  producer: VersionRef;
  payload: GeometryFactPayload | RouteTransitionPayload | RuntimeObservationReferencePayload;
  /**
   * @maxItems 4096
   */
  parentEvidenceHashes: ContentHash[];
  /**
   * @maxItems 256
   */
  artifactHashes: {
    role: StableId;
    contentHash: ContentHash;
  }[];
  quality: {
    completeness: "complete" | "partial" | "missing";
    /**
     * @maxItems 64
     */
    validityCodes: StableId[];
  };
  /**
   * @maxItems 64
   */
  limitations: string[];
  evidenceContentHash: ContentHash;
}
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}
export interface GeometryFactPayload {
  kind: "geometry-fact";
  /**
   * @minItems 1
   * @maxItems 2048
   */
  objectIds: [StableId, ...StableId[]];
  factKind: "normalized-object" | "axis-aligned-bounds" | "top-surface" | "transition-input";
  geometryHash: ContentHash;
}
export interface RouteTransitionPayload {
  kind: "route-transition";
  transitionId: OpaqueId;
  fromObjectId: StableId;
  toObjectId: StableId;
  normalizationHash: ContentHash;
}
export interface RuntimeObservationReferencePayload {
  kind: "runtime-observation";
  runtimeObservationContentHash: ContentHash;
}
export interface RuntimeObservationContent {
  schemaVersion: SchemaVersion;
  kind: "scene-loaded" | "character-spawned" | "transition-attempt";
  manifestHash: ContentHash;
  subject: EvaluationSubject;
  playerSlot?: StableId;
  controllerProfileRef?: StableId;
  sequence: number;
  monotonicOffsetMs: number;
  collector: VersionRef;
  payload:
    | {
        kind: "scene-loaded";
        ready: boolean;
      }
    | {
        kind: "character-spawned";
        rootTransform: Transform;
      }
    | {
        kind: "transition-attempt";
        transitionId: OpaqueId;
        result: "success" | "failure" | "aborted";
      };
  runtimeObservationContentHash: ContentHash;
}
export interface Transform {
  position: Vector3;
  rotationDegrees: Vector3;
}
export interface RuntimeObservationEnvelope {
  schemaVersion: SchemaVersion;
  runtimeObservationContentHash: ContentHash;
  observationId: OpaqueId;
  executionId: OpaqueId;
  sessionId: OpaqueId;
  generationToken: OpaqueId;
  observedAt: Timestamp;
  collectorSequence: number;
  runtimeObservationEnvelopeHash: ContentHash;
}
export interface AvailabilityRecord {
  schemaVersion: SchemaVersion;
  subject: AvailabilitySubject;
  availabilityState: "available" | "restricted" | "deleted";
  reasonCode: StableId;
  /**
   * @maxItems 32
   */
  reasonDetails: {
    code: StableId;
    value: string;
  }[];
  authority: {
    authorityKind: StableId;
    authorityId: string;
  };
  effectiveAt?: Timestamp;
  effectiveSequence?: number;
  /**
   * @maxItems 128
   */
  supersedesAvailabilityRecordHashes: ContentHash[];
  policy: VersionRef;
  successor?: AvailabilitySubject;
  impactScope: {
    scopeKind: "subject-only" | "subject-and-derived" | "reference-snapshot" | "dataset-release";
    /**
     * @minItems 1
     * @maxItems 4096
     */
    affectedIdentityHashes: [ContentHash, ...ContentHash[]];
  };
  availabilityRecordHash: ContentHash;
}
export interface AvailabilitySubject {
  kind: "evidence" | "artifact" | "reference";
  stableId: OpaqueId;
  contentHash: ContentHash;
}
export interface Finding {
  schemaVersion: SchemaVersion;
  findingId: StableId;
  executionId?: OpaqueId;
  ruleId: StableId;
  ruleVersion: SemanticVersion;
  /**
   * @maxItems 64
   */
  metricIds: StableId[];
  title: string;
  summary: string;
  severity: "info" | "warning" | "error" | "blocking";
  blocking: boolean;
  invariantId?: StableId;
  sourceKind: SourceKind;
  /**
   * @minItems 1
   * @maxItems 64
   */
  subjects: [EvaluationSubject, ...EvaluationSubject[]];
  /**
   * @minItems 1
   * @maxItems 4096
   */
  evidenceIds: [OpaqueId, ...OpaqueId[]];
  /**
   * @maxItems 64
   */
  limitations: string[];
}
export interface GeometryObjectInput {
  schemaVersion: SchemaVersion;
  objectId: StableId;
  shape: "Block" | "Ball" | "Cylinder" | "Wedge";
  authority: "native-gameplay" | "decorative";
  collision: {
    canCollide: boolean;
    canTouch: boolean;
    canQuery: boolean;
  };
  gameplayOwnership: "native-part" | "none";
  promotionStatus: "not-applicable" | "not-promoted";
  transform: Transform;
  size: PositiveVector3;
  safeRouteRef?: {
    routeId: StableId;
    stageId?: StableId;
    stageIndex?: number;
    globalIndex: number;
  };
}
export interface PositiveVector3 {
  x: number;
  y: number;
  z: number;
}
export interface TransitionInput {
  schemaVersion: SchemaVersion;
  transitionId: string;
  routeId: StableId;
  fromObjectId: StableId;
  toObjectId: StableId;
  fromGlobalIndex: number;
  toGlobalIndex: number;
  controllerProfileRef: StableId;
}
export interface CalculationBundlePreimage {
  schemaVersion: SchemaVersion;
  manifestHash: ContentHash;
  configurationHash: ContentHash;
  evaluatorVersion: SemanticVersion;
  metricCatalogHash: ContentHash;
  scoringProfileHash: ContentHash;
  environmentCompatibilityClass: StableId;
  /**
   * @maxItems 4096
   */
  evidence: {
    kind: EvidenceKind;
    subjectKey: OpaqueId;
    evidenceContentHash: ContentHash;
  }[];
  /**
   * @maxItems 128
   */
  ruleVersions: VersionRef[];
  calculationBundleHash?: ContentHash;
}

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
  | ControllerProfile
  | Finding
  | GeometryObjectInput
  | TransitionInput
  | CalculationBundlePreimage
  | MetricCalculationPreimage
  | ReportPayloadPreimage
  | ReportRenderPreimage;
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
  | "route-graph"
  | "route-transition"
  | "coarse-transition-state"
  | "route-playability-summary"
  | "transition-evidence-conflict"
  | "checkpoint-topology"
  | "finish-topology"
  | "hazard-relationship"
  | "skip-candidate"
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
  | DeterministicFact
  | HeuristicEstimate
  | LearnedEstimate
  | AnalyticsDerivedEstimate
  | HumanJudgment
  | DerivedComposite;
export type DeterministicFact = MetricResultBase & {
  resultKind: "deterministic-fact";
  sourceKind: "deterministic";
  confidence: Confidence & {
    value?: 1;
  };
  method: VersionRef;
};
export type SourceKind =
  | "deterministic"
  | "heuristic"
  | "learned"
  | "analytics-derived"
  | "subjective"
  | "derived";
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
export type EvidenceRecordContract = Omit<EvidenceRecord, "kind" | "payload"> &
  (
    | { kind: "geometry-fact"; payload: GeometryFactPayload }
    | { kind: "route-graph"; payload: RouteGraphPayload }
    | { kind: "route-transition"; payload: RouteTransitionPayload }
    | { kind: "coarse-transition-state"; payload: CoarseTransitionStatePayload }
    | {
        kind: "route-playability-summary";
        payload: RoutePlayabilitySummaryPayload;
      }
    | {
        kind: "transition-evidence-conflict";
        payload: TransitionEvidenceConflictPayload;
      }
    | { kind: "checkpoint-topology"; payload: CheckpointTopologyPayload }
    | { kind: "finish-topology"; payload: FinishTopologyPayload }
    | { kind: "hazard-relationship"; payload: HazardRelationshipPayload }
    | { kind: "skip-candidate"; payload: SkipCandidatePayload }
    | {
        kind: "runtime-observation";
        payload: RuntimeObservationReferencePayload;
      }
  );
export type EvaluationSubject =
  | {
      kind: "scene";
    }
  | {
      kind: "object";
      objectId: ObjectId;
    }
  | {
      kind: "transition";
      fromObjectId: ObjectId;
      toObjectId: ObjectId;
      fromGlobalIndex: number;
      toGlobalIndex: number;
    }
  | {
      kind: "point";
      point: Vector3;
    };
export type ObjectId = string;
export type RouteTransitionId = string;
export type LandingRegionEvidence =
  | {
      status: "available";
      method: "exact-planar-intrinsic-edge-spans-v1";
      approximationKind: "exact-native-primitive";
      spanAStuds: number;
      spanBStuds: number;
      toleranceStuds: number;
      /**
       * @maxItems 32
       */
      limitations: string[];
    }
  | {
      status: "unavailable";
      reasonCode: "insufficient-landing-evidence";
      /**
       * @maxItems 64
       */
      missingEvidenceHashes: ContentHash[];
      /**
       * @minItems 1
       * @maxItems 32
       */
      limitations: [string, ...string[]];
    };
export type RuntimeObservationContentContract = Omit<
  RuntimeObservationContent,
  "kind" | "payload"
> &
  (
    | {
        kind: "scene-loaded";
        payload: Extract<
          RuntimeObservationContent["payload"],
          { kind: "scene-loaded" }
        >;
      }
    | {
        kind: "character-spawned";
        payload: Extract<
          RuntimeObservationContent["payload"],
          { kind: "character-spawned" }
        >;
      }
    | {
        kind: "transition-attempt";
        payload: Extract<
          RuntimeObservationContent["payload"],
          { kind: "transition-attempt" }
        >;
      }
  );
export type AvailabilityRecordContract = Omit<
  AvailabilityRecord,
  "effectiveAt" | "effectiveSequence"
> &
  (
    | { effectiveAt: Timestamp; effectiveSequence?: never }
    | { effectiveAt?: never; effectiveSequence: number }
  );
export type ProfileConstantClassification =
  "invariant" | "provisional" | "calibration-required";

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
    }[],
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
    }[],
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
      categoryId:
        "playability" | "checkpoint" | "hazard" | "policy" | "performance";
      /**
       * @maxItems 256
       */
      metricIds: StableId[];
      availability: "available" | "planned";
    },
    ...{
      categoryId:
        "playability" | "checkpoint" | "hazard" | "policy" | "performance";
      /**
       * @maxItems 256
       */
      metricIds: StableId[];
      availability: "available" | "planned";
    }[],
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
      outputKind:
        "report-payload" | "rendered-report" | "evidence-index" | "explanation";
      outputFormat?: "json" | "markdown" | "html";
      renderProfileId?: StableId;
    },
    ...{
      outputKind:
        "report-payload" | "rendered-report" | "evidence-index" | "explanation";
      outputFormat?: "json" | "markdown" | "html";
      renderProfileId?: StableId;
    }[],
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
  status:
    | "queued"
    | "validating"
    | "analyzing"
    | "finalized"
    | "rejected"
    | "cancelled"
    | "failed";
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
  kind:
    | "geometry-fact"
    | "route-graph"
    | "route-transition"
    | "coarse-transition-state"
    | "route-playability-summary"
    | "transition-evidence-conflict"
    | "checkpoint-topology"
    | "finish-topology"
    | "hazard-relationship"
    | "skip-candidate"
    | "runtime-observation";
  manifestHash: ContentHash;
  subject: EvaluationSubject;
  producer: VersionRef;
  payload:
    | GeometryFactPayload
    | RouteGraphPayload
    | RouteTransitionPayload
    | CoarseTransitionStatePayload
    | RoutePlayabilitySummaryPayload
    | TransitionEvidenceConflictPayload
    | CheckpointTopologyPayload
    | FinishTopologyPayload
    | HazardRelationshipPayload
    | SkipCandidatePayload
    | RuntimeObservationReferencePayload;
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
  objectIds: [ObjectId, ...ObjectId[]];
  factKind:
    | "normalized-object"
    | "axis-aligned-bounds"
    | "top-surface"
    | "transition-input";
  geometryHash: ContentHash;
  reproduction?: EvidenceReproduction;
}
export interface EvidenceReproduction {
  methodId: StableId;
  /**
   * @maxItems 64
   */
  inputHashes: ContentHash[];
}
export interface RouteGraphPayload {
  kind: "route-graph";
  routeId: StableId;
  /**
   * @minItems 1
   * @maxItems 128
   */
  stageIds: [StableId, ...StableId[]];
  /**
   * @minItems 2
   * @maxItems 10000
   */
  orderedNodeIds: [ObjectId, ObjectId, ...ObjectId[]];
  /**
   * @minItems 1
   * @maxItems 10000
   */
  orderedTransitionIds: [RouteTransitionId, ...RouteTransitionId[]];
  spawnObjectId: ObjectId;
  /**
   * @maxItems 1000
   */
  checkpointObjectIds: ObjectId[];
  finishObjectId: ObjectId;
  structuralState: "connected" | "disconnected";
  reproduction: EvidenceReproduction;
}
export interface RouteTransitionPayload {
  kind: "route-transition";
  transitionId: RouteTransitionId;
  fromObjectId: ObjectId;
  toObjectId: ObjectId;
  fromGlobalIndex: number;
  toGlobalIndex: number;
  sourceGeometryHash: ContentHash;
  destinationGeometryHash: ContentHash;
  /**
   * @minItems 1
   * @maxItems 64
   */
  measurementSourceEvidenceHashes: [ContentHash, ...ContentHash[]];
  normalizationHash: ContentHash;
  reproduction: EvidenceReproduction;
}
export interface CoarseTransitionStatePayload {
  kind: "coarse-transition-state";
  metricId: "playability.coarse-transition-state";
  resultId: StableId;
  transitionId: RouteTransitionId;
  fromObjectId: ObjectId;
  toObjectId: ObjectId;
  controllerProfileId: StableId;
  controllerProfileVersion: SemanticVersion;
  controllerProfileHash: ContentHash;
  /**
   * @minItems 1
   * @maxItems 64
   */
  inputEvidenceHashes: [ContentHash, ...ContentHash[]];
  normalizedInputHash: ContentHash;
  state: "feasible-under-model" | "infeasible-under-model" | "indeterminate";
  /**
   * @maxItems 16
   */
  reasonCodes: (
    | "missing-horizontal-separation"
    | "missing-vertical-rise"
    | "missing-downward-drop"
    | "unsupported-surface-measurement"
    | "insufficient-landing-evidence"
    | "landing-region-too-small"
    | "horizontal-gap-exceeds-profile"
    | "vertical-rise-exceeds-profile"
    | "downward-drop-exceeds-profile"
  )[];
  horizontalGapStuds: number;
  verticalRiseStuds: number;
  downwardDropStuds: number;
  landingRegion: LandingRegionEvidence;
  sourceSurfaceKind: StableId;
  destinationSurfaceKind: StableId;
  approximationMethod: StableId;
  geometryToleranceStuds: number;
  confidenceBasis: "deterministic-model-rule-bounded-inputs";
  reproduction: EvidenceReproduction;
}
export interface RoutePlayabilitySummaryPayload {
  kind: "route-playability-summary";
  routeId: StableId;
  transitionCount: number;
  feasibleUnderModelCount: number;
  coarseInfeasibleTransitionCount: number;
  coarseIndeterminateTransitionCount: number;
  excessiveDropTransitionCount: number;
  clearanceEstimateState: "indeterminate-no-overhead-route-metadata";
  reproduction: EvidenceReproduction;
}
export interface TransitionEvidenceConflictPayload {
  kind: "transition-evidence-conflict";
  transitionId: RouteTransitionId;
  coarseEvidenceHash: ContentHash;
  runtimeEvidenceHash: ContentHash;
  conflictState:
    | "agree"
    | "runtime-success-vs-coarse-infeasible"
    | "runtime-failure-vs-coarse-feasible"
    | "insufficient-runtime"
    | "incompatible";
  reproduction: EvidenceReproduction;
}
export interface CheckpointTopologyPayload {
  kind: "checkpoint-topology";
  checkpointObjectId: ObjectId;
  routeId: StableId;
  stageId: StableId;
  stageIndex: number;
  routeIndex: number;
  checkpointOrder: number;
  spawnReachable: boolean;
  finishReachableAfterCheckpoint: boolean;
  gameplayAuthoritative: boolean;
  progressionDirection: "forward" | "backward" | "indeterminate";
  progressionStateScope: "per-player";
  runtimeIsolationState: "not-evaluated";
  reproduction: EvidenceReproduction;
}
export interface FinishTopologyPayload {
  kind: "finish-topology";
  finishObjectId: ObjectId;
  routeId: StableId;
  routeIndex: number;
  requiredFinishCount: number;
  onRequiredRoute: boolean;
  afterAllCheckpoints: boolean;
  structurallyReachable: boolean;
  coarsePathState:
    | "feasible-under-model"
    | "contains-infeasible-under-model"
    | "indeterminate";
  gameplayAuthoritative: boolean;
  reproduction: EvidenceReproduction;
}
export interface HazardRelationshipPayload {
  kind: "hazard-relationship";
  hazardObjectId: ObjectId;
  routeObjectId?: ObjectId;
  relationship:
    | "landing-surface-overlap"
    | "landing-surface-fully-consumed"
    | "route-envelope-overlap"
    | "kill-floor-bounds"
    | "structural-enclosure";
  assessment: "candidate" | "not-detected" | "indeterminate";
  geometryMethod: StableId;
  approximationKind: "conservative-bounds";
  geometryToleranceStuds: number;
  hazardGameplayAuthoritative: boolean;
  reproduction: EvidenceReproduction;
}
export interface SkipCandidatePayload {
  kind: "skip-candidate";
  candidateId: StableId;
  fromObjectId: ObjectId;
  toObjectId: ObjectId;
  fromRouteIndex: number;
  toRouteIndex: number;
  /**
   * @minItems 1
   * @maxItems 5
   */
  candidateKinds: [
    (
      | "non-adjacent-route-edge"
      | "checkpoint-bypass"
      | "spawn-to-late-stage"
      | "checkpoint-to-finish"
      | "required-stage-skip"
    ),
    ...(
      | "non-adjacent-route-edge"
      | "checkpoint-bypass"
      | "spawn-to-late-stage"
      | "checkpoint-to-finish"
      | "required-stage-skip"
    )[],
  ];
  /**
   * @maxItems 1000
   */
  skippedStageIndexes: number[];
  modelState: "candidate";
  geometryMethod: StableId;
  reproduction: EvidenceReproduction;
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
    scopeKind:
      | "subject-only"
      | "subject-and-derived"
      | "reference-snapshot"
      | "dataset-release";
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
export interface ControllerProfile {
  schemaVersion: SchemaVersion;
  profileId: StableId;
  profileVersion: SemanticVersion;
  modelId: "e1-coarse-surface-transition-v1";
  maximumHorizontalGap: ProfileDistanceConstant;
  maximumRise: ProfileDistanceConstant;
  maximumDownwardDrop: ProfileDistanceConstant;
  avatarDimensions: {
    width: number;
    depth: number;
    unit: "studs";
    classification: ProfileConstantClassification;
  };
  requiredLandingMargin: ProfileDistanceConstant;
  /**
   * @minItems 1
   * @maxItems 4
   */
  supportedSurfaceKinds: [
    "planar-face" | "circular-endcap" | "wedge-slope" | "curved-surface",
    ...("planar-face" | "circular-endcap" | "wedge-slope" | "curved-surface")[],
  ];
  tolerancePolicy: {
    comparisonToleranceStuds: number;
    boundaryRule: "inclusive-with-tolerance";
    classification: ProfileConstantClassification;
  };
  /**
   * @minItems 1
   * @maxItems 64
   */
  limitations: [string, ...string[]];
  controllerProfileHash: ContentHash;
}
export interface ProfileDistanceConstant {
  value: number;
  unit: "studs";
  classification: ProfileConstantClassification;
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
  objectId: ObjectId;
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
  transitionId: RouteTransitionId;
  routeId: StableId;
  fromObjectId: ObjectId;
  toObjectId: ObjectId;
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
export interface MetricCalculationPreimage {
  schemaVersion: SchemaVersion;
  metricDefinitionHash: ContentHash;
  deterministicParametersHash: ContentHash;
  /**
   * @maxItems 4096
   */
  evidence: {
    kind: EvidenceKind;
    subjectKey: string;
    evidenceContentHash: ContentHash;
  }[];
  /**
   * @maxItems 256
   */
  parentCalculations: {
    metricId: StableId;
    calculationHash: ContentHash;
  }[];
  result: {
    status: "available" | "not-applicable" | "missing-evidence" | "failed";
    value?: MetricValue;
    normalizedScore?: number;
  };
  /**
   * @maxItems 64
   */
  thresholdsApplied: {
    thresholdId: StableId;
    classification: ProfileConstantClassification;
    matched: boolean;
  }[];
  confidence: Confidence;
  /**
   * @maxItems 64
   */
  limitations: {
    code: StableId;
    text: string;
  }[];
  calculationHash?: ContentHash;
}
export interface ReportPayloadPreimage {
  schemaVersion: SchemaVersion;
  calculationBundleHash: ContentHash;
  scene: {
    manifestHash: ContentHash;
    manifestSchemaVersion: SemanticVersion;
  };
  plan: {
    configurationHash: ContentHash;
    evaluationRequestHash: ContentHash;
  };
  versions: {
    evaluator: VersionRef;
    metricCatalogHash: ContentHash;
    scoringProfileHash: ContentHash;
  };
  outcome:
    | "pass"
    | "pass-with-warnings"
    | "fail-under-profile"
    | "fail"
    | "incomplete";
  /**
   * @maxItems 4096
   */
  blockingFindingIds: StableId[];
  scoreProfile: {
    profileId: StableId;
    profileVersion: SemanticVersion;
    compatibilityClass: StableId;
    aggregateScore: false;
    /**
     * @maxItems 32
     */
    categories: ReportCategoryResult[];
  };
  /**
   * @maxItems 4096
   */
  metrics: EvaluationMetric[];
  /**
   * @maxItems 4096
   */
  findings: Finding[];
  /**
   * @maxItems 4096
   */
  evidenceIndex: {
    evidenceId: OpaqueId;
    kind: EvidenceKind;
    subjectKey: string;
    evidenceContentHash: ContentHash;
    /**
     * @maxItems 64
     */
    artifactHashes: ContentHash[];
  }[];
  /**
   * @maxItems 4096
   */
  missingEvidence: {
    capability?: Capability;
    metricId?: StableId;
    reasonCode: StableId;
    consequence: string;
  }[];
  comparability: {
    compatibilityClass: StableId;
    comparisonGroupHash?: ContentHash;
    /**
     * @maxItems 64
     */
    compatibleDimensions: StableId[];
  };
  /**
   * @maxItems 128
   */
  limitations: {
    code: StableId;
    text: string;
  }[];
  derivedFrom?: {
    reportPayloadHash: ContentHash;
    /**
     * @minItems 1
     * @maxItems 4096
     */
    availabilityRecordHashes: [ContentHash, ...ContentHash[]];
    reproduction?: "complete" | "partial" | "impossible";
  };
  reportPayloadHash?: ContentHash;
}
export interface ReportCategoryResult {
  categoryId: StableId;
  status:
    | "available"
    | "unavailable"
    | "missing-evidence"
    | "not-applicable"
    | "incomplete";
  /**
   * @maxItems 256
   */
  metricIds: StableId[];
  confidence?: Confidence;
  classification: ProfileConstantClassification;
}
export interface ReportRenderPreimage {
  schemaVersion: SchemaVersion;
  reportPayloadHash: ContentHash;
  renderer: VersionRef;
  template: VersionRef;
  locale: string;
  configurationHash: ContentHash;
  outputFormat: "markdown" | "html" | "json";
  renderedBytesHash: ContentHash;
  reportRenderHash?: ContentHash;
}

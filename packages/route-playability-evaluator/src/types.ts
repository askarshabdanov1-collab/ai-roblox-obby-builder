import type { SceneManifest } from "@obby/contracts";
import type {
  ControllerProfile,
  EvidenceRecordContract,
  Finding,
} from "@obby/obby-evaluator-contracts";
import type {
  ConservativeMeasurement,
  NormalizedGeometryObject,
  NormalizedTransitionInput,
} from "@obby/geometry-evaluator";

export type RouteGraphNode = {
  objectId: string;
  role: SceneManifest["layers"]["gameplay"]["objects"][number]["role"];
  stageId: string;
  stageIndex: number;
  routeIndex: number;
};

export type RouteGraphEdge = {
  transitionId: string;
  fromObjectId: string;
  toObjectId: string;
  fromRouteIndex: number;
  toRouteIndex: number;
  required: true;
};

export type RouteGraph = {
  schemaVersion: "0.1";
  routeId: string;
  stages: readonly {
    stageId: string;
    stageIndex: number;
    objectIds: readonly string[];
  }[];
  nodes: readonly RouteGraphNode[];
  edges: readonly RouteGraphEdge[];
  spawnObjectId: string;
  checkpointObjectIds: readonly string[];
  finishObjectId: string;
  hazardObjectIds: readonly string[];
  sideBranches: readonly [];
};

export type CoarseTransitionState =
  "feasible-under-model" | "infeasible-under-model" | "indeterminate";

export type CoarseTransitionReasonCode =
  | "missing-horizontal-separation"
  | "missing-vertical-rise"
  | "missing-downward-drop"
  | "unsupported-surface-measurement"
  | "insufficient-landing-evidence"
  | "landing-region-too-small"
  | "horizontal-gap-exceeds-profile"
  | "vertical-rise-exceeds-profile"
  | "downward-drop-exceeds-profile";

export type AvailableTransitionMeasurement = ConservativeMeasurement & {
  status: "available";
};

export type UnavailableTransitionMeasurement = {
  status: "unavailable";
  reasonCode: Extract<
    CoarseTransitionReasonCode,
    | "missing-horizontal-separation"
    | "missing-vertical-rise"
    | "missing-downward-drop"
    | "unsupported-surface-measurement"
  >;
  missingEvidenceHashes: readonly `sha256:${string}`[];
  limitations: readonly string[];
};

export type TransitionMeasurementEvidence =
  AvailableTransitionMeasurement | UnavailableTransitionMeasurement;

export type AvailableLandingRegionEvidence = {
  status: "available";
  method: "exact-planar-intrinsic-edge-spans-v1";
  approximationKind: "exact-native-primitive";
  spanAStuds: number;
  spanBStuds: number;
  toleranceStuds: number;
  limitations: readonly string[];
};

export type UnavailableLandingRegionEvidence = {
  status: "unavailable";
  reasonCode: "insufficient-landing-evidence";
  missingEvidenceHashes: readonly `sha256:${string}`[];
  limitations: readonly string[];
};

export type LandingRegionEvidence =
  AvailableLandingRegionEvidence | UnavailableLandingRegionEvidence;

export type CoarseTransitionInput = Omit<
  NormalizedTransitionInput,
  "horizontalSeparation" | "verticalRise" | "downwardDrop"
> & {
  horizontalSeparation: ConservativeMeasurement | TransitionMeasurementEvidence;
  verticalRise: ConservativeMeasurement | TransitionMeasurementEvidence;
  downwardDrop: ConservativeMeasurement | TransitionMeasurementEvidence;
  landingRegion?: LandingRegionEvidence;
};

export type CoarseTransitionResult = {
  resultId: string;
  metricId: "playability.coarse-transition-state";
  transitionId: string;
  routeId: string;
  sourceObjectId: string;
  destinationObjectId: string;
  fromGlobalIndex: number;
  toGlobalIndex: number;
  controllerProfileId: string;
  controllerProfileVersion: string;
  controllerProfileHash: `sha256:${string}`;
  inputEvidenceHashes: readonly `sha256:${string}`[];
  state: CoarseTransitionState;
  reasonCodes: readonly CoarseTransitionReasonCode[];
  confidenceBasis: "deterministic-model-rule-bounded-inputs";
  confidenceSemantics: "deterministic-rule-result-not-probability";
  limitations: readonly string[];
  reproduction: {
    methodId: "coarse-transition-classifier";
    methodVersion: "2.0.0";
    inputEvidenceHashes: readonly `sha256:${string}`[];
    normalizedInputs: {
      horizontalSeparation: TransitionMeasurementEvidence;
      verticalRise: TransitionMeasurementEvidence;
      downwardDrop: TransitionMeasurementEvidence;
      landingRegion: LandingRegionEvidence;
      sourceSurfaceKind: string;
      destinationSurfaceKind: string;
    };
  };
};

export type RouteEvaluationIssue = {
  code: string;
  subject: string;
  message: string;
};

export type RouteEvaluationLimits = {
  maxRoutes: number;
  maxNodes: number;
  maxTransitions: number;
  maxCheckpoints: number;
  maxHazards: number;
  maxEvidenceRecords: number;
  maxTraversalWork: number;
};

export type RoutePlayabilityEvaluation = {
  routeGraph: RouteGraph;
  geometryById: ReadonlyMap<string, NormalizedGeometryObject>;
  transitions: readonly NormalizedTransitionInput[];
  transitionStates: readonly CoarseTransitionResult[];
  evidence: readonly EvidenceRecordContract[];
  findings: readonly Finding[];
};

export type RoutePlayabilityInput = {
  manifest: SceneManifest;
  controllerProfile: ControllerProfile;
  limits?: Partial<RouteEvaluationLimits>;
};

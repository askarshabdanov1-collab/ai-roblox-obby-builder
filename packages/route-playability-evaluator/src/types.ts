import type { SceneManifest } from "@obby/contracts";
import type {
  ControllerProfile,
  EvidenceRecordContract,
  Finding,
} from "@obby/obby-evaluator-contracts";
import type {
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

export type CoarseTransitionResult = {
  resultId: string;
  metricId: "playability.coarse-transition-state";
  transition: NormalizedTransitionInput;
  state: CoarseTransitionState;
  confidenceBasis: "deterministic-model-rule-bounded-inputs";
  limitations: readonly string[];
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

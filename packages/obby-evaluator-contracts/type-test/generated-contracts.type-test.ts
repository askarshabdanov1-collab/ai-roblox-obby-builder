import type {
  AvailabilityRecordContract,
  DeterministicFact,
  EvidenceRecordContract,
  GeometryObjectInput,
  RouteTransitionPayload,
  RuntimeObservationContentContract,
} from "../src/generated/evaluator-contracts.js";
import { assertEvaluationRequestMatchesPlan } from "../src/integrity.js";

declare const deterministicWithoutKind: Omit<
  DeterministicFact,
  "resultKind" | "sourceKind"
>;
// @ts-expect-error Generated discriminants are required.
const missingMetricDiscriminants: DeterministicFact = deterministicWithoutKind;

declare const evidenceCommon: Omit<EvidenceRecordContract, "kind" | "payload">;
declare const routePayload: RouteTransitionPayload;
// @ts-expect-error Outer and payload evidence kinds must correlate.
const mismatchedEvidence: EvidenceRecordContract = {
  ...evidenceCommon,
  kind: "geometry-fact",
  payload: routePayload,
};

declare const observationCommon: Omit<
  RuntimeObservationContentContract,
  "kind" | "payload"
>;
declare const transitionPayload: Extract<
  RuntimeObservationContentContract["payload"],
  { kind: "transition-attempt" }
>;
// @ts-expect-error Outer and payload runtime observation kinds must correlate.
const mismatchedObservation: RuntimeObservationContentContract = {
  ...observationCommon,
  kind: "scene-loaded",
  payload: transitionPayload,
};

declare const availabilityCommon: Omit<
  AvailabilityRecordContract,
  "effectiveAt" | "effectiveSequence"
>;
// @ts-expect-error Availability records require exactly one effective identity.
const missingAvailabilityIdentity: AvailabilityRecordContract =
  availabilityCommon;
// @ts-expect-error Availability records prohibit both effective identities.
const duplicateAvailabilityIdentity: AvailabilityRecordContract = {
  ...availabilityCommon,
  effectiveAt: "2030-01-01T00:00:00Z",
  effectiveSequence: 1,
};

const closedGeometry: GeometryObjectInput = {
  schemaVersion: "0.1",
  objectId: "platform-a",
  shape: "Block",
  authority: "native-gameplay",
  collision: { canCollide: true, canTouch: true, canQuery: true },
  gameplayOwnership: "native-part",
  promotionStatus: "not-applicable",
  transform: {
    position: { x: 0, y: 0, z: 0 },
    rotationDegrees: { x: 0, y: 0, z: 0 },
  },
  size: { x: 1, y: 1, z: 1 },
  // @ts-expect-error Closed schema objects reject unknown properties.
  arbitrary: true,
};

void missingMetricDiscriminants;
void mismatchedEvidence;
void mismatchedObservation;
void missingAvailabilityIdentity;
void duplicateAvailabilityIdentity;
void closedGeometry;

declare const requestInput: unknown;
declare const planInput: unknown;
// @ts-expect-error Request-plan binding requires the complete identity graph.
assertEvaluationRequestMatchesPlan(requestInput, planInput);

import {
  compareUnicodeScalars,
  normalizeNumber,
  sha256,
} from "@obby/canonical-json";
import {
  assertValidEvidenceGraph,
  verifyControllerProfileIdentity,
  type ControllerProfile,
  type EvidenceRecordContract,
} from "@obby/obby-evaluator-contracts";
import type {
  ConservativeMeasurement,
  SurfaceDescriptor,
} from "@obby/geometry-evaluator";

import type {
  CoarseTransitionInput,
  CoarseTransitionReasonCode,
  CoarseTransitionResult,
  EvidenceBackedClassificationContext,
  LandingRegionEvidence,
  TransitionMeasurementEvidence,
  UnavailableTransitionMeasurement,
} from "./types.js";

export type CoarseSurfaceKind =
  "planar-face" | "circular-endcap" | "wedge-slope" | "curved-surface";

export type CoarseTransitionValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export class CoarseTransitionValidationError extends TypeError {
  public constructor(
    public readonly issues: readonly CoarseTransitionValidationIssue[],
  ) {
    super(
      `invalid-coarse-transition-input: ${issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
    );
    this.name = "CoarseTransitionValidationError";
  }
}

type MeasurementField =
  "horizontalSeparation" | "verticalRise" | "downwardDrop";

const EXPECTED_METHOD = Object.freeze({
  horizontalSeparation: "world-aabb-horizontal-separation",
  verticalRise: "surface-envelope-height-delta",
  downwardDrop: "surface-envelope-height-delta",
} satisfies Record<MeasurementField, ConservativeMeasurement["method"]>);

const MISSING_REASON = Object.freeze({
  horizontalSeparation: "missing-horizontal-separation",
  verticalRise: "missing-vertical-rise",
  downwardDrop: "missing-downward-drop",
} satisfies Record<MeasurementField, CoarseTransitionReasonCode>);

function validationFailure(code: string, path: string, message: string): never {
  throw new CoarseTransitionValidationError([{ code, path, message }]);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return validationFailure("object", path, "must be an object");
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const allowedSet = new Set(allowed);
  const extra = Object.keys(value)
    .filter((key) => !allowedSet.has(key))
    .toSorted(compareUnicodeScalars)[0];
  if (extra !== undefined) {
    validationFailure(
      "additional-property",
      `${path}/${extra}`,
      "is not allowed for this measurement variant",
    );
  }
}

function limitations(value: unknown, path: string): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    return validationFailure(
      "limitations",
      path,
      "must be an array of strings",
    );
  }
  return [...new Set(value as string[])].toSorted(compareUnicodeScalars);
}

function hashes(value: unknown, path: string): readonly `sha256:${string}`[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (entry) =>
        typeof entry !== "string" || !/^sha256:[0-9a-f]{64}$/.test(entry),
    )
  ) {
    return validationFailure(
      "content-hashes",
      path,
      "must contain SHA-256 content hashes",
    );
  }
  return [...new Set(value as `sha256:${string}`[])].toSorted(
    compareUnicodeScalars,
  );
}

function evidenceHashes(
  context: EvidenceBackedClassificationContext,
  transition: CoarseTransitionInput,
): readonly `sha256:${string}`[] {
  if (
    typeof context.expectedManifestHash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/.test(context.expectedManifestHash)
  ) {
    return validationFailure(
      "expected-manifest-hash",
      "/expectedManifestHash",
      "must be a SHA-256 content hash",
    );
  }
  if (
    !Array.isArray(context.evidenceRecords) ||
    context.evidenceRecords.length === 0
  ) {
    return validationFailure(
      "input-evidence-required",
      "/inputEvidenceRecords",
      "evidence-backed classification requires a complete evidence graph",
    );
  }
  let verified: EvidenceRecordContract[];
  try {
    verified = assertValidEvidenceGraph(
      context.evidenceRecords,
    ) as EvidenceRecordContract[];
  } catch {
    return validationFailure(
      "input-evidence-graph",
      "/inputEvidenceRecords",
      "must be a complete valid evidence graph",
    );
  }
  const matching = verified.filter(
    (candidate) =>
      candidate.manifestHash === context.expectedManifestHash &&
      candidate.kind === "route-transition" &&
      candidate.subject.kind === "transition" &&
      candidate.subject.fromObjectId === transition.fromObjectId &&
      candidate.subject.toObjectId === transition.toObjectId &&
      candidate.subject.fromGlobalIndex === transition.fromGlobalIndex &&
      candidate.subject.toGlobalIndex === transition.toGlobalIndex &&
      candidate.payload.transitionId === transition.transitionId &&
      candidate.payload.fromObjectId === transition.fromObjectId &&
      candidate.payload.toObjectId === transition.toObjectId &&
      candidate.payload.fromGlobalIndex === transition.fromGlobalIndex &&
      candidate.payload.toGlobalIndex === transition.toGlobalIndex,
  );
  if (matching.length === 0) {
    return validationFailure(
      "transition-evidence-required",
      "/inputEvidenceRecords",
      "must contain one matching route-transition record in the expected manifest",
    );
  }
  if (matching.length !== 1) {
    return validationFailure(
      "ambiguous-transition-evidence",
      "/inputEvidenceRecords",
      "must contain exactly one matching route-transition record",
    );
  }
  const selected = matching[0];
  if (selected === undefined) {
    return validationFailure(
      "transition-evidence-required",
      "/inputEvidenceRecords",
      "must contain one matching route-transition record",
    );
  }
  const byHash = new Map(
    verified.map((candidate) => [candidate.evidenceContentHash, candidate]),
  );
  const parents = selected.parentEvidenceHashes.map((hash) => byHash.get(hash));
  const hasGeometryParent = parents.some(
    (parent) =>
      parent?.kind === "geometry-fact" &&
      parent.manifestHash === context.expectedManifestHash,
  );
  const hasRouteParent = parents.some(
    (parent) =>
      parent?.kind === "route-graph" &&
      parent.manifestHash === context.expectedManifestHash &&
      parent.payload.routeId === transition.routeId,
  );
  if (!hasGeometryParent || !hasRouteParent) {
    return validationFailure(
      "transition-evidence-parents",
      "/inputEvidenceRecords",
      "matching route-transition evidence must resolve geometry-fact and route-graph parents",
    );
  }
  return hashes(
    [selected.evidenceContentHash],
    "/inputEvidenceRecords/evidenceContentHashes",
  );
}

function measurement(
  value: unknown,
  field: MeasurementField,
): TransitionMeasurementEvidence {
  const path = `/${field}`;
  const candidate = record(value, path);
  if (candidate.status === "unavailable") {
    exactKeys(
      candidate,
      ["status", "reasonCode", "missingEvidenceHashes", "limitations"],
      path,
    );
    if (
      candidate.reasonCode !== MISSING_REASON[field] &&
      candidate.reasonCode !== "unsupported-surface-measurement"
    ) {
      return validationFailure(
        "reason-code",
        `${path}/reasonCode`,
        `must be ${MISSING_REASON[field]} or unsupported-surface-measurement`,
      );
    }
    const stableLimitations = limitations(
      candidate.limitations,
      `${path}/limitations`,
    );
    return {
      status: "unavailable",
      reasonCode: candidate.reasonCode,
      missingEvidenceHashes: hashes(
        candidate.missingEvidenceHashes,
        `${path}/missingEvidenceHashes`,
      ),
      limitations:
        stableLimitations.length > 0
          ? stableLimitations
          : [`Required ${field} evidence is unavailable.`],
    } as UnavailableTransitionMeasurement;
  }
  if (candidate.status !== "available") {
    return validationFailure(
      "status",
      `${path}/status`,
      "must be available or unavailable",
    );
  }
  exactKeys(
    candidate,
    [
      "status",
      "value",
      "method",
      "approximationKind",
      "toleranceStuds",
      "evidenceHashes",
      "limitations",
      "applicability",
    ],
    path,
  );
  if (
    typeof candidate.value !== "number" ||
    !Number.isFinite(candidate.value) ||
    candidate.value < 0
  ) {
    return validationFailure(
      "measurement-value",
      `${path}/value`,
      "must be a finite non-negative number",
    );
  }
  if (typeof candidate.method !== "string") {
    return validationFailure(
      "measurement-method",
      `${path}/method`,
      "must be a string",
    );
  }
  const candidateLimitations = limitations(
    candidate.limitations,
    `${path}/limitations`,
  );
  const candidateEvidenceHashes = hashes(
    candidate.evidenceHashes,
    `${path}/evidenceHashes`,
  );
  if (candidate.method !== EXPECTED_METHOD[field]) {
    return {
      status: "unavailable",
      reasonCode: "unsupported-surface-measurement",
      missingEvidenceHashes: [],
      limitations: [
        ...candidateLimitations,
        `Unsupported ${field} method ${candidate.method}.`,
      ].toSorted(compareUnicodeScalars),
    };
  }
  if (
    (candidate.approximationKind !== "conservative-bounds-delta" &&
      candidate.approximationKind !== "conservative-lower-bound") ||
    typeof candidate.toleranceStuds !== "number" ||
    !Number.isFinite(candidate.toleranceStuds) ||
    candidate.toleranceStuds < 0 ||
    candidate.applicability !== "broad-phase-only"
  ) {
    return validationFailure(
      "measurement-contract",
      path,
      "available measurement metadata is malformed",
    );
  }
  return {
    status: "available",
    value: candidate.value,
    method: candidate.method,
    approximationKind: candidate.approximationKind,
    toleranceStuds: candidate.toleranceStuds,
    evidenceHashes: candidateEvidenceHashes,
    limitations: candidateLimitations,
    applicability: "broad-phase-only",
  };
}

function distance(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
): number {
  return normalizeNumber(
    Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z),
    12,
  );
}

export function unavailableLandingRegion(
  limitationsInput: readonly string[],
  missingEvidenceHashes: readonly `sha256:${string}`[] = [],
): LandingRegionEvidence {
  const stableLimitations = [...new Set(limitationsInput)].toSorted(
    compareUnicodeScalars,
  );
  return {
    status: "unavailable",
    reasonCode: "insufficient-landing-evidence",
    missingEvidenceHashes: [...new Set(missingEvidenceHashes)].toSorted(
      compareUnicodeScalars,
    ),
    limitations:
      stableLimitations.length > 0
        ? stableLimitations
        : ["Required destination landing-region evidence is unavailable."],
  };
}

export function landingRegionForSurface(
  surface: SurfaceDescriptor,
): LandingRegionEvidence {
  const face =
    surface.kind === "planar-face"
      ? surface
      : surface.kind === "wedge-surfaces"
        ? surface.slopedFace
        : undefined;
  if (face === undefined) {
    return unavailableLandingRegion([
      "The destination surface has no supported exact planar landing region.",
    ]);
  }
  const spans = [
    distance(face.corners[0], face.corners[1]),
    distance(face.corners[1], face.corners[2]),
  ].toSorted((left, right) => left - right);
  return {
    status: "available",
    method: "exact-planar-intrinsic-edge-spans-v1",
    approximationKind: "exact-native-primitive",
    spanAStuds: spans[0] ?? 0,
    spanBStuds: spans[1] ?? 0,
    toleranceStuds: 1e-9,
    limitations: [
      "Landing fit uses intrinsic planar edge spans and does not model character pose or input timing.",
    ],
  };
}

function landingRegion(
  value: unknown,
  destinationSurface: SurfaceDescriptor,
): LandingRegionEvidence {
  if (value === undefined) return landingRegionForSurface(destinationSurface);
  const candidate = record(value, "/landingRegion");
  if (candidate.status === "unavailable") {
    if (candidate.reasonCode !== "insufficient-landing-evidence") {
      return validationFailure(
        "reason-code",
        "/landingRegion/reasonCode",
        "must be insufficient-landing-evidence",
      );
    }
    return unavailableLandingRegion(
      limitations(candidate.limitations, "/landingRegion/limitations"),
      hashes(
        candidate.missingEvidenceHashes,
        "/landingRegion/missingEvidenceHashes",
      ),
    );
  }
  if (
    candidate.status !== "available" ||
    candidate.method !== "exact-planar-intrinsic-edge-spans-v1" ||
    candidate.approximationKind !== "exact-native-primitive"
  ) {
    return validationFailure(
      "landing-region-contract",
      "/landingRegion",
      "available landing evidence must use the supported exact planar method",
    );
  }
  for (const field of ["spanAStuds", "spanBStuds", "toleranceStuds"] as const) {
    if (
      typeof candidate[field] !== "number" ||
      !Number.isFinite(candidate[field]) ||
      candidate[field] < 0
    ) {
      return validationFailure(
        "landing-region-value",
        `/landingRegion/${field}`,
        "must be a finite non-negative number",
      );
    }
  }
  const spanAStuds = candidate.spanAStuds as number;
  const spanBStuds = candidate.spanBStuds as number;
  const toleranceStuds = candidate.toleranceStuds as number;
  const spans = [spanAStuds, spanBStuds].toSorted(
    (left, right) => left - right,
  );
  return {
    status: "available",
    method: "exact-planar-intrinsic-edge-spans-v1",
    approximationKind: "exact-native-primitive",
    spanAStuds: spans[0] ?? 0,
    spanBStuds: spans[1] ?? 0,
    toleranceStuds,
    limitations: limitations(
      candidate.limitations,
      "/landingRegion/limitations",
    ),
  };
}

export function coarseSurfaceKind(
  surface: SurfaceDescriptor,
): CoarseSurfaceKind {
  if (surface.kind === "planar-face") return "planar-face";
  if (surface.kind === "wedge-surfaces") return "wedge-slope";
  if (surface.kind === "spherical-surface") return "curved-surface";
  return surface.upwardFacingCandidate === "curved-side"
    ? "curved-surface"
    : "circular-endcap";
}

function classifyWithVerifiedProfile(
  input: CoarseTransitionInput,
  profile: ControllerProfile,
  evidenceContext?: EvidenceBackedClassificationContext,
): CoarseTransitionResult {
  const transition = record(input, "/") as unknown as CoarseTransitionInput;
  const inputEvidenceHashes: readonly `sha256:${string}`[] =
    evidenceContext === undefined
      ? []
      : evidenceHashes(evidenceContext, transition);
  const horizontalSeparation = measurement(
    transition.horizontalSeparation,
    "horizontalSeparation",
  );
  const verticalRise = measurement(transition.verticalRise, "verticalRise");
  const downwardDrop = measurement(transition.downwardDrop, "downwardDrop");
  const sourceKind = coarseSurfaceKind(transition.sourceSurface);
  const destinationKind = coarseSurfaceKind(transition.destinationSurface);
  const destinationLanding = landingRegion(
    transition.landingRegion,
    transition.destinationSurface,
  );
  const supported = new Set(profile.supportedSurfaceKinds);
  const reasonCodes: CoarseTransitionReasonCode[] = [];
  const allLimitations = [
    "Classification is relative to the selected deterministic model, not exact Roblox physics.",
    ...horizontalSeparation.limitations,
    ...verticalRise.limitations,
    ...downwardDrop.limitations,
    ...destinationLanding.limitations,
  ];

  if (!supported.has(sourceKind) || !supported.has(destinationKind)) {
    reasonCodes.push("unsupported-surface-measurement");
    allLimitations.push(
      `Unsupported surface combination ${sourceKind} to ${destinationKind}.`,
    );
  }
  for (const candidate of [horizontalSeparation, verticalRise, downwardDrop]) {
    if (candidate.status === "unavailable") {
      reasonCodes.push(candidate.reasonCode);
    }
  }
  if (destinationLanding.status === "unavailable") {
    reasonCodes.push(destinationLanding.reasonCode);
  }

  const tolerance = profile.tolerancePolicy.comparisonToleranceStuds;
  if (
    horizontalSeparation.status === "available" &&
    horizontalSeparation.value > profile.maximumHorizontalGap.value + tolerance
  ) {
    reasonCodes.push("horizontal-gap-exceeds-profile");
  }
  if (
    verticalRise.status === "available" &&
    verticalRise.value > profile.maximumRise.value + tolerance
  ) {
    reasonCodes.push("vertical-rise-exceeds-profile");
  }
  if (
    downwardDrop.status === "available" &&
    downwardDrop.value > profile.maximumDownwardDrop.value + tolerance
  ) {
    reasonCodes.push("downward-drop-exceeds-profile");
  }
  if (destinationLanding.status === "available") {
    const available = [
      destinationLanding.spanAStuds,
      destinationLanding.spanBStuds,
    ].toSorted((left, right) => left - right);
    const required = [
      profile.avatarDimensions.width + 2 * profile.requiredLandingMargin.value,
      profile.avatarDimensions.depth + 2 * profile.requiredLandingMargin.value,
    ].toSorted((left, right) => left - right);
    const landingTolerance = Math.max(
      tolerance,
      destinationLanding.toleranceStuds,
    );
    if (
      (available[0] ?? 0) + landingTolerance < (required[0] ?? 0) ||
      (available[1] ?? 0) + landingTolerance < (required[1] ?? 0)
    ) {
      reasonCodes.push("landing-region-too-small");
    }
  }

  const uniqueReasons = [...new Set(reasonCodes)].toSorted(
    compareUnicodeScalars,
  );
  const unavailable = uniqueReasons.some((reason) =>
    [
      "missing-horizontal-separation",
      "missing-vertical-rise",
      "missing-downward-drop",
      "unsupported-surface-measurement",
      "insufficient-landing-evidence",
    ].includes(reason),
  );
  const state = unavailable
    ? "indeterminate"
    : uniqueReasons.length > 0
      ? "infeasible-under-model"
      : "feasible-under-model";
  const normalizedInputs = {
    horizontalSeparation,
    verticalRise,
    downwardDrop,
    landingRegion: destinationLanding,
    sourceSurfaceKind: sourceKind,
    destinationSurfaceKind: destinationKind,
  };
  const normalizedInputHash = sha256({
    domain: "coarse-transition-normalized-input-v2",
    transitionId: transition.transitionId,
    normalizedInputs,
  });
  const profileHash = profile.controllerProfileHash as `sha256:${string}`;
  return {
    resultId: `coarse.${transition.routeId}.${transition.fromGlobalIndex}.${transition.toGlobalIndex}`,
    metricId: "playability.coarse-transition-state",
    transitionId: transition.transitionId,
    routeId: transition.routeId,
    sourceObjectId: transition.fromObjectId,
    destinationObjectId: transition.toObjectId,
    fromGlobalIndex: transition.fromGlobalIndex,
    toGlobalIndex: transition.toGlobalIndex,
    controllerProfileId: profile.profileId,
    controllerProfileVersion: profile.profileVersion,
    controllerProfileHash: profileHash,
    inputEvidenceHashes,
    state,
    reasonCodes: uniqueReasons,
    confidenceBasis: "deterministic-model-rule-bounded-inputs",
    confidenceSemantics: "deterministic-rule-result-not-probability",
    limitations: [...new Set(allLimitations)].toSorted(compareUnicodeScalars),
    reproduction: {
      methodId: "coarse-transition-classifier",
      methodVersion: "2.0.0",
      inputEvidenceHashes,
      normalizedInputHash,
      normalizedInputs,
    },
  };
}

export type CoarseTransitionClassifier = Readonly<{
  profile: ControllerProfile;
  classify: (input: CoarseTransitionInput) => CoarseTransitionResult;
  classifyWithEvidence: (
    input: CoarseTransitionInput,
    context: EvidenceBackedClassificationContext,
  ) => CoarseTransitionResult;
}>;

export function createCoarseTransitionClassifier(
  inputProfile: ControllerProfile,
): CoarseTransitionClassifier {
  const profile = verifyControllerProfileIdentity(inputProfile);
  return Object.freeze({
    profile,
    classify: (input: CoarseTransitionInput) =>
      classifyWithVerifiedProfile(input, profile),
    classifyWithEvidence: (
      input: CoarseTransitionInput,
      context: EvidenceBackedClassificationContext,
    ) => classifyWithVerifiedProfile(input, profile, context),
  });
}

export function classifyCoarseTransition(
  input: CoarseTransitionInput,
  inputProfile: ControllerProfile,
): CoarseTransitionResult {
  return createCoarseTransitionClassifier(inputProfile).classify(input);
}

export function classifyCoarseTransitionWithEvidence(
  input: CoarseTransitionInput,
  inputProfile: ControllerProfile,
  context: EvidenceBackedClassificationContext,
): CoarseTransitionResult {
  return createCoarseTransitionClassifier(inputProfile).classifyWithEvidence(
    input,
    context,
  );
}

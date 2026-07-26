import {
  verifyControllerProfileIdentity,
  type ControllerProfile,
} from "@obby/obby-evaluator-contracts";
import type {
  NormalizedTransitionInput,
  SurfaceDescriptor,
} from "@obby/geometry-evaluator";

import type { CoarseTransitionResult } from "./types.js";

export type CoarseSurfaceKind =
  "planar-face" | "circular-endcap" | "wedge-slope" | "curved-surface";

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

export function classifyCoarseTransition(
  transition: NormalizedTransitionInput,
  inputProfile: ControllerProfile,
): CoarseTransitionResult {
  const profile = verifyControllerProfileIdentity(inputProfile);
  const sourceKind = coarseSurfaceKind(transition.sourceSurface);
  const destinationKind = coarseSurfaceKind(transition.destinationSurface);
  const supported = new Set(profile.supportedSurfaceKinds);
  let state: CoarseTransitionResult["state"];
  const limitations = [
    "Classification is relative to the selected deterministic model, not exact Roblox physics.",
    ...transition.horizontalSeparation.limitations,
    ...transition.verticalRise.limitations,
    ...transition.downwardDrop.limitations,
  ];
  if (!supported.has(sourceKind) || !supported.has(destinationKind)) {
    state = "indeterminate";
    limitations.push(
      `Unsupported surface combination ${sourceKind} to ${destinationKind}.`,
    );
  } else {
    const tolerance = profile.tolerancePolicy.comparisonToleranceStuds;
    const exceeds =
      transition.horizontalSeparation.value >
        profile.maximumHorizontalGap.value + tolerance ||
      transition.verticalRise.value > profile.maximumRise.value + tolerance ||
      transition.downwardDrop.value >
        profile.maximumDownwardDrop.value + tolerance;
    state = exceeds ? "infeasible-under-model" : "feasible-under-model";
  }
  return {
    resultId: `coarse.${transition.routeId}.${transition.fromGlobalIndex}.${transition.toGlobalIndex}`,
    metricId: "playability.coarse-transition-state",
    transition,
    state,
    confidenceBasis: "deterministic-model-rule-bounded-inputs",
    limitations: [...new Set(limitations)].toSorted(),
  };
}

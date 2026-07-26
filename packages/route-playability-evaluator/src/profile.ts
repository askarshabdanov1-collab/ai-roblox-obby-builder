import { sha256 } from "@obby/canonical-json";
import {
  hashControllerProfile,
  verifyControllerProfileIdentity,
  type ControllerProfile,
} from "@obby/obby-evaluator-contracts";

export function createDefaultControllerProfile(): ControllerProfile {
  const profile: ControllerProfile = {
    schemaVersion: "0.1",
    profileId: "e1-r15-provisional",
    profileVersion: "1.0.0",
    modelId: "e1-coarse-surface-transition-v1",
    maximumHorizontalGap: {
      value: 6,
      unit: "studs",
      classification: "provisional",
    },
    maximumRise: {
      value: 5,
      unit: "studs",
      classification: "provisional",
    },
    maximumDownwardDrop: {
      value: 20,
      unit: "studs",
      classification: "provisional",
    },
    avatarDimensions: {
      width: 4,
      height: 5,
      depth: 2,
      unit: "studs",
      classification: "provisional",
    },
    requiredLandingMargin: {
      value: 1,
      unit: "studs",
      classification: "calibration-required",
    },
    supportedSurfaceKinds: ["planar-face", "wedge-slope"],
    tolerancePolicy: {
      comparisonToleranceStuds: 1e-9,
      boundaryRule: "inclusive-with-tolerance",
      classification: "invariant",
    },
    limitations: [
      "Provisional deterministic engineering limits are not exact Roblox physics.",
      "Momentum, input timing, networking, and dynamic obstacles are not modeled.",
    ],
    controllerProfileHash: sha256({
      domain: "controller-profile-hash-placeholder-v1",
    }),
  };
  profile.controllerProfileHash = hashControllerProfile(profile).hash;
  return verifyControllerProfileIdentity(profile);
}

export type * from "./generated/generator-contracts.js";

export type ContentHash = `sha256:${string}`;
export type DifficultyTarget = "easy" | "medium" | "hard";
export type AssetPolicy =
  | "native-parts-only"
  | "approved-local-assets"
  | "external-assets-allowed-later";
export type ThemeFamily = "classic" | "sky" | "space" | "lava" | "jungle";
export type TargetAudience = "all-ages" | "general" | "experienced";
export type AccessibilityConstraint =
  | "color-independent-cues"
  | "high-readability"
  | "reduced-motion"
  | "motion-required";
export type MechanicCapability =
  "g1-static-supported" | "future-runtime-supported" | "deferred";
export type DifficultyBandName =
  "tutorial" | "easy" | "medium" | "hard" | "climax" | "recovery";
export type StageRole =
  | "onboarding"
  | "practice"
  | "escalation"
  | "variation"
  | "challenge"
  | "recovery"
  | "climax"
  | "finish-approach";

export type LayoutEngineErrorCode =
  | "validation"
  | "work-limit"
  | "maximum-work-units"
  | "stale-authority"
  | "unsupported-authority"
  | "unsupported-mechanic"
  | "deferred-mechanic"
  | "packing-limit"
  | "geometry-integrity"
  | "reachability-infeasible"
  | "reachability-indeterminate"
  | "output-limit"
  | "callback-failed"
  | "invariant";

export class LayoutEngineError extends Error {
  public constructor(
    public readonly code: LayoutEngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LayoutEngineError";
  }
}

export type LayoutWorkEstimateInput = {
  stageCount: number;
  definitionCount: number;
  hazardCount: number;
  assetIntentCount: number;
};

export type LayoutWorkAdmission = {
  requiredWorkUnits: number;
  admittedWorkUnits: number;
  availableWorkUnits: number;
  unusedWorkUnits: number;
};

export type LayoutCoveredOperation =
  | "input-snapshot"
  | "work-admission"
  | "authority-validation"
  | "seed-derivation"
  | "route-packing"
  | "recipe-expansion"
  | "geometry-integrity"
  | "reachability-classification"
  | "bundle-validation"
  | "serialization-preparation";

export type LayoutPhase =
  | "safe-shape-check"
  | "snapshot-complete"
  | "work-admission"
  | "callbacks"
  | "semantic-validation"
  | "layout-generation"
  | "publication-validation";

export type GenerateLayoutOptions = {
  onWorkAdmitted?: (admission: Readonly<LayoutWorkAdmission>) => void;
  onCoveredOperation?: (operation: LayoutCoveredOperation) => void;
  onPhaseTrace?: (phases: readonly LayoutPhase[]) => void;
};

export type SerpentineCell = Readonly<{
  index: number;
  row: number;
  column: number;
  x: number;
  z: number;
}>;

export type NativePartRecipeMetadata = Readonly<{
  recipeId: string;
  recipeVersion: "2.0.0";
  primitiveFamily: "native-parts";
  gameplayAuthority: "native-gameplay";
}>;

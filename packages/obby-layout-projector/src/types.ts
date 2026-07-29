export type LayoutProjectionErrorCode =
  | "input-snapshot"
  | "work-limit"
  | "stale-provenance"
  | "unsupported-version"
  | "invalid-reference"
  | "reachability-infeasible"
  | "reachability-indeterminate"
  | "output-limit"
  | "invariant";

export class LayoutProjectionError extends Error {
  public constructor(
    public readonly code: LayoutProjectionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LayoutProjectionError";
  }
}

export type ProjectionWorkAdmission = Readonly<{
  requiredWorkUnits: number;
  availableWorkUnits: number;
  unusedWorkUnits: number;
}>;

export type ProjectLayoutOptions = {
  maxWorkUnits?: number;
  onWorkAdmitted?: (admission: ProjectionWorkAdmission) => void;
};

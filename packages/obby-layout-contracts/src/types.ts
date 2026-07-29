import type {
  LayoutBundle,
  LayoutConfiguration,
  LayoutSpec,
  MechanicLayoutDefinition,
} from "./generated/layout-contracts.js";

export type LayoutConfigurationPreimage = Omit<
  LayoutConfiguration,
  "configurationHash" | "limits"
> & {
  limits: Omit<LayoutConfiguration["limits"], "maxWorkUnits">;
};
export type MechanicLayoutDefinitionPreimage = Omit<
  MechanicLayoutDefinition,
  "mechanicLayoutDefinitionHash"
>;
export type LayoutSpecPreimage = Omit<LayoutSpec, "layoutSpecHash">;
export type LayoutBundlePreimage = Omit<LayoutBundle, "layoutBundleHash">;

export type LayoutContractErrorCode =
  | "schema"
  | "hash-mismatch"
  | "stale-authority"
  | "invalid-reference"
  | "duplicate-id"
  | "invariant"
  | "unsupported-mechanic";

export class LayoutContractError extends Error {
  public constructor(
    public readonly code: LayoutContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LayoutContractError";
  }
}

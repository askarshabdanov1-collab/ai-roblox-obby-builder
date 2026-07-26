import { compileFromFile } from "json-schema-to-typescript";
import { format } from "prettier";

export const evaluatorContractSchemaPath =
  "packages/obby-evaluator-contracts/schemas/evaluator-contracts.schema.json";
export const evaluatorContractTypePath =
  "packages/obby-evaluator-contracts/src/generated/evaluator-contracts.ts";

const typeOptions = {
  bannerComment:
    "/* Generated from evaluator-contracts.schema.json. Do not edit. */",
  additionalProperties: false,
  maxItems: -1,
} as const;

export function postprocessEvaluatorContractTypes(source: string): string {
  return source
    .replaceAll("  [k: string]: unknown;\n", "")
    .replaceAll("resultKind?:", "resultKind:")
    .replaceAll("sourceKind?:", "sourceKind:")
    .replace(
      /export type EvidenceRecordContract = EvidenceRecord & \{\};/,
      `export type EvidenceRecordContract = Omit<EvidenceRecord, "kind" | "payload"> & (
  | { kind: "geometry-fact"; payload: GeometryFactPayload }
  | { kind: "route-graph"; payload: RouteGraphPayload }
  | { kind: "route-transition"; payload: RouteTransitionPayload }
  | { kind: "coarse-transition-state"; payload: CoarseTransitionStatePayload }
  | { kind: "route-playability-summary"; payload: RoutePlayabilitySummaryPayload }
  | { kind: "transition-evidence-conflict"; payload: TransitionEvidenceConflictPayload }
  | { kind: "checkpoint-topology"; payload: CheckpointTopologyPayload }
  | { kind: "finish-topology"; payload: FinishTopologyPayload }
  | { kind: "hazard-relationship"; payload: HazardRelationshipPayload }
  | { kind: "skip-candidate"; payload: SkipCandidatePayload }
  | { kind: "softlock-candidate"; payload: SoftlockCandidatePayload }
  | { kind: "runtime-observation"; payload: RuntimeObservationReferencePayload }
);`,
    )
    .replace(
      /export type RuntimeObservationContentContract = RuntimeObservationContent & \{\};/,
      `export type RuntimeObservationContentContract = Omit<RuntimeObservationContent, "kind" | "payload"> & (
  | { kind: "scene-loaded"; payload: Extract<RuntimeObservationContent["payload"], { kind: "scene-loaded" }> }
  | { kind: "character-spawned"; payload: Extract<RuntimeObservationContent["payload"], { kind: "character-spawned" }> }
  | { kind: "transition-attempt"; payload: Extract<RuntimeObservationContent["payload"], { kind: "transition-attempt" }> }
);`,
    )
    .replace(
      /export type AvailabilityRecordContract = AvailabilityRecord &\n {2}\(\n {4}\| \{\n {8}effectiveAt: unknown;\n {6}\}\n {4}\| \{\n {8}effectiveSequence: unknown;\n {6}\}\n {2}\);/,
      `export type AvailabilityRecordContract = Omit<AvailabilityRecord, "effectiveAt" | "effectiveSequence"> & (
  | { effectiveAt: Timestamp; effectiveSequence?: never }
  | { effectiveAt?: never; effectiveSequence: number }
);`,
    );
}

export async function expectedEvaluatorContractTypes(): Promise<
  Record<string, string>
> {
  const compiled = await compileFromFile(
    evaluatorContractSchemaPath,
    typeOptions,
  );
  return {
    [evaluatorContractTypePath]: await format(
      postprocessEvaluatorContractTypes(compiled),
      { parser: "typescript" },
    ),
  };
}

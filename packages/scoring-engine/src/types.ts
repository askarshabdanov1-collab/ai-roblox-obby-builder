import type {
  ContentHash,
  EvaluationMetric,
  EvidenceRecordContract,
  Finding,
  MetricCatalog,
  ReportCategoryResult,
  ReportPayloadPreimage,
  ScoringProfile,
  SemanticVersion,
  VersionRef,
} from "@obby/obby-evaluator-contracts";

export type InvariantGateEvaluation = {
  invariantId: string;
  state: "pass" | "fail" | "missing-evidence";
  evidenceIds: readonly string[];
  findingIds: readonly string[];
};

export type ProfileGateEvaluation = {
  gateId: string;
  state: "pass" | "fail" | "missing-evidence";
  classification: "provisional" | "calibration-required";
  evidenceIds: readonly string[];
  findingIds: readonly string[];
};

export type E1ReportInput = {
  identities: {
    calculationBundleHash: ContentHash;
    manifestHash: ContentHash;
    manifestSchemaVersion: SemanticVersion;
    configurationHash: ContentHash;
    evaluationRequestHash: ContentHash;
    evaluator: VersionRef;
  };
  catalog: MetricCatalog;
  scoringProfile: ScoringProfile;
  invariantGates: readonly InvariantGateEvaluation[];
  profileGates: readonly ProfileGateEvaluation[];
  categories: readonly ReportCategoryResult[];
  metrics: readonly EvaluationMetric[];
  findings: readonly Finding[];
  evidence: readonly EvidenceRecordContract[];
  missingEvidence: ReportPayloadPreimage["missingEvidence"];
  limitations: ReportPayloadPreimage["limitations"];
  compatibleDimensions: readonly string[];
};

export type FinalizedE1Report = ReportPayloadPreimage & {
  reportPayloadHash: ContentHash;
};

export class ScoringContractError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ScoringContractError";
  }
}

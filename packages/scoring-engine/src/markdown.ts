import {
  EVALUATOR_CANONICAL_JSON_ALGORITHM,
  canonicalizeEvaluatorSnapshot,
  compareUnicodeScalars,
  sha256Bytes,
} from "@obby/canonical-json";
import {
  hashRenderedBytes,
  hashReportRender,
  parseReportPayloadPreimage,
  verifyReportPayloadIdentity,
  verifyReportRenderIdentity,
  type ReportRenderPreimage,
} from "@obby/obby-evaluator-contracts";

import type { FinalizedE1Report } from "./types.js";

const RENDERER = Object.freeze({
  component: "e1-markdown-renderer",
  version: "1.0.0",
});
const TEMPLATE = Object.freeze({
  component: "e1-report-template",
  version: "1.0.0",
});
const CONFIGURATION_HASH = sha256Bytes(
  canonicalizeEvaluatorSnapshot({
    canonicalizationAlgorithm: EVALUATOR_CANONICAL_JSON_ALGORITHM,
    renderer: RENDERER,
    template: TEMPLATE,
    locale: "en-US",
    outputFormat: "markdown",
  }).canonicalBytes,
);

export type RenderedMarkdownReport = ReportRenderPreimage & {
  reportRenderHash: `sha256:${string}`;
  bytes: Uint8Array;
};

function cell(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

function valueText(
  value:
    | { kind: string; value: boolean | number | string; unit?: string }
    | undefined,
): string {
  if (value === undefined) return "unavailable";
  return `${String(value.value)}${value.unit === undefined ? "" : ` ${value.unit}`}`;
}

export function renderMarkdownReport(
  input: FinalizedE1Report,
  options: { verifyIdentity?: boolean } = {},
): RenderedMarkdownReport {
  const report =
    options.verifyIdentity === false
      ? parseReportPayloadPreimage(input)
      : verifyReportPayloadIdentity(input);
  if (report.reportPayloadHash === undefined) {
    throw new Error("Markdown rendering requires reportPayloadHash");
  }
  const categories = [...report.scoreProfile.categories].toSorted(
    (left, right) => compareUnicodeScalars(left.categoryId, right.categoryId),
  );
  const findings = [...report.findings].toSorted((left, right) =>
    compareUnicodeScalars(left.findingId, right.findingId),
  );
  const invariantGates = [...report.invariantGates].toSorted((left, right) =>
    compareUnicodeScalars(left.invariantId, right.invariantId),
  );
  const calculations = [...report.calculations].toSorted((left, right) =>
    compareUnicodeScalars(left.metricId, right.metricId),
  );
  const evidence = [...report.evidenceIndex].toSorted((left, right) =>
    compareUnicodeScalars(left.evidenceId, right.evidenceId),
  );
  const missing = [...report.missingEvidence].toSorted((left, right) =>
    compareUnicodeScalars(
      `${left.metricId ?? ""}:${left.reasonCode}`,
      `${right.metricId ?? ""}:${right.reasonCode}`,
    ),
  );
  const limitations = [...report.limitations].toSorted((left, right) =>
    compareUnicodeScalars(left.code, right.code),
  );
  const lines = [
    "# Roblox Obby Evaluation Report",
    "",
    "## Identity summary",
    "",
    `Report payload: ${report.reportPayloadHash}`,
    `Calculation bundle: ${report.calculationBundleHash}`,
    `Manifest: ${report.scene.manifestHash}`,
    `Configuration: ${report.plan.configurationHash}`,
    `Evaluation request: ${report.plan.evaluationRequestHash}`,
    `Metric catalog: ${report.versions.metricCatalogHash}`,
    `Scoring profile: ${report.versions.scoringProfileHash}`,
    `Profile: ${report.scoreProfile.profileId}@${report.scoreProfile.profileVersion}`,
    "",
    "## Executive state",
    "",
    `Outcome: ${report.outcome}`,
    "Aggregate score: unavailable (E1 does not aggregate categories)",
    "",
    "Model-relative infeasibility is not universal impossibility. Candidate findings are not confirmed failures.",
    "",
    "## Invariant gates",
    "",
    "| Invariant | State | Evidence hashes | Blocked metrics |",
    "| --- | --- | --- | --- |",
    ...invariantGates.map(
      (gate) =>
        `| ${cell(gate.invariantId)} | ${gate.state} | ${cell(gate.evidenceContentHashes.join(", ") || "none")} | ${cell(gate.blockedMetricIds.join(", ") || "none")} |`,
    ),
    "",
    "## Completeness",
    "",
    `State: ${report.completeness.state}`,
    `Requested metrics: ${cell(report.completeness.requestedMetricIds.join(", ") || "none")}`,
    `Calculated metrics: ${cell(report.completeness.calculatedMetricIds.join(", ") || "none")}`,
    `Missing metrics: ${cell(report.completeness.missingMetricIds.join(", ") || "none")}`,
    `Missing evidence kinds: ${cell(report.completeness.missingEvidenceKinds.join(", ") || "none")}`,
    "",
    "## Metric calculations",
    "",
    "| Metric | State | Value | Calculation hash | Evidence hashes |",
    "| --- | --- | --- | --- | --- |",
    ...calculations.map(
      (calculation) =>
        `| ${cell(`${calculation.metricId}@${calculation.metricVersion}`)} | ${calculation.calculationState} | ${cell(valueText(calculation.result.value))} | ${calculation.calculationHash ?? "missing"} | ${cell(calculation.evidence.map((item) => item.evidenceContentHash).join(", ") || "none")} |`,
    ),
    "",
    "## Category and profile results",
    "",
    "| Category | Status | Metrics |",
    "| --- | --- | --- |",
    ...categories.map(
      (category) =>
        `| ${cell(category.categoryId)} | ${category.status} | ${cell(category.metricIds.join(", ") || "none")} |`,
    ),
    "",
    "## Findings",
    "",
    ...(findings.length === 0
      ? ["No findings."]
      : findings.map(
          (finding) =>
            `- [${finding.severity}] ${cell(finding.title)} (${finding.findingId})`,
        )),
    "",
    "## Evidence index",
    "",
    "| Evidence ID | Kind | Subject | Content hash |",
    "| --- | --- | --- | --- |",
    ...evidence.map(
      (entry) =>
        `| ${cell(entry.evidenceId)} | ${entry.kind} | ${cell(entry.subjectKey)} | ${entry.evidenceContentHash} |`,
    ),
    "",
    "## Unavailable and deferred capabilities",
    "",
    ...(missing.length === 0
      ? ["No missing evidence declared."]
      : missing.map(
          (item) =>
            `- ${item.metricId ?? "unscoped"}: ${item.reasonCode}; capability=${item.capability ?? "unknown"}; ${cell(item.consequence)}`,
        )),
    "",
    "## Limitations",
    "",
    ...(limitations.length === 0
      ? ["No additional report-wide limitations."]
      : limitations.map(
          (limitation) => `- ${limitation.code}: ${cell(limitation.text)}`,
        )),
    "",
    "## Reproduction information",
    "",
    `Calculation bundle identity: ${report.calculationBundleHash}`,
    ...calculations.map(
      (calculation) =>
        `- ${calculation.metricId}: method=${calculation.reproduction.method.component}@${calculation.reproduction.method.version}; parameters=${calculation.reproduction.deterministicParametersHash}; inputs=${calculation.reproduction.inputEvidenceHashes.join(", ") || "none"}`,
    ),
    "",
  ];
  const bytes = new TextEncoder().encode(lines.join("\n"));
  const preimage: ReportRenderPreimage = {
    schemaVersion: "0.1",
    reportPayloadHash: report.reportPayloadHash,
    renderer: RENDERER,
    template: TEMPLATE,
    locale: "en-US",
    configurationHash: CONFIGURATION_HASH,
    outputFormat: "markdown",
    renderedBytesHash: hashRenderedBytes(bytes),
  };
  const finalized = {
    ...preimage,
    reportRenderHash: hashReportRender(preimage).hash,
  };
  verifyReportRenderIdentity(finalized);
  return { ...finalized, bytes };
}

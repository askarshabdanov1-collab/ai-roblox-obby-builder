import {
  EVALUATOR_CANONICAL_JSON_ALGORITHM,
  canonicalizeEvaluatorSnapshot,
  compareUnicodeScalars,
  sha256Bytes,
} from "@obby/canonical-json";
import {
  hashRenderedBytes,
  hashReportRender,
  verifyReportRenderIdentity,
  type ReportRenderPreimage,
} from "@obby/obby-evaluator-contracts";

import { assertValidatedE1Report } from "./report.js";
import type { ValidatedE1Report } from "./types.js";

const RENDERER = Object.freeze({
  component: "e1-markdown-renderer",
  version: "1.0.1",
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

export class MarkdownRenderLimitError extends Error {
  public constructor(
    public readonly code: "MARKDOWN_SIZE_LIMIT" | "MARKDOWN_WORK_LIMIT",
    message: string,
  ) {
    super(message);
    this.name = "MarkdownRenderLimitError";
  }
}

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r\n?|\n/gu, "\n");
}

function cell(value: string): string {
  return normalizeLineBreaks(value)
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
  input: ValidatedE1Report,
  options: { maxBytes?: number; maxWorkUnits?: number } = {},
): RenderedMarkdownReport {
  const report = assertValidatedE1Report(input);
  const categories = [...report.scoreProfile.categories].toSorted(
    (left, right) => compareUnicodeScalars(left.categoryId, right.categoryId),
  );
  const findings = [...report.findings].toSorted((left, right) =>
    compareUnicodeScalars(left.findingId, right.findingId),
  );
  const invariantGates = [...report.invariantGates].toSorted((left, right) =>
    compareUnicodeScalars(left.invariantId, right.invariantId),
  );
  const profileGates = [...report.profileGates].toSorted((left, right) =>
    compareUnicodeScalars(left.gateId, right.gateId),
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
    "| Category | Status | Metrics | Blocked by |",
    "| --- | --- | --- | --- |",
    ...categories.map((category) => {
      const blockers = invariantGates
        .filter(
          (gate) =>
            gate.state !== "pass" &&
            gate.blockedMetricIds.some((metricId) =>
              category.metricIds.includes(metricId),
            ),
        )
        .map((gate) => gate.invariantId);
      return `| ${cell(category.categoryId)} | ${category.status} | ${cell(category.metricIds.join(", ") || "none")} | ${cell(blockers.join(", ") || "none")} |`;
    }),
    "",
    "### Profile gates",
    "",
    "| Gate | Metric | State | Classification | Evidence hashes |",
    "| --- | --- | --- | --- | --- |",
    ...profileGates.map(
      (gate) =>
        `| ${cell(gate.gateId)} | ${cell(gate.metricId)} | ${gate.state} | ${gate.classification} | ${cell(gate.evidenceContentHashes.join(", ") || "none")} |`,
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
  const normalizedLines = lines.map((line) =>
    normalizeLineBreaks(line).replaceAll("\n", " "),
  );
  const encoder = new TextEncoder();
  const maximumBytes = options.maxBytes ?? Number.MAX_SAFE_INTEGER;
  const maximumWork = options.maxWorkUnits ?? Number.MAX_SAFE_INTEGER;
  let byteLength = 0;
  for (let index = 0; index < normalizedLines.length; index += 1) {
    if (index + 1 > maximumWork) {
      throw new MarkdownRenderLimitError(
        "MARKDOWN_WORK_LIMIT",
        `Markdown rendering exceeds ${maximumWork} work units`,
      );
    }
    byteLength += encoder.encode(normalizedLines[index]).byteLength;
    if (index < normalizedLines.length - 1) byteLength += 1;
    if (byteLength > maximumBytes) {
      throw new MarkdownRenderLimitError(
        "MARKDOWN_SIZE_LIMIT",
        `Markdown output exceeds ${maximumBytes} bytes`,
      );
    }
  }
  const bytes = encoder.encode(normalizedLines.join("\n"));
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

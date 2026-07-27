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

import { sortMarkdownCollection } from "./markdown-sort.js";
import { assertValidatedE1Report } from "./report.js";
import type { FinalizedE1Report, ValidatedE1Report } from "./types.js";

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
  workUnitsUsed: number;
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

const FIXED_MARKDOWN_LINE_COUNT = 66;

function safeWorkSum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    if (
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > Number.MAX_SAFE_INTEGER - total
    ) {
      throw new MarkdownRenderLimitError(
        "MARKDOWN_WORK_LIMIT",
        "Markdown rendering work exceeds the safe integer range",
      );
    }
    total += value;
  }
  return total;
}

function markdownLineWorkUnits(report: FinalizedE1Report): number {
  return safeWorkSum([
    FIXED_MARKDOWN_LINE_COUNT,
    report.invariantGates.length,
    report.calculations.length,
    report.scoreProfile.categories.length,
    report.profileGates.length,
    Math.max(1, report.findings.length),
    report.evidenceIndex.length,
    Math.max(1, report.missingEvidence.length),
    Math.max(1, report.limitations.length),
    report.calculations.length,
  ]);
}

function workCounter(maximum: number): {
  charge: (units: number) => void;
  used: () => number;
} {
  if (!Number.isSafeInteger(maximum) || maximum < 0) {
    throw new MarkdownRenderLimitError(
      "MARKDOWN_WORK_LIMIT",
      "Markdown maximum work units must be a non-negative safe integer",
    );
  }
  let used = 0;
  return {
    charge(units: number): void {
      if (!Number.isSafeInteger(units) || units < 0 || units > maximum - used) {
        throw new MarkdownRenderLimitError(
          "MARKDOWN_WORK_LIMIT",
          `Markdown rendering exceeds ${maximum} work units`,
        );
      }
      used += units;
    },
    used: () => used,
  };
}

export function renderMarkdownReport(
  input: ValidatedE1Report,
  options: { maxBytes?: number; maxWorkUnits?: number } = {},
): RenderedMarkdownReport {
  const report = assertValidatedE1Report(input);
  const maximumWork = options.maxWorkUnits ?? Number.MAX_SAFE_INTEGER;
  const work = workCounter(maximumWork);
  const expectedLineCount = markdownLineWorkUnits(report);
  work.charge(expectedLineCount);
  const categories = sortMarkdownCollection(
    report.scoreProfile.categories,
    (left, right) => compareUnicodeScalars(left.categoryId, right.categoryId),
    work.charge,
  );
  const findings = sortMarkdownCollection(
    report.findings,
    (left, right) => compareUnicodeScalars(left.findingId, right.findingId),
    work.charge,
  );
  const invariantGates = sortMarkdownCollection(
    report.invariantGates,
    (left, right) => compareUnicodeScalars(left.invariantId, right.invariantId),
    work.charge,
  );
  const profileGates = sortMarkdownCollection(
    report.profileGates,
    (left, right) => compareUnicodeScalars(left.gateId, right.gateId),
    work.charge,
  );
  const calculations = sortMarkdownCollection(
    report.calculations,
    (left, right) => compareUnicodeScalars(left.metricId, right.metricId),
    work.charge,
  );
  const evidence = sortMarkdownCollection(
    report.evidenceIndex,
    (left, right) => compareUnicodeScalars(left.evidenceId, right.evidenceId),
    work.charge,
  );
  const missing = sortMarkdownCollection(
    report.missingEvidence,
    (left, right) =>
      compareUnicodeScalars(
        `${left.metricId ?? ""}:${left.reasonCode}`,
        `${right.metricId ?? ""}:${right.reasonCode}`,
      ),
    work.charge,
  );
  const limitations = sortMarkdownCollection(
    report.limitations,
    (left, right) => compareUnicodeScalars(left.code, right.code),
    work.charge,
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
  if (normalizedLines.length !== expectedLineCount) {
    throw new Error(
      `Markdown line work model expected ${expectedLineCount} lines but rendered ${normalizedLines.length}`,
    );
  }
  const encoder = new TextEncoder();
  const maximumBytes = options.maxBytes ?? Number.MAX_SAFE_INTEGER;
  let byteLength = 0;
  for (let index = 0; index < normalizedLines.length; index += 1) {
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
  return { ...finalized, bytes, workUnitsUsed: work.used() };
}

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
  const lines = [
    "# Roblox Obby Evaluation Report",
    "",
    `Report payload: ${report.reportPayloadHash}`,
    `Outcome: ${report.outcome}`,
    `Manifest: ${report.scene.manifestHash}`,
    `Profile: ${report.scoreProfile.profileId}@${report.scoreProfile.profileVersion}`,
    "Aggregate score: unavailable (E1 does not aggregate categories)",
    "",
    "## Categories",
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
    "## Missing evidence",
    "",
    ...(report.missingEvidence.length === 0
      ? ["No missing evidence declared."]
      : report.missingEvidence.map(
          (missing) => `- ${missing.reasonCode}: ${cell(missing.consequence)}`,
        )),
    "",
    "## Limitations",
    "",
    ...(report.limitations.length === 0
      ? ["No additional report-wide limitations."]
      : report.limitations.map(
          (limitation) => `- ${limitation.code}: ${cell(limitation.text)}`,
        )),
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

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  hashAvailabilityRecord,
  hashReportPayload,
  type AvailabilityRecord,
} from "@obby/obby-evaluator-contracts";
import * as builtRoot from "@obby/scoring-engine";
import * as builtMarkdown from "../dist/markdown.js";
import * as builtReport from "../dist/report.js";

import {
  deferredRuntimeAvailability,
  evaluatorFixtureGraph,
} from "./fixtures.js";

function assembledReport() {
  const graph = evaluatorFixtureGraph();
  return {
    graph,
    result: builtRoot.assembleE1Evaluation({
      metricDefinitions: graph.metricDefinitions,
      catalog: graph.catalog,
      profile: graph.profile,
      plan: graph.plan,
      request: graph.request,
      evaluatorVersion: "0.1.0",
      componentVersions: {
        "obby-evaluator-contracts": "0.1.0",
        "geometry-evaluator": "0.1.0",
        "route-playability-evaluator": "0.1.0",
        "scoring-engine": "0.1.0",
      },
      evidence: graph.evidenceBundle.evidence,
      findings: graph.evidenceBundle.findings,
      availabilityRecords: [deferredRuntimeAvailability()],
    }),
  };
}

function rehashReport<T extends { reportPayloadHash: string }>(source: T): T {
  return {
    ...source,
    reportPayloadHash: hashReportPayload(source).hash,
  };
}

function expectTrustBoundaryViolation(action: () => unknown): void {
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ code: "unvalidated-report" });
    return;
  }
  throw new Error("expected the report trust boundary to reject input");
}

function deletionRecord(
  report: ReturnType<typeof assembledReport>["result"]["report"],
): AvailabilityRecord {
  const evidence = report.evidenceIndex[0];
  if (evidence === undefined) throw new Error("missing report evidence");
  const source: AvailabilityRecord = {
    schemaVersion: "0.1",
    subject: {
      kind: "evidence",
      stableId: evidence.evidenceId,
      contentHash: evidence.evidenceContentHash,
    },
    availabilityState: "deleted",
    reasonCode: "retention-expired",
    reasonDetails: [],
    authority: {
      authorityKind: "retention-policy",
      authorityId: "retention-policy:local",
    },
    producer: { component: "retention-policy", version: "1.0.0" },
    effectiveSequence: 1,
    supersedesAvailabilityRecordHashes: [],
    policy: { component: "retention-policy", version: "1.0.0" },
    impactScope: {
      scopeKind: "subject-only",
      affectedIdentityHashes: [evidence.evidenceContentHash],
    },
    availabilityRecordHash: `sha256:${"0".repeat(64)}`,
  };
  return {
    ...source,
    availabilityRecordHash: hashAvailabilityRecord(source).hash,
  };
}

describe("compiled validated-report trust boundary", () => {
  it("rejects caller-rehashed raw reports through package-root and direct dist entry points", () => {
    const { result } = assembledReport();
    const nonexistentBundle = structuredClone(result.report);
    nonexistentBundle.calculationBundleHash = `sha256:${"c".repeat(64)}`;
    const staleCalculation = structuredClone(result.report);
    const firstCalculation = staleCalculation.calculations[0];
    if (firstCalculation === undefined) throw new Error("missing calculation");
    firstCalculation.result.status = "failed";
    const inconsistentCompleteness = structuredClone(result.report);
    inconsistentCompleteness.completeness.state = "incomplete";
    const danglingEvidence = structuredClone(result.report);
    const firstEvidence = danglingEvidence.evidenceIndex[0];
    if (firstEvidence === undefined) throw new Error("missing evidence");
    danglingEvidence.evidenceIndex.push({
      ...firstEvidence,
      evidenceId: "evidence:dangling",
      evidenceContentHash: `sha256:${"d".repeat(64)}`,
    });
    const forged = [
      rehashReport(nonexistentBundle),
      rehashReport(structuredClone(result.report)),
      rehashReport(staleCalculation),
      rehashReport(inconsistentCompleteness),
      rehashReport(danglingEvidence),
    ];

    for (const report of forged) {
      expectTrustBoundaryViolation(() =>
        builtRoot.renderMarkdownReport(report),
      );
      expectTrustBoundaryViolation(() =>
        builtMarkdown.renderMarkdownReport(report as never),
      );
      expectTrustBoundaryViolation(() =>
        builtRoot.applyAvailabilityRecords(report, []),
      );
      expectTrustBoundaryViolation(() =>
        builtReport.applyAvailabilityRecords(report as never, []),
      );
    }
  });

  it("rejects an in-place mutation and rehash of a previously validated report", () => {
    const { result } = assembledReport();
    result.report.calculationBundleHash = `sha256:${"e".repeat(64)}`;
    result.report.reportPayloadHash = hashReportPayload(result.report).hash;

    expectTrustBoundaryViolation(() =>
      builtRoot.renderMarkdownReport(result.report),
    );
  });

  it("renders and derives availability only for reports returned by validated assembly", () => {
    const { result } = assembledReport();
    const rendered = builtRoot.renderMarkdownReport(result.report);
    const derived = builtRoot.applyAvailabilityRecords(result.report, [
      deletionRecord(result.report),
    ]);

    expect(rendered.reportPayloadHash).toBe(result.report.reportPayloadHash);
    expect(derived.derivedFrom?.reportPayloadHash).toBe(
      result.report.reportPayloadHash,
    );
    expect(() => builtRoot.renderMarkdownReport(derived)).not.toThrow();
  });

  it("publishes only branded report inputs in built declarations", () => {
    const reportDeclaration = readFileSync(
      new URL("../dist/report.d.ts", import.meta.url),
      "utf8",
    );
    const markdownDeclaration = readFileSync(
      new URL("../dist/markdown.d.ts", import.meta.url),
      "utf8",
    );
    const typeDeclaration = readFileSync(
      new URL("../dist/types.d.ts", import.meta.url),
      "utf8",
    );

    expect(reportDeclaration).toContain("source: ValidatedE1Report");
    expect(markdownDeclaration).toContain("input: ValidatedE1Report");
    expect(typeDeclaration).toContain(
      "declare const validatedE1ReportBrand: unique symbol",
    );
  });
});

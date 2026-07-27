import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type {
  MetricCatalog,
  ScoringProfile,
} from "@obby/obby-evaluator-contracts";

import { finalizeE1Report, renderMarkdownReport } from "../src/index.js";

const hash = (digit: string): `sha256:${string}` =>
  `sha256:${digit.repeat(64)}`;
const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../obby-evaluator-contracts/fixtures/generated/${name}`,
        import.meta.url,
      ),
      "utf8",
    ),
  );

function report() {
  const catalog = fixture("e1-metric-catalog.json") as MetricCatalog;
  const scoringProfile = fixture("e1-scoring-profile.json") as ScoringProfile;
  return finalizeE1Report({
    identities: {
      calculationBundleHash: hash("1"),
      manifestHash: hash("2"),
      manifestSchemaVersion: "1.0.0",
      configurationHash: hash("3"),
      evaluationRequestHash: hash("4"),
      evaluator: { component: "scoring-engine", version: "0.1.0" },
    },
    catalog,
    scoringProfile,
    invariantGates: catalog.invariantGates.map((gate) => ({
      invariantId: gate.invariantId,
      state: "pass" as const,
      evidenceIds: ["geometry:scene"],
      findingIds: [],
    })),
    profileGates: [],
    categories: scoringProfile.categories.map((entry) => ({
      categoryId: entry.categoryId,
      status: "available" as const,
      metricIds: entry.metricIds,
      confidence: {
        value: 1,
        basis: "required-evidence-complete",
        limitations: [],
      },
      classification: "provisional" as const,
    })),
    metrics: [],
    findings: [],
    evidence: [
      {
        schemaVersion: "0.1",
        evidenceId: "geometry:scene",
        kind: "geometry-fact",
        manifestHash: hash("2"),
        subject: { kind: "scene" },
        producer: { component: "geometry-evaluator", version: "0.1.0" },
        payload: {
          kind: "geometry-fact",
          objectIds: ["Start"],
          factKind: "normalized-object",
          geometryHash: hash("5"),
        },
        parentEvidenceHashes: [],
        artifactHashes: [],
        quality: { completeness: "complete", validityCodes: [] },
        limitations: [],
        evidenceContentHash: hash("6"),
      },
    ],
    missingEvidence: [],
    limitations: [],
    compatibleDimensions: ["geometry", "route"],
  });
}

describe("E1c Markdown rendering", () => {
  it("produces deterministic bytes and a separate renderer identity", () => {
    const first = renderMarkdownReport(report());
    const second = renderMarkdownReport(report());

    expect(first.bytes).toEqual(second.bytes);
    expect(first.reportRenderHash).toBe(second.reportRenderHash);
    expect(new TextDecoder().decode(first.bytes)).toContain(
      `Report payload: ${first.reportPayloadHash}`,
    );
    expect(new TextDecoder().decode(first.bytes)).not.toContain(
      first.reportRenderHash,
    );
  });

  it("renders unavailable categories explicitly without renormalization", () => {
    const source = structuredClone(report());
    const firstCategory = source.scoreProfile.categories[0];
    if (firstCategory === undefined) throw new Error("missing test category");
    firstCategory.status = "unavailable";
    source.reportPayloadHash = hash("f");
    const rerendered = renderMarkdownReport(source, { verifyIdentity: false });

    expect(new TextDecoder().decode(rerendered.bytes)).toContain(
      "| playability | unavailable |",
    );
  });
});

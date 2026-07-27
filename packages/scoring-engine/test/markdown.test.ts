import { describe, expect, it } from "vitest";

import { assembleE1Evaluation, renderMarkdownReport } from "../src/index.js";
import {
  deferredRuntimeAvailability,
  evaluatorFixtureGraph,
} from "./fixtures.js";

function report() {
  const graph = evaluatorFixtureGraph();
  return assembleE1Evaluation({
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
    findings: [],
    availabilityRecords: [deferredRuntimeAvailability()],
  }).report;
}

describe("E1c Markdown rendering", () => {
  it("produces deterministic LF-only bytes and a separate renderer identity", () => {
    const first = renderMarkdownReport(report());
    const second = renderMarkdownReport(report());
    const text = new TextDecoder().decode(first.bytes);

    expect(first.bytes).toEqual(second.bytes);
    expect(first.reportRenderHash).toBe(second.reportRenderHash);
    expect(text).toContain(`Report payload: ${first.reportPayloadHash}`);
    expect(text).not.toContain(first.reportRenderHash);
    expect(text).not.toContain("\r\n");
  });

  it("renders profile gates and unavailable runtime evidence explicitly", () => {
    const text = new TextDecoder().decode(renderMarkdownReport(report()).bytes);

    expect(text).toContain("### Profile gates");
    expect(text).toContain("required-transition-feasibility");
    expect(text).toContain("runtime.checkpoint-isolation-availability@1.0.0");
    expect(text).toContain("| unavailable |");
  });

  it("rejects an unverified report payload", () => {
    const source = structuredClone(report());
    source.outcome = "fail";

    expect(() => renderMarkdownReport(source)).toThrow(
      /reportPayloadHash content hash mismatch/i,
    );
  });

  it("fails before allocating bytes beyond the configured render limit", () => {
    expect(() => renderMarkdownReport(report(), { maxBytes: 1 })).toThrow(
      /Markdown output exceeds 1 bytes/,
    );
    expect(() => renderMarkdownReport(report(), { maxWorkUnits: 1 })).toThrow(
      /Markdown rendering exceeds 1 work units/,
    );
  });
});

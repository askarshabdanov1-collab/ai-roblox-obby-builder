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

  it("normalizes CRLF and lone CR from validated content before hashing exact Markdown bytes", () => {
    const graph = evaluatorFixtureGraph();
    const finding = structuredClone(graph.evidenceBundle.findings[0]);
    if (finding === undefined) throw new Error("missing finding fixture");
    finding.title = "finding one\r\nfinding two\rfinding three";
    const source = assembleE1Evaluation({
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
      findings: [finding],
      availabilityRecords: [deferredRuntimeAvailability()],
    }).report;
    const rendered = renderMarkdownReport(source);
    const text = new TextDecoder().decode(rendered.bytes);

    expect(rendered.bytes).not.toContain(13);
    expect(text).toContain("finding one finding two finding three");
    expect(rendered.renderedBytesHash).toBe(
      renderMarkdownReport(source).renderedBytesHash,
    );
  });

  it("renders profile gates and unavailable runtime evidence explicitly", () => {
    const text = new TextDecoder().decode(renderMarkdownReport(report()).bytes);

    expect(text).toContain("### Profile gates");
    expect(text).toContain("required-transition-feasibility");
    expect(text).toContain("runtime.checkpoint-isolation-availability@1.0.0");
    expect(text).toContain("| unavailable |");
  });

  it("rejects a cloned and mutated report outside the runtime trust boundary", () => {
    const source = structuredClone(report());
    source.outcome = "fail";

    expect(() => renderMarkdownReport(source)).toThrow(
      /unchanged object returned by validated E1 assembly/i,
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

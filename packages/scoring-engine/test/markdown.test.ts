import { describe, expect, it, vi } from "vitest";

import { assembleE1Evaluation, renderMarkdownReport } from "../src/index.js";
import { markdownSortingWorkUnits } from "../src/markdown-sort.js";
import * as markdownSort from "../src/markdown-sort.js";
import {
  deferredRuntimeAvailability,
  evaluatorFixtureGraph,
} from "./fixtures.js";

function report(reverseInput = false) {
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
    evidence: reverseInput
      ? [...graph.evidenceBundle.evidence].reverse()
      : graph.evidenceBundle.evidence,
    findings: reverseInput
      ? [...graph.evidenceBundle.findings].reverse()
      : graph.evidenceBundle.findings,
    availabilityRecords: [deferredRuntimeAvailability()],
  }).report;
}

describe("E1c Markdown rendering", () => {
  it("uses the documented overflow-safe n-log-n renderer sort cost", () => {
    expect(markdownSortingWorkUnits(0)).toBe(0);
    expect(markdownSortingWorkUnits(1)).toBe(0);
    expect(markdownSortingWorkUnits(1_900)).toBe(20_900);
    expect(() => markdownSortingWorkUnits(Number.MAX_SAFE_INTEGER)).toThrow(
      /safe integer range/,
    );
  });

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

  it("rejects a zero work budget before invoking any deterministic renderer sort", () => {
    const source = report();
    const sort = vi.spyOn(markdownSort, "sortMarkdownCollection");
    let rendered: ReturnType<typeof renderMarkdownReport> | undefined;
    let failure: unknown;

    try {
      rendered = renderMarkdownReport(source, { maxWorkUnits: 0 });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({ code: "MARKDOWN_WORK_LIMIT" });
    expect(sort).not.toHaveBeenCalled();
    expect(rendered).toBeUndefined();
    sort.mockRestore();
  });

  it("enforces exact renderer N-1, N, and N+1 work budgets deterministically", () => {
    const source = report();
    const shuffled = report(true);
    const baseline = renderMarkdownReport(source);
    const shuffledBaseline = renderMarkdownReport(shuffled);
    const requiredWork = baseline.workUnitsUsed;
    const exactLineWork = new TextDecoder()
      .decode(baseline.bytes)
      .split("\n").length;
    const exactSortWork = [
      source.scoreProfile.categories.length,
      source.findings.length,
      source.invariantGates.length,
      source.profileGates.length,
      source.calculations.length,
      source.evidenceIndex.length,
      source.missingEvidence.length,
      source.limitations.length,
    ].reduce((total, length) => total + markdownSortingWorkUnits(length), 0);

    const underfundedSort = vi.spyOn(Array.prototype, "toSorted");
    expect(() =>
      renderMarkdownReport(source, { maxWorkUnits: requiredWork - 1 }),
    ).toThrow(/Markdown rendering exceeds/);
    const underfundedLimitationSorts = underfundedSort.mock.instances.filter(
      (value) =>
        Array.isArray(value) &&
        typeof value[0] === "object" &&
        value[0] !== null &&
        "code" in value[0],
    );
    expect(underfundedLimitationSorts).toHaveLength(0);
    underfundedSort.mockRestore();

    const exactSort = vi.spyOn(Array.prototype, "toSorted");
    const exact = renderMarkdownReport(source, {
      maxWorkUnits: requiredWork,
    });
    const exactLimitationSorts = exactSort.mock.instances.filter(
      (value) =>
        Array.isArray(value) &&
        typeof value[0] === "object" &&
        value[0] !== null &&
        "code" in value[0],
    );
    expect(exactLimitationSorts).toHaveLength(1);
    exactSort.mockRestore();
    const oneSpare = renderMarkdownReport(source, {
      maxWorkUnits: requiredWork + 1,
    });

    expect(requiredWork).toBe(exactLineWork + exactSortWork);
    expect(exact.workUnitsUsed).toBe(requiredWork);
    expect(oneSpare.workUnitsUsed).toBe(requiredWork);
    expect(shuffledBaseline.workUnitsUsed).toBe(requiredWork);
    expect(exact.bytes).toEqual(oneSpare.bytes);
    expect(exact.bytes).toEqual(shuffledBaseline.bytes);
    expect(exact.reportRenderHash).toBe(oneSpare.reportRenderHash);
    expect(exact.reportRenderHash).toBe(shuffledBaseline.reportRenderHash);
  });
});

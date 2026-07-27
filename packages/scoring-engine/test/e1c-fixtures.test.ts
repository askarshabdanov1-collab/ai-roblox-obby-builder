import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  hashMetricCalculation,
  hashReportPayload,
  verifyCalculationBundleIdentity,
  verifyReportPayloadIdentity,
  type MetricCalculationPreimage,
} from "@obby/obby-evaluator-contracts";

import { validateMetricCalculations } from "../src/index.js";
import { evaluatorFixtureGraph } from "./fixtures.js";

const root = new URL("../fixtures/generated/", import.meta.url);
const read = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, root), "utf8")) as unknown;

describe("committed E1c end-to-end fixtures", () => {
  it("independently verifies calculation-bundle, calculation, and report identities", () => {
    const report = verifyReportPayloadIdentity(
      read("passing-structural-route/report.json"),
    );
    expect(hashReportPayload(report).hash).toBe(report.reportPayloadHash);
    expect(
      report.calculations.map(
        (calculation) => hashMetricCalculation(calculation).hash,
      ),
    ).toEqual(report.calculations.map((item) => item.calculationHash));
    verifyCalculationBundleIdentity(
      read("passing-structural-route/calculation-bundle.json"),
    );
  });

  it("preserves model-relative, indeterminate, invariant, candidate, and runtime-gap semantics", () => {
    const model = readFileSync(
      new URL("model-relative-transition-failure/report.md", root),
      "utf8",
    );
    const indeterminate = read("indeterminate-route/report.json") as {
      outcome: string;
    };
    const invariant = read("invariant-failure/report.json") as {
      outcome: string;
      invariantGates: { state: string }[];
    };
    const candidate = readFileSync(
      new URL("candidate-only-issues/report.md", root),
      "utf8",
    );
    const runtime = read("missing-runtime-evidence/report.json") as {
      missingEvidence: { capability?: string }[];
    };
    expect(model).toContain("infeasible-under-model");
    expect(model.toLowerCase()).not.toContain("universally impossible");
    expect(indeterminate.outcome).toBe("incomplete");
    expect(invariant.outcome).toBe("fail");
    expect(invariant.invariantGates.some((gate) => gate.state === "fail")).toBe(
      true,
    );
    expect(candidate).toContain("skip candidate");
    expect(candidate).toContain("not confirmed failures");
    expect(
      runtime.missingEvidence.some((item) => item.capability === "runtime"),
    ).toBe(true);
  });

  it("contains no placeholder hashes in positive fixtures", () => {
    for (const name of [
      "passing-structural-route",
      "model-relative-transition-failure",
      "indeterminate-route",
      "invariant-failure",
      "candidate-only-issues",
      "missing-runtime-evidence",
    ]) {
      const text = readFileSync(new URL(`${name}/report.json`, root), "utf8");
      expect(text).not.toContain(`sha256:${"0".repeat(64)}`);
    }
  });

  it("fails closed for committed stale, unresolved, duplicate, and conflicting calculations", () => {
    const graph = evaluatorFixtureGraph();
    const stale = read("invalid/stale-calculation.json");
    const unresolved = read("invalid/unresolved-evidence.json");
    const duplicate = read(
      "invalid/duplicate-calculations.json",
    ) as MetricCalculationPreimage[];
    const conflicting = read(
      "invalid/conflicting-calculations.json",
    ) as MetricCalculationPreimage[];
    expect(() =>
      validateMetricCalculations(
        [stale],
        graph.metricDefinitions,
        graph.evidenceBundle.evidence,
      ),
    ).toThrow(/content hash mismatch/i);
    expect(() =>
      validateMetricCalculations(
        [unresolved],
        graph.metricDefinitions,
        graph.evidenceBundle.evidence,
      ),
    ).toThrow(/unresolved evidence/i);
    expect(() =>
      validateMetricCalculations(
        duplicate,
        graph.metricDefinitions,
        graph.evidenceBundle.evidence,
      ),
    ).toThrow(/duplicate metric calculation/i);
    expect(() =>
      validateMetricCalculations(
        conflicting,
        graph.metricDefinitions,
        graph.evidenceBundle.evidence,
      ),
    ).toThrow(/conflicting metric calculations/i);
  });
});

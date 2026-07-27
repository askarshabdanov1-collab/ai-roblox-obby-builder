import { describe, expect, it } from "vitest";

import {
  verifyCalculationBundleIdentity,
  verifyMetricCalculationIdentity,
  verifyReportPayloadIdentity,
} from "@obby/obby-evaluator-contracts";

import {
  assembleE1Evaluation,
  validateMetricCalculations,
} from "../src/index.js";
import {
  deferredRuntimeAvailability,
  evaluatorFixtureGraph,
} from "./fixtures.js";

function input() {
  const graph = evaluatorFixtureGraph();
  return {
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
  };
}

describe("E1 evidence-bound metric assembly", () => {
  it("calculates every selected metric with verified identities and evidence bindings", () => {
    const result = assembleE1Evaluation(input());

    expect(result.calculations).toHaveLength(10);
    expect(result.calculations.map(verifyMetricCalculationIdentity)).toEqual(
      result.calculations,
    );
    expect(result.calculations.map((item) => item.metricId)).toEqual([
      "checkpoint.topology-validity",
      "finish.topology-validity",
      "hazard.relationship-candidate-count",
      "performance.native-part-count",
      "playability.required-transition-feasibility",
      "playability.route-completeness",
      "playability.skip-candidate-count",
      "policy.decorative-collision-violations",
      "policy.evidence-completeness",
      "runtime.checkpoint-isolation-availability",
    ]);
    const runtimeCalculation = result.calculations.find(
      (item) => item.metricId === "runtime.checkpoint-isolation-availability",
    );
    expect(runtimeCalculation?.calculationState).toBe("unavailable");
    expect(runtimeCalculation?.unavailableReason?.deferredCapability).toBe(
      "runtime",
    );
    expect(result.completeness.state).toBe("complete");
    expect(result.completeness.missingMetricIds).toEqual([]);
  });

  it("applies all catalog invariants before category/profile outcomes", () => {
    const result = assembleE1Evaluation(input());

    expect(result.invariantGates.map((gate) => gate.invariantId)).toEqual([
      "checkpoint-ordering",
      "decorative-gameplay-collision",
      "evidence-graph-integrity",
      "finish-topology",
      "gameplay-route-authority",
      "required-metric-availability",
      "required-reference-resolution",
      "required-route-topology",
    ]);
    expect(result.invariantGates.every((gate) => gate.state === "pass")).toBe(
      true,
    );
    expect(result.report.scoreProfile.aggregateScore).toBe(false);
    expect(
      result.report.scoreProfile.categories.map((item) => item.categoryId),
    ).toEqual(["checkpoint", "hazard", "performance", "playability", "policy"]);
  });

  it("produces deterministic report and calculation bundle identities after input shuffling", () => {
    const firstInput = input();
    const secondInput = structuredClone(firstInput);
    secondInput.metricDefinitions.reverse();
    secondInput.evidence.reverse();
    secondInput.findings.reverse();
    secondInput.availabilityRecords.reverse();

    const first = assembleE1Evaluation(firstInput);
    const second = assembleE1Evaluation(secondInput);

    expect(second.calculations).toEqual(first.calculations);
    expect(second.invariantGates).toEqual(first.invariantGates);
    expect(second.completeness).toEqual(first.completeness);
    expect(second.report).toEqual(first.report);
    expect(verifyCalculationBundleIdentity(first.calculationBundle)).toEqual(
      first.calculationBundle,
    );
    expect(verifyReportPayloadIdentity(first.report)).toEqual(first.report);
  });

  it("rejects stale, duplicate, and conflicting calculations", () => {
    const result = assembleE1Evaluation(input());
    const stale = structuredClone(result.calculations);
    const staleFirst = stale[0];
    const first = result.calculations[0];
    const second = result.calculations[1];
    if (
      staleFirst === undefined ||
      first === undefined ||
      second === undefined
    ) {
      throw new Error("missing test calculations");
    }
    staleFirst.result = {
      status: "available",
      value: { kind: "boolean", value: false },
    };
    expect(() =>
      validateMetricCalculations(
        stale,
        result.metricDefinitions,
        input().evidence,
      ),
    ).toThrow(/calculationHash content hash mismatch/i);
    expect(() =>
      validateMetricCalculations(
        [...result.calculations, first],
        result.metricDefinitions,
        input().evidence,
      ),
    ).toThrow(/duplicate metric calculation/i);
    const conflicting = structuredClone(first);
    const conflictingHash = second.calculationHash;
    if (conflictingHash === undefined) throw new Error("missing test hash");
    conflicting.calculationHash = conflictingHash;
    expect(() =>
      validateMetricCalculations(
        [...result.calculations.slice(1), conflicting],
        result.metricDefinitions,
        input().evidence,
      ),
    ).toThrow();
  });
});

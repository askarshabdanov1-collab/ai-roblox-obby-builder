import { describe, expect, it } from "vitest";

import {
  hashAvailabilityRecord,
  type AvailabilityRecord,
} from "@obby/obby-evaluator-contracts";

import * as scoringEngine from "../src/index.js";
import {
  applyAvailabilityRecords,
  assembleE1Evaluation,
} from "../src/index.js";
import {
  deferredRuntimeAvailability,
  evaluatorFixtureGraph,
} from "./fixtures.js";

function input() {
  const graph = evaluatorFixtureGraph();
  return {
    graph,
    value: {
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
    },
  };
}

describe("E1c scoring precedence", () => {
  it("derives warning outcome from metric state when no finding is supplied", () => {
    const fixture = input();
    fixture.value.findings = [];

    const result = assembleE1Evaluation(fixture.value);

    expect(result.metrics.some((metric) => metric.severity === "warning")).toBe(
      true,
    );
    expect(result.report.findings).toEqual([]);
    expect(result.report.outcome).toBe("pass-with-warnings");
  });

  it("keeps one matching producer finding as a warning without inflation", () => {
    const fixture = input();
    const result = assembleE1Evaluation(fixture.value);

    expect(result.report.outcome).toBe("pass-with-warnings");
    expect(
      new Set(result.report.findings.map((item) => item.findingId)).size,
    ).toBe(result.report.findings.length);
  });

  it("rejects duplicate finding identities", () => {
    const fixture = input();
    const finding = fixture.value.findings[0];
    if (finding === undefined) throw new Error("missing finding fixture");

    expect(() =>
      assembleE1Evaluation({
        ...fixture.value,
        findings: [...fixture.value.findings, structuredClone(finding)],
      }),
    ).toThrow(/duplicate finding/);
  });

  it("allows a clean pass only when neither metrics nor findings warn", () => {
    const fixture = input();
    fixture.value.findings = [];
    fixture.value.evidence = fixture.value.evidence.filter(
      (record) =>
        record.kind !== "hazard-relationship" &&
        record.kind !== "skip-candidate",
    );

    expect(assembleE1Evaluation(fixture.value).report.outcome).toBe("pass");
  });

  it("does not expose a caller-trusting report finalizer", () => {
    expect("finalizeE1Report" in scoringEngine).toBe(false);
    expect("finalizeValidatedE1Report" in scoringEngine).toBe(false);
  });
});

describe("E1c immutable evidence availability", () => {
  it("creates a newly hashed derived report without mutating the original", () => {
    const fixture = input();
    const assembled = assembleE1Evaluation(fixture.value);
    const original = assembled.report;
    const originalSnapshot = structuredClone(original);
    const evidence = fixture.graph.evidenceBundle.evidence[0];
    if (evidence?.evidenceId === undefined) throw new Error("missing evidence");
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
      effectiveSequence: 1,
      supersedesAvailabilityRecordHashes: [],
      policy: { component: "retention-policy", version: "1.0.0" },
      impactScope: {
        scopeKind: "subject-and-derived",
        affectedIdentityHashes: [evidence.evidenceContentHash],
      },
      availabilityRecordHash: `sha256:${"0".repeat(64)}`,
    };
    const availability = {
      ...source,
      availabilityRecordHash: hashAvailabilityRecord(source).hash,
    };

    const derived = applyAvailabilityRecords(original, [availability]);

    expect(original).toEqual(originalSnapshot);
    expect(derived.reportPayloadHash).not.toBe(original.reportPayloadHash);
    expect(derived.derivedFrom?.reportPayloadHash).toBe(
      original.reportPayloadHash,
    );
    expect(derived.outcome).toBe("incomplete");
  });
});

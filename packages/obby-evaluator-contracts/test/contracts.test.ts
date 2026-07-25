import { describe, expect, it } from "vitest";

import {
  assertEvaluationRequestMatchesPlan,
  assertValidEvidenceGraph,
  parseAvailabilityRecord,
  parseEvaluationMetric,
  parseEvaluationPlan,
  parseEvaluationRequest,
  parseMetricCatalog,
  parseMetricDefinition,
  parseRuntimeObservationContent,
  parseScoringProfile,
} from "../src/index.js";
import {
  catalog,
  evaluationPlan,
  evaluationRequest,
  metricDefinition,
  scoringProfile,
  ZERO_HASH,
} from "./fixtures.js";

describe("evaluator contracts", () => {
  it("parses bounded E1a contracts", () => {
    expect(parseMetricDefinition(metricDefinition()).metricId).toBe(
      "playability.route-completeness",
    );
    expect(parseMetricCatalog(catalog()).catalogId).toBe("e1-static");
    expect(parseScoringProfile(scoringProfile()).aggregateScore).toBe(false);
    expect(parseEvaluationPlan(evaluationPlan()).configurationHash).toBe(
      ZERO_HASH,
    );
    expect(
      parseEvaluationRequest(evaluationRequest()).evaluationRequestHash,
    ).toBe(ZERO_HASH);
    expect(
      assertEvaluationRequestMatchesPlan(evaluationRequest(), evaluationPlan())
        .requestId,
    ).toBe("request-0001");
  });

  it("rejects request options that do not match the referenced plan", () => {
    expect(() =>
      assertEvaluationRequestMatchesPlan(
        evaluationRequest({
          deterministicRequestOptions: {
            seed: 43,
            partialEvidencePolicy: "reject",
          },
        }),
        evaluationPlan(),
      ),
    ).toThrow(/deterministicRequestOptions/i);
  });

  it("rejects unknown versions, discriminants, IDs, and properties", () => {
    expect(() =>
      parseMetricDefinition(metricDefinition({ schemaVersion: "0.2" })),
    ).toThrow();
    expect(() =>
      parseMetricDefinition(metricDefinition({ resultKind: "mixed-source" })),
    ).toThrow();
    expect(() =>
      parseMetricDefinition(metricDefinition({ metricId: "NOT VALID" })),
    ).toThrow();
    expect(() =>
      parseMetricDefinition(metricDefinition({ arbitraryPayload: {} })),
    ).toThrow();
  });

  it("enforces derived parents and single-source result variants", () => {
    const common = {
      schemaVersion: "0.1",
      metricId: "playability.route-completeness",
      metricVersion: "1.0.0",
      evidenceIds: ["geometry:scene:sha256:" + "1".repeat(64)],
      limitations: [],
      value: { kind: "number", value: 1, unit: "ratio" },
    };
    expect(
      parseEvaluationMetric({
        ...common,
        resultKind: "deterministic-fact",
        sourceKind: "deterministic",
        confidence: { value: 1, basis: "exact", limitations: [] },
        method: { component: "geometry", version: "1.0.0" },
      }).resultKind,
    ).toBe("deterministic-fact");
    expect(() =>
      parseEvaluationMetric({
        ...common,
        resultKind: "heuristic-estimate",
        sourceKind: "learned",
        confidence: { value: 0.5, basis: "coverage", limitations: ["model"] },
      }),
    ).toThrow();
    expect(() =>
      parseMetricDefinition(
        metricDefinition({
          resultKind: "derived-composite",
          parentMetricIds: [],
        }),
      ),
    ).toThrow();
  });

  it("rejects malformed hashes and unknown evidence references", () => {
    expect(() =>
      parseEvaluationPlan(
        evaluationPlan({
          scene: { manifestHash: "SHA256:BAD", manifestSchemaVersion: "1.0.0" },
        }),
      ),
    ).toThrow();
    expect(() =>
      parseMetricCatalog(catalog("sha256:" + "a".repeat(63))),
    ).toThrow();
    expect(() =>
      assertValidEvidenceGraph([
        {
          schemaVersion: "0.1",
          kind: "geometry-fact",
          manifestHash: ZERO_HASH,
          subject: { kind: "scene" },
          producer: {
            component: "geometry-evaluator",
            version: "0.1.0",
          },
          payload: {
            kind: "geometry-fact",
            objectIds: ["platform-a"],
            factKind: "normalized-object",
            geometryHash: ZERO_HASH,
          },
          parentEvidenceHashes: [`sha256:${"1".repeat(64)}`],
          artifactHashes: [],
          quality: { completeness: "complete", validityCodes: [] },
          limitations: [],
          evidenceContentHash: ZERO_HASH,
        },
      ]),
    ).toThrow(/unknown parent evidence/i);
  });

  it("enforces runtime observation content discriminants", () => {
    expect(() =>
      parseRuntimeObservationContent({
        schemaVersion: "0.1",
        kind: "scene-loaded",
        manifestHash: ZERO_HASH,
        subject: { kind: "scene" },
        sequence: 0,
        monotonicOffsetMs: 0,
        collector: {
          component: "runtime-observer",
          version: "0.1.0",
        },
        payload: {
          kind: "transition-attempt",
          transitionId: "route:platform-a/platform-b/0/1",
          result: "success",
        },
        runtimeObservationContentHash: ZERO_HASH,
      }),
    ).toThrow();
  });

  it("validates availability supersession without overwriting history", () => {
    const record = parseAvailabilityRecord({
      schemaVersion: "0.1",
      subject: {
        kind: "evidence",
        stableId: "geometry:scene",
        contentHash: ZERO_HASH,
      },
      availabilityState: "deleted",
      reasonCode: "retention-expired",
      reasonDetails: [],
      authority: {
        authorityKind: "retention-policy",
        authorityId: "retention-policy:default",
      },
      effectiveAt: "2030-01-01T00:00:00Z",
      supersedesAvailabilityRecordHashes: [],
      policy: {
        component: "retention-policy",
        version: "1.0.0",
        buildHash: ZERO_HASH,
      },
      impactScope: {
        scopeKind: "subject-and-derived",
        affectedIdentityHashes: [ZERO_HASH],
      },
      availabilityRecordHash: ZERO_HASH,
    });
    expect(record.availabilityState).toBe("deleted");
    expect(() =>
      parseAvailabilityRecord({
        ...record,
        effectiveSequence: 1,
      }),
    ).toThrow(/exactly one/i);
  });
});

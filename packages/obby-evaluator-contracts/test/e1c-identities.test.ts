import { describe, expect, it } from "vitest";

import {
  hashMetricCalculation,
  hashReportPayload,
  hashReportRender,
  hashRenderedBytes,
  parseMetricCalculationPreimage,
  parseReportPayloadPreimage,
  parseReportRenderPreimage,
  verifyMetricCalculationIdentity,
  verifyReportPayloadIdentity,
  verifyReportRenderIdentity,
  type MetricCalculationPreimage,
  type ReportPayloadPreimage,
  type ReportRenderPreimage,
} from "../src/index.js";

const hash = (digit: string): `sha256:${string}` =>
  `sha256:${digit.repeat(64)}`;

const metricCalculation = (): MetricCalculationPreimage => ({
  schemaVersion: "0.1",
  metricId: "playability.route-completeness",
  metricVersion: "1.0.0",
  metricDefinitionHash: hash("1"),
  calculationConfigurationHash: hash("2"),
  deterministicParametersHash: hash("2"),
  calculationState: "calculated",
  evidence: [
    {
      kind: "route-transition",
      subjectKey: "route:scene-a/start/finish/0/1",
      evidenceContentHash: hash("3"),
    },
  ],
  parentCalculations: [],
  result: {
    status: "available",
    value: { kind: "integer", value: 0, unit: "transitions" },
  },
  thresholdsApplied: [
    {
      thresholdId: "complete-route",
      classification: "invariant",
      matched: true,
    },
  ],
  confidence: { value: 1, basis: "deterministic-inputs", limitations: [] },
  limitations: [],
  reproduction: {
    method: { component: "route-completeness", version: "1.0.0" },
    inputEvidenceHashes: [hash("3")],
    deterministicParametersHash: hash("2"),
  },
});

const report = (): ReportPayloadPreimage => ({
  schemaVersion: "0.1",
  calculationBundleHash: hash("4"),
  scene: { manifestHash: hash("5"), manifestSchemaVersion: "1.0.0" },
  plan: { configurationHash: hash("6"), evaluationRequestHash: hash("7") },
  versions: {
    evaluator: { component: "scoring-engine", version: "0.1.0" },
    metricCatalogHash: hash("8"),
    scoringProfileHash: hash("9"),
  },
  outcome: "pass",
  blockingFindingIds: [],
  scoreProfile: {
    profileId: "e1-static-default",
    profileVersion: "1.0.0",
    compatibilityClass: "e1-static-v1",
    aggregateScore: false,
    categories: [
      {
        categoryId: "playability",
        status: "available",
        metricIds: ["playability.route-completeness"],
        confidence: {
          value: 1,
          basis: "required-evidence-complete",
          limitations: [],
        },
        classification: "provisional",
      },
    ],
  },
  calculations: [
    {
      ...metricCalculation(),
      calculationHash: hashMetricCalculation(metricCalculation()).hash,
    },
  ],
  invariantGates: [
    {
      invariantId: "required-route-topology",
      state: "pass",
      evidenceIds: ["geometry:route"],
      evidenceContentHashes: [hash("3")],
      findingIds: [],
      blockedMetricIds: [],
    },
  ],
  profileGates: [],
  completeness: {
    state: "complete",
    requestedMetricIds: ["playability.route-completeness"],
    calculatedMetricIds: ["playability.route-completeness"],
    missingMetricIds: [],
    missingEvidenceKinds: [],
    unresolvedEvidenceHashes: [],
    unresolvedFindingIds: [],
    unavailable: [],
  },
  metrics: [],
  findings: [],
  evidenceIndex: [],
  availabilityRecordHashes: [],
  missingEvidence: [],
  comparability: {
    compatibilityClass: "e1-static-v1",
    compatibleDimensions: ["route"],
  },
  limitations: [
    {
      code: "coarse-model-only",
      text: "Coarse geometry is not exact Roblox physics.",
    },
  ],
});

describe("E1c deterministic identity contracts", () => {
  it("validates and self-excludes MetricCalculationPreimage.calculationHash", () => {
    const source = metricCalculation();
    const first = hashMetricCalculation(source);
    const finalized = { ...source, calculationHash: first.hash };

    expect(parseMetricCalculationPreimage(finalized)).toEqual(finalized);
    expect(hashMetricCalculation(finalized)).toEqual(first);
    expect(verifyMetricCalculationIdentity(finalized)).toEqual(finalized);
  });

  it("rejects calculation states that overload a numeric value as unavailable", () => {
    expect(() =>
      parseMetricCalculationPreimage({
        ...metricCalculation(),
        calculationState: "unavailable",
      }),
    ).toThrow(/unavailable/i);
  });

  it("requires explicit gate and completeness records in finalized report payloads", () => {
    const source = report();
    const withoutGates = structuredClone(source) as Partial<typeof source>;
    delete withoutGates.invariantGates;
    const withoutCompleteness = structuredClone(source) as Partial<
      typeof source
    >;
    delete withoutCompleteness.completeness;

    expect(() => parseReportPayloadPreimage(withoutGates)).toThrow();
    expect(() => parseReportPayloadPreimage(withoutCompleteness)).toThrow();
  });

  it("canonicalizes every set-like report collection before hashing", () => {
    const source = report();
    const reordered = structuredClone(source);
    reordered.comparability.compatibleDimensions.reverse();
    reordered.limitations.reverse();
    reordered.scoreProfile.categories.reverse();

    expect(hashReportPayload(reordered).hash).toBe(
      hashReportPayload(source).hash,
    );
    const finalized = {
      ...source,
      reportPayloadHash: hashReportPayload(source).hash,
    };
    expect(parseReportPayloadPreimage(finalized)).toEqual(finalized);
    expect(verifyReportPayloadIdentity(finalized)).toEqual(finalized);
  });

  it("keeps execution and export metadata outside report identity contracts", () => {
    const source = report();
    expect(() =>
      parseReportPayloadPreimage({
        ...source,
        executionId: "execution-a",
      }),
    ).toThrow();
    expect(() =>
      parseReportPayloadPreimage({
        ...source,
        generatedAt: "2030-01-01T00:00:00Z",
      }),
    ).toThrow();
  });

  it("binds renderer identity and exact rendered bytes separately", () => {
    const renderedBytesHash = hashRenderedBytes(
      new TextEncoder().encode("# Deterministic report\n"),
    );
    const source: ReportRenderPreimage = {
      schemaVersion: "0.1",
      reportPayloadHash: hash("a"),
      renderer: { component: "markdown-renderer", version: "1.0.0" },
      template: { component: "e1-report-template", version: "1.0.0" },
      locale: "en-US",
      configurationHash: hash("b"),
      outputFormat: "markdown",
      renderedBytesHash,
    };
    const finalized = {
      ...source,
      reportRenderHash: hashReportRender(source).hash,
    };

    expect(parseReportRenderPreimage(finalized)).toEqual(finalized);
    expect(verifyReportRenderIdentity(finalized)).toEqual(finalized);
    expect(hashReportRender({ ...source, locale: "en" }).hash).not.toBe(
      finalized.reportRenderHash,
    );
  });
});

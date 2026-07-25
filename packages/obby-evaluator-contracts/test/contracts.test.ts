import { describe, expect, it } from "vitest";

import {
  assertValidEvaluatorConfigurationGraph,
  assertValidEvidenceGraph,
  hashEvaluationPlanConfiguration,
  hashEvaluationRequest,
  hashEvidenceContent,
  hashMetricCatalog,
  hashMetricDefinition,
  hashScoringProfile,
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
  positiveEvaluatorFixtures,
  scoringProfile,
  TEST_IDENTITIES,
} from "./fixtures.js";

function configurationGraph() {
  const definition = metricDefinition();
  definition.metricDefinitionHash = hashMetricDefinition(definition).hash;
  const metricCatalog = catalog(definition.metricDefinitionHash as string);
  metricCatalog.metricCatalogHash = hashMetricCatalog(metricCatalog).hash;
  const profile = scoringProfile(metricCatalog.metricCatalogHash as string);
  profile.scoringProfileHash = hashScoringProfile(profile).hash;
  const plan = evaluationPlan({
    catalog: {
      catalogId: metricCatalog.catalogId,
      catalogVersion: metricCatalog.catalogVersion,
      metricCatalogHash: metricCatalog.metricCatalogHash,
    },
    profile: {
      profileId: profile.profileId,
      profileVersion: profile.profileVersion,
      scoringProfileHash: profile.scoringProfileHash,
      compatibilityClass: profile.compatibilityClass,
    },
  });
  plan.configurationHash = hashEvaluationPlanConfiguration(plan).hash;
  const request = evaluationRequest({
    catalog: plan.catalog,
    profile: plan.profile,
    configurationHash: plan.configurationHash,
  });
  request.evaluationRequestHash = hashEvaluationRequest(request).hash;
  return {
    metricDefinitions: [definition],
    catalog: metricCatalog,
    profile,
    plan,
    request,
    evaluatorVersion: "0.1.0",
    componentVersions: { "obby-evaluator-contracts": "0.1.0" },
  };
}

function evidence(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const record = {
    schemaVersion: "0.1",
    evidenceId: "evidence-a",
    kind: "geometry-fact",
    manifestHash: TEST_IDENTITIES.manifestHash,
    subject: { kind: "scene" },
    producer: { component: "geometry-evaluator", version: "0.1.0" },
    payload: {
      kind: "geometry-fact",
      objectIds: ["platform-a"],
      factKind: "normalized-object",
      geometryHash: TEST_IDENTITIES.geometryHash,
    },
    parentEvidenceHashes: [],
    artifactHashes: [],
    quality: { completeness: "complete", validityCodes: [] },
    limitations: [],
    evidenceContentHash: TEST_IDENTITIES.geometryHash,
    ...overrides,
  };
  record.evidenceContentHash = hashEvidenceContent(record).hash;
  return record;
}

describe("evaluator contracts", () => {
  it("parses bounded E1a contracts", () => {
    const definition = metricDefinition();
    const metricCatalog = catalog(definition.metricDefinitionHash as string);
    const profile = scoringProfile(metricCatalog.metricCatalogHash as string);
    expect(parseMetricDefinition(definition).metricId).toBe(
      "playability.route-completeness",
    );
    expect(parseMetricCatalog(metricCatalog).catalogId).toBe("e1-static");
    expect(parseScoringProfile(profile).aggregateScore).toBe(false);
    expect(parseEvaluationPlan(evaluationPlan()).configurationHash).toMatch(
      /^sha256:[0-9a-f]{64}$/,
    );
    expect(
      parseEvaluationRequest(evaluationRequest()).evaluationRequestHash,
    ).toMatch(/^sha256:[0-9a-f]{64}$/);
    const graph = configurationGraph();
    expect(
      assertValidEvaluatorConfigurationGraph(graph).request.requestId,
    ).toBe("request-0001");
  });

  it("rejects request options that do not match the referenced plan", () => {
    const graph = configurationGraph();
    graph.request.deterministicRequestOptions = {
      seed: 43,
      partialEvidencePolicy: "reject",
    };
    graph.request.evaluationRequestHash = hashEvaluationRequest(
      graph.request,
    ).hash;
    expect(() => assertValidEvaluatorConfigurationGraph(graph)).toThrow(
      /deterministicRequestOptions/i,
    );
  });

  it("resolves and verifies the complete evaluator configuration graph", () => {
    expect(
      assertValidEvaluatorConfigurationGraph(configurationGraph()).plan.planId,
    ).toBe("e1-static-plan");
  });

  it.each([
    [
      "unknown catalog definition",
      (graph: ReturnType<typeof configurationGraph>) => {
        const reference = (
          graph.catalog.metricDefinitions as Record<string, unknown>[]
        )[0];
        if (reference === undefined) throw new Error("missing test reference");
        reference.metricId = "unknown.metric";
        graph.catalog.metricCatalogHash = hashMetricCatalog(graph.catalog).hash;
      },
    ],
    [
      "unknown profile metric",
      (graph: ReturnType<typeof configurationGraph>) => {
        graph.profile.requiredMetricIds = ["unknown.metric"];
        graph.profile.categories = [
          {
            categoryId: "playability",
            metricIds: ["unknown.metric"],
            availability: "available",
          },
        ];
        graph.profile.scoringProfileHash = hashScoringProfile(
          graph.profile,
        ).hash;
      },
    ],
    [
      "missing invariant",
      (graph: ReturnType<typeof configurationGraph>) => {
        graph.profile.invariantGateIds = [];
        graph.profile.scoringProfileHash = hashScoringProfile(
          graph.profile,
        ).hash;
      },
    ],
    [
      "unknown invariant",
      (graph: ReturnType<typeof configurationGraph>) => {
        graph.profile.invariantGateIds = ["unknown-invariant"];
        graph.profile.scoringProfileHash = hashScoringProfile(
          graph.profile,
        ).hash;
      },
    ],
    [
      "unknown plan metric",
      (graph: ReturnType<typeof configurationGraph>) => {
        graph.plan.metricInclude = ["unknown.metric"];
        graph.plan.configurationHash = hashEvaluationPlanConfiguration(
          graph.plan,
        ).hash;
        graph.request.configurationHash = graph.plan.configurationHash;
        graph.request.evaluationRequestHash = hashEvaluationRequest(
          graph.request,
        ).hash;
      },
    ],
    [
      "invalid version range",
      (graph: ReturnType<typeof configurationGraph>) => {
        graph.catalog.supportedVersions = [
          {
            component: "obby-evaluator-contracts",
            versionRange: "anything-goes",
          },
        ];
        graph.catalog.metricCatalogHash = hashMetricCatalog(graph.catalog).hash;
      },
    ],
  ])("rejects %s across contracts", (_name, mutate) => {
    const graph = configurationGraph();
    mutate(graph);
    expect(() => assertValidEvaluatorConfigurationGraph(graph)).toThrow();
  });

  it("rejects a derived metric self reference", () => {
    const graph = configurationGraph();
    graph.metricDefinitions[0] = metricDefinition({
      resultKind: "derived-composite",
      parentMetricIds: ["playability.route-completeness"],
    });
    const definition = graph.metricDefinitions[0];
    const reference = (
      graph.catalog.metricDefinitions as Record<string, unknown>[]
    )[0];
    if (reference === undefined) {
      throw new Error("missing self-reference test fixture");
    }
    definition.metricDefinitionHash = hashMetricDefinition(definition).hash;
    reference.metricDefinitionHash = definition.metricDefinitionHash;
    graph.catalog.metricCatalogHash = hashMetricCatalog(graph.catalog).hash;
    expect(() => assertValidEvaluatorConfigurationGraph(graph)).toThrow(
      /itself|cycle/i,
    );
  });

  it("rejects stale plan and request hashes before binding", () => {
    const graph = configurationGraph();
    graph.plan.seed = 43;
    expect(() => assertValidEvaluatorConfigurationGraph(graph)).toThrow(
      /configurationHash content hash mismatch/i,
    );
  });

  it("rejects stale catalog and profile objects through the aggregate boundary", () => {
    const staleCatalog = configurationGraph();
    staleCatalog.catalog.catalogVersion = "1.0.1";
    expect(() => assertValidEvaluatorConfigurationGraph(staleCatalog)).toThrow(
      /metricCatalogHash content hash mismatch/i,
    );

    const staleProfile = configurationGraph();
    staleProfile.profile.profileVersion = "1.0.1";
    expect(() => assertValidEvaluatorConfigurationGraph(staleProfile)).toThrow(
      /scoringProfileHash content hash mismatch/i,
    );
  });

  it("rejects an explicitly all-zero declared identity", () => {
    const allZeroHash = `sha256:${"0".repeat(64)}`;
    const graph = configurationGraph();
    graph.plan.configurationHash = allZeroHash;
    expect(() => assertValidEvaluatorConfigurationGraph(graph)).toThrow(
      /configurationHash content hash mismatch/i,
    );
  });

  it("keeps every positive fixture free of all-zero identities", () => {
    const allZeroHash = `sha256:${"0".repeat(64)}`;
    expect(JSON.stringify(positiveEvaluatorFixtures())).not.toContain(
      allZeroHash,
    );
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
      metricDefinitionHash: TEST_IDENTITIES.calculationConfigurationHash,
      category: "playability",
      status: "available",
      evidenceIds: ["geometry:scene:sha256:" + "1".repeat(64)],
      limitations: [],
      value: { kind: "number", value: 1, unit: "ratio" },
      severity: "info",
      blocking: false,
      thresholdsApplied: [],
      calculationHash: TEST_IDENTITIES.calculationBundleHash,
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
        limitations: ["model uncertainty"],
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
        evidence({
          parentEvidenceHashes: [`sha256:${"1".repeat(64)}`],
        }),
      ]),
    ).toThrow(/unknown parent evidence/i);
  });

  it("enforces runtime observation content discriminants", () => {
    expect(() =>
      parseRuntimeObservationContent({
        schemaVersion: "0.1",
        kind: "scene-loaded",
        manifestHash: TEST_IDENTITIES.manifestHash,
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
        runtimeObservationContentHash: TEST_IDENTITIES.geometryHash,
      }),
    ).toThrow();
  });

  it("validates availability supersession without overwriting history", () => {
    const record = parseAvailabilityRecord({
      schemaVersion: "0.1",
      subject: {
        kind: "evidence",
        stableId: "geometry:scene",
        contentHash: TEST_IDENTITIES.availabilitySubjectHash,
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
        buildHash: TEST_IDENTITIES.ruleBuildHash,
      },
      impactScope: {
        scopeKind: "subject-and-derived",
        affectedIdentityHashes: [TEST_IDENTITIES.availabilitySubjectHash],
      },
      availabilityRecordHash: TEST_IDENTITIES.ruleBuildHash,
    });
    expect(record.availabilityState).toBe("deleted");
    expect(() =>
      parseAvailabilityRecord({
        ...record,
        effectiveSequence: 1,
      }),
    ).toThrow(/exactly one/i);
    expect(() =>
      parseAvailabilityRecord({
        ...record,
        effectiveAt: "2030-99-99T99:99:99Z",
      }),
    ).toThrow();
  });

  it("verifies evidence hashes, scope, IDs, parent compatibility, and a valid acyclic graph", () => {
    const parent = evidence();
    const child = evidence({
      evidenceId: "evidence-b",
      parentEvidenceHashes: [parent.evidenceContentHash],
    });
    expect(assertValidEvidenceGraph([child, parent])).toHaveLength(2);

    expect(() =>
      assertValidEvidenceGraph([
        { ...parent, evidenceContentHash: `sha256:${"f".repeat(64)}` },
      ]),
    ).toThrow(/evidenceContentHash expected/i);

    const otherManifest = evidence({
      evidenceId: "evidence-c",
      manifestHash: `sha256:${"1".repeat(64)}`,
      parentEvidenceHashes: [parent.evidenceContentHash],
    });
    expect(() => assertValidEvidenceGraph([parent, otherManifest])).toThrow(
      /manifest scope/i,
    );

    const objectParent = evidence({
      evidenceId: "evidence-object",
      subject: { kind: "object", objectId: "platform-a" },
    });
    const incompatibleChild = evidence({
      evidenceId: "evidence-scene",
      parentEvidenceHashes: [objectParent.evidenceContentHash],
    });
    expect(() =>
      assertValidEvidenceGraph([objectParent, incompatibleChild]),
    ).toThrow(/subject/i);

    expect(() =>
      assertValidEvidenceGraph([
        parent,
        { ...parent, evidenceContentHash: parent.evidenceContentHash },
      ]),
    ).toThrow(/duplicate evidence id|duplicate evidence hash/i);
  });
});

import { describe, expect, it } from "vitest";

import {
  assertEvaluationRequestMatchesPlan,
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
  scoringProfile,
  ZERO_HASH,
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

function bindingContext(graph: ReturnType<typeof configurationGraph>) {
  return {
    metricDefinitions: graph.metricDefinitions,
    catalog: graph.catalog,
    profile: graph.profile,
  };
}

function evidence(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const record = {
    schemaVersion: "0.1",
    evidenceId: "evidence-a",
    kind: "geometry-fact",
    manifestHash: ZERO_HASH,
    subject: { kind: "scene" },
    producer: { component: "geometry-evaluator", version: "0.1.0" },
    payload: {
      kind: "geometry-fact",
      objectIds: ["platform-a"],
      factKind: "normalized-object",
      geometryHash: ZERO_HASH,
    },
    parentEvidenceHashes: [],
    artifactHashes: [],
    quality: { completeness: "complete", validityCodes: [] },
    limitations: [],
    evidenceContentHash: ZERO_HASH,
    ...overrides,
  };
  record.evidenceContentHash = hashEvidenceContent(record).hash;
  return record;
}

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
    const graph = configurationGraph();
    expect(
      assertEvaluationRequestMatchesPlan(
        graph.request,
        graph.plan,
        bindingContext(graph),
      ).requestId,
    ).toBe("request-0001");
  });

  it("rejects request options that do not match the referenced plan", () => {
    const graph = configurationGraph();
    expect(() =>
      assertEvaluationRequestMatchesPlan(
        {
          ...graph.request,
          deterministicRequestOptions: {
            seed: 43,
            partialEvidencePolicy: "reject",
          },
          evaluationRequestHash: hashEvaluationRequest({
            ...graph.request,
            deterministicRequestOptions: {
              seed: 43,
              partialEvidencePolicy: "reject",
            },
          }).hash,
        },
        graph.plan,
        bindingContext(graph),
      ),
    ).toThrow(/deterministicRequestOptions/i);
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

  it("rejects derived self references and cycles", () => {
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
    expect(() =>
      assertEvaluationRequestMatchesPlan(
        graph.request,
        graph.plan,
        bindingContext(graph),
      ),
    ).toThrow(/configurationHash content hash mismatch/i);
  });

  it("requires and verifies the complete identity graph for request-plan binding", () => {
    const graph = configurationGraph();
    expect(() =>
      assertEvaluationRequestMatchesPlan(
        graph.request,
        graph.plan,
        undefined as never,
      ),
    ).toThrow(/requires metric definitions, catalog, and profile/i);

    const zeroPlan = evaluationPlan();
    zeroPlan.configurationHash = hashEvaluationPlanConfiguration(zeroPlan).hash;
    const zeroRequest = evaluationRequest({
      configurationHash: zeroPlan.configurationHash,
    });
    zeroRequest.evaluationRequestHash = hashEvaluationRequest(zeroRequest).hash;
    expect(() =>
      assertEvaluationRequestMatchesPlan(
        zeroRequest,
        zeroPlan,
        bindingContext(graph),
      ),
    ).toThrow(/Identity|mismatch/i);

    const wrongCatalog = structuredClone(graph.catalog);
    wrongCatalog.catalogId = "other-catalog";
    wrongCatalog.metricCatalogHash = hashMetricCatalog(wrongCatalog).hash;
    expect(() =>
      assertEvaluationRequestMatchesPlan(graph.request, graph.plan, {
        ...bindingContext(graph),
        catalog: wrongCatalog,
      }),
    ).toThrow(/catalogIdentity|profile is not backed/i);

    const wrongProfile = structuredClone(graph.profile);
    wrongProfile.profileId = "other-profile";
    wrongProfile.scoringProfileHash = hashScoringProfile(wrongProfile).hash;
    expect(() =>
      assertEvaluationRequestMatchesPlan(graph.request, graph.plan, {
        ...bindingContext(graph),
        profile: wrongProfile,
      }),
    ).toThrow(/profileIdentity/i);

    expect(() =>
      assertEvaluationRequestMatchesPlan(graph.request, graph.plan, {
        ...bindingContext(graph),
        profile: { ...graph.profile, profileVersion: "1.0.1" },
      }),
    ).toThrow(/content hash mismatch/i);

    expect(
      assertEvaluationRequestMatchesPlan(
        graph.request,
        graph.plan,
        bindingContext(graph),
      ).requestId,
    ).toBe("request-0001");
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
      metricDefinitionHash: ZERO_HASH,
      category: "playability",
      status: "available",
      evidenceIds: ["geometry:scene:sha256:" + "1".repeat(64)],
      limitations: [],
      value: { kind: "number", value: 1, unit: "ratio" },
      severity: "info",
      blocking: false,
      thresholdsApplied: [],
      calculationHash: ZERO_HASH,
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
    expect(() =>
      parseAvailabilityRecord({
        ...record,
        effectiveAt: "2030-99-99T99:99:99Z",
      }),
    ).toThrow();
  });

  it("verifies evidence hashes, scope, IDs, parent compatibility, and cycles", () => {
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
    ).toThrow(/content hash mismatch/i);

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

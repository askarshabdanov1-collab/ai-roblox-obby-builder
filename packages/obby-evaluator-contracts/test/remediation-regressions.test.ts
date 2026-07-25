import { describe, expect, it } from "vitest";

import { assertAcyclicResolvedEvidenceGraph } from "../src/internal/evidence-cycle.js";
import {
  assertValidEvaluatorConfigurationGraph,
  assertValidEvidenceGraph,
  ContractValidationError,
  hashEvaluationPlanConfiguration,
  hashEvaluationRequest,
  hashEvidenceContent,
  hashMetricCatalog,
  hashMetricDefinition,
  hashScoringProfile,
  parseAvailabilityRecord,
} from "../src/index.js";
import {
  catalog,
  evaluationPlan,
  evaluationRequest,
  metricDefinition,
  scoringProfile,
  ZERO_HASH,
} from "./fixtures.js";

function errorPayload(run: () => unknown): string {
  try {
    run();
  } catch (caught) {
    if (caught instanceof ContractValidationError) {
      return JSON.stringify(caught.issues);
    }
    return JSON.stringify({ message: String(caught) });
  }
  throw new Error("expected validation failure");
}

function definition(metricId: string, parentMetricIds: string[] = []) {
  const value = metricDefinition({
    metricId,
    ...(parentMetricIds.length === 0
      ? {}
      : { resultKind: "derived-composite", parentMetricIds }),
  });
  value.metricDefinitionHash = hashMetricDefinition(value).hash;
  return value;
}

function graph(
  definitions: Record<string, unknown>[],
  overrides: {
    catalogReferences?: Record<string, unknown>[];
    profileMetricIds?: string[];
  } = {},
) {
  const references =
    overrides.catalogReferences ??
    definitions.map((item) => ({
      metricId: item.metricId,
      metricVersion: item.metricVersion,
      metricDefinitionHash: item.metricDefinitionHash,
    }));
  const metricCatalog = catalog();
  metricCatalog.metricDefinitions = references;
  metricCatalog.metricCatalogHash = hashMetricCatalog(metricCatalog).hash;
  const metricIds =
    overrides.profileMetricIds ??
    definitions.map((item) => item.metricId as string);
  const profile = scoringProfile(metricCatalog.metricCatalogHash as string);
  profile.requiredMetricIds = metricIds;
  profile.categories = [
    { categoryId: "playability", metricIds, availability: "available" },
  ];
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
    metricInclude: metricIds,
  });
  plan.configurationHash = hashEvaluationPlanConfiguration(plan).hash;
  const request = evaluationRequest({
    catalog: plan.catalog,
    profile: plan.profile,
    configurationHash: plan.configurationHash,
  });
  request.evaluationRequestHash = hashEvaluationRequest(request).hash;
  return {
    metricDefinitions: definitions,
    catalog: metricCatalog,
    profile,
    plan,
    request,
    evaluatorVersion: "0.1.0",
    componentVersions: { "obby-evaluator-contracts": "0.1.0" },
  };
}

function evidence(
  evidenceId: string,
  parentEvidenceHashes: string[] = [],
  limitations: string[] = [],
) {
  const value = {
    schemaVersion: "0.1",
    evidenceId,
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
    parentEvidenceHashes,
    artifactHashes: [],
    quality: { completeness: "complete", validityCodes: [] },
    limitations,
    evidenceContentHash: ZERO_HASH,
  };
  value.evidenceContentHash = hashEvidenceContent(value).hash;
  return value;
}

function availability(effectiveAt: string) {
  return {
    schemaVersion: "0.1",
    subject: {
      kind: "evidence",
      stableId: "geometry:scene",
      contentHash: ZERO_HASH,
    },
    availabilityState: "available",
    reasonCode: "created",
    reasonDetails: [],
    authority: { authorityKind: "evaluator", authorityId: "evaluator:local" },
    effectiveAt,
    supersedesAvailabilityRecordHashes: [],
    policy: { component: "availability", version: "1.0.0" },
    impactScope: {
      scopeKind: "subject-only",
      affectedIdentityHashes: [ZERO_HASH],
    },
    availabilityRecordHash: ZERO_HASH,
  };
}

describe("focused remediation regressions", () => {
  it("selects the same catalog error for reversed equivalent references", () => {
    const definitions = [definition("metric.a"), definition("metric.b")];
    const references = [
      {
        metricId: "unknown.b",
        metricVersion: "1.0.0",
        metricDefinitionHash: definitions[0]?.metricDefinitionHash,
      },
      {
        metricId: "unknown.a",
        metricVersion: "1.0.0",
        metricDefinitionHash: definitions[1]?.metricDefinitionHash,
      },
    ];
    const first = graph(definitions, { catalogReferences: references });
    const second = graph(definitions, {
      catalogReferences: references.toReversed(),
    });
    expect(first.catalog.metricCatalogHash).toBe(
      second.catalog.metricCatalogHash,
    );
    expect(
      errorPayload(() => assertValidEvaluatorConfigurationGraph(first)),
    ).toBe(errorPayload(() => assertValidEvaluatorConfigurationGraph(second)));
  });

  it("selects the same profile error for reversed equivalent references", () => {
    const definitions = [definition("metric.a"), definition("metric.b")];
    const first = graph(definitions, {
      profileMetricIds: ["unknown.b", "unknown.a"],
    });
    const second = graph(definitions, {
      profileMetricIds: ["unknown.a", "unknown.b"],
    });
    expect(first.profile.scoringProfileHash).toBe(
      second.profile.scoringProfileHash,
    );
    expect(
      errorPayload(() => assertValidEvaluatorConfigurationGraph(first)),
    ).toBe(errorPayload(() => assertValidEvaluatorConfigurationGraph(second)));
  });

  it("selects the same evidence error for shuffled invalid graphs", () => {
    const a = evidence("evidence-a", [`sha256:${"a".repeat(64)}`]);
    const b = evidence("evidence-b", [`sha256:${"b".repeat(64)}`]);
    expect(errorPayload(() => assertValidEvidenceGraph([a, b]))).toBe(
      errorPayload(() => assertValidEvidenceGraph([b, a])),
    );
  });

  it("rejects a real three-node derived metric cycle", () => {
    const cyclic = [
      definition("metric.a", ["metric.b"]),
      definition("metric.b", ["metric.c"]),
      definition("metric.c", ["metric.a"]),
    ];
    expect(() => assertValidEvaluatorConfigurationGraph(graph(cyclic))).toThrow(
      /cycle at metric\.a/i,
    );
  });

  it("tests the resolved evidence cycle guard without claiming a hash-valid cycle", () => {
    expect(() =>
      assertAcyclicResolvedEvidenceGraph([
        { identity: "a", parentIdentities: ["b"] },
        { identity: "b", parentIdentities: ["c"] },
        { identity: "c", parentIdentities: ["a"] },
      ]),
    ).toThrow(/cycle at a/i);
    expect(() =>
      assertAcyclicResolvedEvidenceGraph([
        { identity: "a", parentIdentities: [] },
        { identity: "b", parentIdentities: ["a"] },
      ]),
    ).not.toThrow();
  });

  it.each([
    "2030-01-01T00:00:00+00:00",
    "2030-01-01T00:00:00",
    "2030-01-01T00:00:00.1Z",
    "2030-01-01T00:00:00.12Z",
    "2030-01-01T00:00:00.1234Z",
    "2030-02-30T00:00:00Z",
    "2030-02-29T00:00:00Z",
  ])("rejects non-canonical or calendar-invalid UTC timestamp %s", (value) => {
    expect(() => parseAvailabilityRecord(availability(value))).toThrow();
  });

  it.each(["2030-01-01T00:00:00Z", "2032-02-29T00:00:00.123Z"])(
    "accepts canonical UTC timestamp %s",
    (value) => {
      expect(parseAvailabilityRecord(availability(value)).effectiveAt).toBe(
        value,
      );
    },
  );

  it("rejects duplicate evidence IDs with distinct valid content hashes", () => {
    const first = evidence("same-evidence-id", [], ["first"]);
    const second = evidence("same-evidence-id", [], ["second"]);
    expect(first.evidenceContentHash).not.toBe(second.evidenceContentHash);
    expect(() => assertValidEvidenceGraph([first, second])).toThrow(
      /duplicate evidence ID/i,
    );
  });
});

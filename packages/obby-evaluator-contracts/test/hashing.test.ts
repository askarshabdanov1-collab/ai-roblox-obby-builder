import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  hashAvailabilityRecord,
  hashCalculationBundle,
  hashEvaluationPlanConfiguration,
  hashEvaluationRequest,
  hashEvidenceContent,
  hashMetricCatalog,
  hashMetricDefinition,
  hashScoringProfile,
} from "../src/index.js";
import {
  catalog,
  evaluationPlan,
  evaluationRequest,
  metricDefinition,
  scoringProfile,
  TEST_IDENTITIES,
} from "./fixtures.js";

describe("named evaluator preimages", () => {
  it("derives every named digest from the exact returned bytes", () => {
    const definition = metricDefinition();
    const metricCatalog = catalog(definition.metricDefinitionHash as string);
    const cases = [
      hashMetricDefinition(definition),
      hashMetricCatalog(metricCatalog),
      hashScoringProfile(
        scoringProfile(metricCatalog.metricCatalogHash as string),
      ),
      hashEvaluationPlanConfiguration(evaluationPlan()),
      hashEvaluationRequest(evaluationRequest()),
      hashEvidenceContent({
        schemaVersion: "0.1",
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
      }),
      hashCalculationBundle({
        schemaVersion: "0.1",
        manifestHash: TEST_IDENTITIES.manifestHash,
        configurationHash: TEST_IDENTITIES.calculationConfigurationHash,
        evaluatorVersion: "0.1.0",
        metricCatalogHash: metricCatalog.metricCatalogHash,
        scoringProfileHash: TEST_IDENTITIES.calculationConfigurationHash,
        environmentCompatibilityClass: "static-native-parts-v1",
        evidence: [],
        ruleVersions: [],
        calculationBundleHash: TEST_IDENTITIES.calculationBundleHash,
      }),
      hashAvailabilityRecord({
        schemaVersion: "0.1",
        subject: {
          kind: "evidence",
          stableId: "geometry:scene",
          contentHash: TEST_IDENTITIES.availabilitySubjectHash,
        },
        availabilityState: "available",
        reasonCode: "created",
        reasonDetails: [],
        authority: {
          authorityKind: "evaluator",
          authorityId: "evaluator:local",
        },
        effectiveSequence: 0,
        supersedesAvailabilityRecordHashes: [],
        policy: { component: "availability", version: "1.0.0" },
        impactScope: {
          scopeKind: "subject-only",
          affectedIdentityHashes: [TEST_IDENTITIES.availabilitySubjectHash],
        },
        availabilityRecordHash: TEST_IDENTITIES.ruleBuildHash,
      }),
    ];
    for (const result of cases) {
      expect(
        `sha256:${createHash("sha256")
          .update(result.canonicalBytes)
          .digest("hex")}`,
      ).toBe(result.hash);
    }
  });

  it("excludes every resulting self hash and exposes canonical bytes", () => {
    const first = hashMetricDefinition(metricDefinition());
    const alternate = metricDefinition();
    alternate.metricDefinitionHash = `sha256:${"f".repeat(64)}`;
    const second = hashMetricDefinition(alternate);
    expect(first).toEqual(second);
    expect(first.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(new TextDecoder().decode(first.canonicalBytes)).not.toContain(
      "metricDefinitionHash",
    );
  });

  it("rejects accessor-backed contract inputs before validation or hashing", () => {
    const input = metricDefinition();
    Object.defineProperty(input, "metricId", {
      enumerable: true,
      get: () => "playability.route-completeness",
    });
    expect(() => hashMetricDefinition(input)).toThrow(/accessor/i);
  });

  it("rejects availability accessors without executing getters", () => {
    let reads = 0;
    const input = {
      schemaVersion: "0.1",
      effectiveSequence: 1,
    } as Record<string, unknown>;
    Object.defineProperty(input, "effectiveAt", {
      enumerable: true,
      get: () => {
        reads += 1;
        return "2030-01-01T00:00:00Z";
      },
    });
    expect(() => hashAvailabilityRecord(input)).toThrow(/accessor/i);
    expect(reads).toBe(0);
  });

  it("orders catalog and profile semantic sets deterministically", () => {
    const definition = metricDefinition();
    const baseCatalog = catalog(definition.metricDefinitionHash as string);
    const a = hashMetricCatalog({
      ...baseCatalog,
      supportedVersions: [
        { component: "z", versionRange: "1.x" },
        { component: "a", versionRange: "1.x" },
      ],
    });
    const b = hashMetricCatalog({
      ...baseCatalog,
      supportedVersions: [
        { component: "a", versionRange: "1.x" },
        { component: "z", versionRange: "1.x" },
      ],
    });
    expect(a.hash).toBe(b.hash);
    expect(new TextDecoder().decode(a.canonicalBytes)).not.toContain(
      "metricCatalogHash",
    );
    const baseProfile = scoringProfile(baseCatalog.metricCatalogHash as string);
    const profile = hashScoringProfile({
      ...baseProfile,
      requiredMetricIds: [
        "policy.decorative-collision-violations",
        "playability.route-completeness",
      ],
    });
    expect(profile.hash).toBe(
      hashScoringProfile({
        ...baseProfile,
        requiredMetricIds: [
          "playability.route-completeness",
          "policy.decorative-collision-violations",
        ],
      }).hash,
    );
    expect(new TextDecoder().decode(profile.canonicalBytes)).not.toContain(
      "scoringProfileHash",
    );
  });

  it("keeps semantic requests stable across request envelopes", () => {
    const first = hashEvaluationRequest(evaluationRequest());
    const retry = hashEvaluationRequest(
      evaluationRequest({
        requestId: "request-9999",
        submittedAt: "2031-02-03T04:05:06Z",
        callerId: "caller-b",
        retryAttempt: 3,
        transport: "test-harness",
        evaluationRequestHash: `sha256:${"e".repeat(64)}`,
      }),
    );
    expect(first.hash).toBe(retry.hash);
    expect(new TextDecoder().decode(first.canonicalBytes)).not.toContain(
      "evaluationRequestHash",
    );
    expect(
      hashEvaluationRequest(
        evaluationRequest({
          deterministicRequestOptions: {
            seed: 43,
            partialEvidencePolicy: "reject",
          },
        }),
      ).hash,
    ).not.toBe(first.hash);
  });

  it("keeps configuration stable across authoring time and set order", () => {
    const first = hashEvaluationPlanConfiguration(evaluationPlan());
    const reordered = hashEvaluationPlanConfiguration(
      evaluationPlan({
        requiredCapabilities: ["route", "geometry"],
        createdAt: "2040-12-31T23:59:59Z",
        configurationHash: `sha256:${"d".repeat(64)}`,
      }),
    );
    expect(first.hash).toBe(reordered.hash);
    expect(new TextDecoder().decode(first.canonicalBytes)).not.toContain(
      "createdAt",
    );
  });

  it("separates deterministic evidence content from execution envelopes", () => {
    const content = {
      schemaVersion: "0.1",
      kind: "geometry-fact",
      manifestHash: TEST_IDENTITIES.manifestHash,
      subject: { kind: "scene" },
      producer: {
        component: "geometry-evaluator",
        version: "0.1.0",
        buildHash: TEST_IDENTITIES.producerBuildHash,
      },
      payload: {
        kind: "geometry-fact",
        objectIds: ["platform-a"],
        factKind: "normalized-object",
        geometryHash: TEST_IDENTITIES.geometryHash,
      },
      parentEvidenceHashes: [],
      artifactHashes: [],
      quality: { completeness: "complete", validityCodes: ["finite"] },
      limitations: [],
      evidenceContentHash: TEST_IDENTITIES.geometryHash,
    };
    const result = hashEvidenceContent(content);
    expect(new TextDecoder().decode(result.canonicalBytes)).not.toContain(
      "executionId",
    );
    expect(new TextDecoder().decode(result.canonicalBytes)).not.toContain(
      "evidenceContentHash",
    );
  });

  it("hashes calculation and availability foundations", () => {
    const calculation = hashCalculationBundle({
      schemaVersion: "0.1",
      manifestHash: TEST_IDENTITIES.manifestHash,
      configurationHash: TEST_IDENTITIES.calculationConfigurationHash,
      evaluatorVersion: "0.1.0",
      metricCatalogHash: TEST_IDENTITIES.calculationConfigurationHash,
      scoringProfileHash: TEST_IDENTITIES.calculationConfigurationHash,
      environmentCompatibilityClass: "static-native-parts-v1",
      evidence: [
        {
          kind: "geometry-fact",
          subjectKey: "scene",
          evidenceContentHash: TEST_IDENTITIES.geometryHash,
        },
      ],
      ruleVersions: [
        {
          component: "geometry-evaluator",
          version: "0.1.0",
          buildHash: TEST_IDENTITIES.ruleBuildHash,
        },
      ],
      calculationBundleHash: TEST_IDENTITIES.calculationBundleHash,
    });
    expect(calculation.hash).toMatch(/^sha256:/);
    expect(new TextDecoder().decode(calculation.canonicalBytes)).not.toContain(
      "calculationBundleHash",
    );
    const availability = hashAvailabilityRecord({
      schemaVersion: "0.1",
      subject: {
        kind: "evidence",
        stableId: "geometry:scene",
        contentHash: TEST_IDENTITIES.availabilitySubjectHash,
      },
      availabilityState: "restricted",
      reasonCode: "rights-review",
      reasonDetails: [],
      authority: {
        authorityKind: "rights-review",
        authorityId: "rights-review:review-1",
      },
      effectiveSequence: 1,
      supersedesAvailabilityRecordHashes: [],
      policy: {
        component: "availability",
        version: "1.0.0",
        buildHash: TEST_IDENTITIES.ruleBuildHash,
      },
      impactScope: {
        scopeKind: "subject-only",
        affectedIdentityHashes: [TEST_IDENTITIES.availabilitySubjectHash],
      },
      availabilityRecordHash: TEST_IDENTITIES.ruleBuildHash,
    });
    expect(availability.hash).toMatch(/^sha256:/);
    expect(new TextDecoder().decode(availability.canonicalBytes)).not.toContain(
      "availabilityRecordHash",
    );
  });
});

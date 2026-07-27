import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  EVALUATOR_CANONICAL_JSON_ALGORITHM,
  evaluatorCanonicalize,
} from "@obby/canonical-json";

import {
  parseMetricCatalog,
  parseMetricDefinition,
  parseScoringProfile,
  verifyMetricCatalogIdentity,
  verifyMetricDefinitionIdentity,
  verifyScoringProfileIdentity,
} from "../src/index.js";

async function fixture(name: string): Promise<unknown> {
  return JSON.parse(
    await readFile(
      new URL(`../fixtures/generated/${name}`, import.meta.url),
      "utf8",
    ),
  ) as unknown;
}

describe("generated evaluator fixtures", () => {
  it("pins reviewable non-placeholder semantic identity sources", async () => {
    const identities = (await fixture("e1-identity-sources.json")) as {
      identityId: string;
      identityHash: string;
      semanticFixture: Record<string, unknown>;
    }[];
    expect(identities.map((identity) => identity.identityId)).toEqual([
      "manifest-e1a-fixture-v1",
      "geometry-e1a-fixture-v1",
      "producer-build-e1a-v1",
      "rule-build-e1a-v1",
      "availability-policy-build-v1",
      "fixture-generator-build-v1",
    ]);
    for (const identity of identities) {
      expect(identity.semanticFixture).toBeTypeOf("object");
      expect(identity.identityHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(identity.identityHash).not.toBe(`sha256:${"0".repeat(64)}`);
      const { identityHash, ...source } = identity;
      const bytes = evaluatorCanonicalize({
        canonicalizationAlgorithm: EVALUATOR_CANONICAL_JSON_ALGORITHM,
        ...source,
      }).canonicalBytes;
      expect(identityHash).toBe(
        `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      );
    }
    for (const name of [
      "e1-metric-definitions.json",
      "e1-metric-catalog.json",
      "e1-scoring-profile.json",
      "e1-semantic-configurations.json",
      "e1-identity-sources.json",
      "hash-vectors.json",
    ]) {
      expect(JSON.stringify(await fixture(name))).not.toContain(
        `sha256:${"0".repeat(64)}`,
      );
    }
  });

  it("contains a valid E1-only metric catalog and non-aggregate profile", async () => {
    const definitions = (await fixture(
      "e1-metric-definitions.json",
    )) as unknown[];
    expect(
      definitions
        .map(verifyMetricDefinitionIdentity)
        .map((definition) => definition.metricId),
    ).toEqual([
      "playability.route-completeness",
      "playability.required-transition-feasibility",
      "checkpoint.topology-validity",
      "finish.topology-validity",
      "hazard.relationship-candidate-count",
      "playability.skip-candidate-count",
      "policy.evidence-completeness",
      "runtime.checkpoint-isolation-availability",
      "policy.decorative-collision-violations",
      "performance.native-part-count",
    ]);
    expect(
      verifyMetricCatalogIdentity(await fixture("e1-metric-catalog.json"))
        .catalogId,
    ).toBe("e1-static");
    const profile = verifyScoringProfileIdentity(
      await fixture("e1-scoring-profile.json"),
    );
    expect(profile.aggregateScore).toBe(false);
    expect(
      profile.categories.every(
        (category) => category.availability === "available",
      ),
    ).toBe(true);
    expect(profile.categories.map((category) => category.categoryId)).toEqual([
      "playability",
      "checkpoint",
      "hazard",
      "policy",
      "performance",
    ]);
    const policy = definitions
      .map(verifyMetricDefinitionIdentity)
      .find(
        (definition) =>
          definition.metricId === "policy.decorative-collision-violations",
      );
    expect(policy?.requiredCapabilities).toEqual(["geometry"]);
    expect(policy?.requiredEvidenceKinds).toEqual(["geometry-fact"]);
    expect(policy?.calculation.configurationHash).not.toBe(
      `sha256:${"0".repeat(64)}`,
    );
    expect(policy?.calculationAvailability).toBe("available");
  });

  it("fails closed when a content-addressed fixture is altered", async () => {
    const catalog = parseMetricCatalog(await fixture("e1-metric-catalog.json"));
    expect(() =>
      verifyMetricCatalogIdentity({
        ...catalog,
        catalogVersion: "1.0.1",
      }),
    ).toThrow(/content hash mismatch/i);
    expect(
      parseMetricDefinition(
        ((await fixture("e1-metric-definitions.json")) as unknown[])[0],
      ).metricId,
    ).toBe("playability.route-completeness");
    expect(
      parseScoringProfile(await fixture("e1-scoring-profile.json"))
        .aggregateScore,
    ).toBe(false);
  });

  it("commits reproducible canonical-byte golden vectors", async () => {
    const vectors = (await fixture("hash-vectors.json")) as {
      preimageName: string;
      hash: string;
      canonicalPayloadUtf8: string;
    }[];
    expect(vectors.map((vector) => vector.preimageName)).toEqual([
      "MetricDefinitionPreimage",
      "MetricCatalogPreimage",
      "ScoringProfilePreimage",
      "EvaluationPlanConfigurationPreimage",
      "EvaluationRequestPreimage",
      "EvidenceContentPreimage",
      "CalculationBundlePreimage",
      "AvailabilityRecordPreimage",
    ]);
    for (const vector of vectors) {
      const digest = createHash("sha256")
        .update(new TextEncoder().encode(vector.canonicalPayloadUtf8))
        .digest("hex");
      expect(vector.hash).toBe(`sha256:${digest}`);
    }
    const manual = JSON.parse(
      await readFile(
        new URL("../fixtures/manual/hash-vector-digests.json", import.meta.url),
        "utf8",
      ),
    ) as {
      generatedFixtureDigests: Record<string, string>;
      smallVectors: {
        canonicalPayloadUtf8: string;
        hash: string;
        preimageName: string;
      }[];
    };
    expect(
      Object.fromEntries(
        vectors.map((vector) => [vector.preimageName, vector.hash]),
      ),
    ).toEqual(manual.generatedFixtureDigests);
    expect(manual.smallVectors).toHaveLength(vectors.length);
    for (const vector of manual.smallVectors) {
      expect(
        `sha256:${createHash("sha256")
          .update(vector.canonicalPayloadUtf8, "utf8")
          .digest("hex")}`,
      ).toBe(vector.hash);
    }
  });
});

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

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
  it("contains a valid E1-only metric catalog and non-aggregate profile", async () => {
    const definitions = (await fixture(
      "e1-metric-definitions.json",
    )) as unknown[];
    expect(definitions.map(verifyMetricDefinitionIdentity)).toHaveLength(2);
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
        (category) => category.availability === "planned",
      ),
    ).toBe(true);
    expect(profile.categories.map((category) => category.categoryId)).toEqual([
      "playability",
      "policy",
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
    expect(policy?.calculationAvailability).toBe("unavailable-in-e1a");
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

import { describe, expect, it } from "vitest";

import {
  DEFAULT_MECHANIC_CATALOG,
  assertValidGenerationBundle,
  generateObby,
  hashGeneratorPreimage,
  normalizeGenerationRequest,
} from "@obby/obby-generator";
import type { GenerationBundle } from "@obby/obby-generator";

const request = {
  schemaVersion: "0.1",
  requestId: "validation",
  workingName: "Validation",
  genre: "obby",
  theme: "space",
  stageCount: 15,
  difficulty: "medium",
  checkpointFrequency: 5,
  seed: 123,
} as const;

function refresh(bundle: GenerationBundle): void {
  bundle.obbySpec.obbySpecHash = hashGeneratorPreimage(
    bundle.obbySpec,
    "obbySpecHash",
  );
  bundle.generationBundleHash = hashGeneratorPreimage(
    bundle,
    "generationBundleHash",
  );
}

describe("G0 graph validation", () => {
  it("rejects unknown structural fields before semantic processing", () => {
    const bundle = generateObby(request) as GenerationBundle & {
      generatedAt?: string;
    };
    bundle.generatedAt = "2026-01-01T00:00:00Z";
    expect(() => assertValidGenerationBundle(bundle)).toThrow(
      expect.objectContaining({ code: "schema" }),
    );
  });

  it("rejects a duplicate stage identity even when affected hashes are current", () => {
    const bundle = structuredClone(generateObby(request));
    const second = bundle.obbySpec.stages[1];
    if (second === undefined) throw new Error("fixture missing second stage");
    const first = bundle.obbySpec.stages[0];
    if (first === undefined) throw new Error("fixture missing first stage");
    second.stageId = first.stageId;
    second.stageHash = hashGeneratorPreimage(second, "stageHash");
    refresh(bundle);
    expect(() => assertValidGenerationBundle(bundle)).toThrow(
      expect.objectContaining({ code: "duplicate-id" }),
    );
  });

  it("rejects a hazard that references a nonexistent stage with fresh hashes", () => {
    const bundle = structuredClone(generateObby(request));
    const hazard = bundle.obbySpec.hazards[0];
    if (hazard === undefined) throw new Error("fixture missing hazard");
    hazard.stageId = "stage-unknown";
    hazard.hazardHash = hashGeneratorPreimage(hazard, "hazardHash");
    refresh(bundle);
    expect(() => assertValidGenerationBundle(bundle)).toThrow(
      expect.objectContaining({ code: "invalid-reference" }),
    );
  });

  it("rejects decorative gameplay collision with fresh hashes", () => {
    const bundle = structuredClone(generateObby(request));
    const decoration = bundle.obbySpec.assetIntents.find(
      (item) => item.authority === "decorative",
    );
    if (decoration === undefined) throw new Error("fixture missing decoration");
    decoration.collisionPolicy = "native-parts-colliding";
    decoration.assetIntentHash = hashGeneratorPreimage(
      decoration,
      "assetIntentHash",
    );
    refresh(bundle);
    expect(() => assertValidGenerationBundle(bundle)).toThrow(
      expect.objectContaining({ code: "invariant" }),
    );
  });

  it("rejects a stale seedIdentity after an explicit seed mutation", () => {
    const bundle = structuredClone(generateObby(request));
    bundle.obbySpec.seed += 1;
    refresh(bundle);
    expect(() => assertValidGenerationBundle(bundle)).toThrow(
      expect.objectContaining({ code: "hash-mismatch" }),
    );
  });

  it("rejects a route node rebound away from its ordinal stage", () => {
    const bundle = structuredClone(generateObby(request));
    const node = bundle.obbySpec.route.nodes[2];
    if (node === undefined) throw new Error("fixture missing route node");
    node.stageId = "stage-unknown";
    node.routeNodeHash = hashGeneratorPreimage(node, "routeNodeHash");
    bundle.obbySpec.route.routeHash = hashGeneratorPreimage(
      bundle.obbySpec.route,
      "routeHash",
    );
    refresh(bundle);
    expect(() => assertValidGenerationBundle(bundle)).toThrow(
      expect.objectContaining({ code: "invariant" }),
    );
  });

  it("excludes each representative result hash from its own preimage", () => {
    const bundle = generateObby(request);
    const cases: [object, string][] = [
      [bundle.normalizedRequest, "normalizedRequestHash"],
      [bundle.obbySpec, "obbySpecHash"],
      [bundle.obbySpec.stages[0] as object, "stageHash"],
      [bundle.obbySpec.route, "routeHash"],
      [bundle.obbySpec.difficultyPlan, "difficultyPlanHash"],
      [
        bundle.obbySpec.visualStyleIntents[0] as object,
        "visualStyleIntentHash",
      ],
      [bundle.obbySpec.assetIntents[0] as object, "assetIntentHash"],
      [bundle, "generationBundleHash"],
    ];
    for (const [value, field] of cases) {
      const first = hashGeneratorPreimage(value, field);
      const changed = { ...value, [field]: `sha256:${"f".repeat(64)}` };
      expect(hashGeneratorPreimage(changed, field), field).toBe(first);
    }
  });
});

describe("G0 planning boundaries", () => {
  it.each([5, 50])(
    "accepts the exact supported stage-count boundary %i",
    (stageCount) => {
      expect(
        generateObby({ ...request, stageCount }).obbySpec.stages,
      ).toHaveLength(stageCount);
    },
  );

  it.each([4, 51])(
    "rejects the first unsupported stage count %i",
    (stageCount) => {
      expect(() =>
        normalizeGenerationRequest({ ...request, stageCount }),
      ).toThrow(expect.objectContaining({ code: "stage-count" }));
    },
  );

  it("places the documented single checkpoint in a five-stage frequency-three plan", () => {
    const spec = generateObby({
      ...request,
      stageCount: 5,
      checkpointFrequency: 3,
    }).obbySpec;
    expect(
      spec.checkpoints.map((item) => [item.stageId, item.routeOrder]),
    ).toEqual([["stage-03", 3]]);
    expect(spec.finish.afterStageId).toBe("stage-05");
  });

  it("moves a hard-peak checkpoint to the immediately following recovery stage", () => {
    const spec = generateObby({
      ...request,
      stageCount: 30,
      difficulty: "hard",
      checkpointFrequency: 23,
    }).obbySpec;
    expect(spec.difficultyPlan.bands[23]?.band).toBe("recovery");
    expect(spec.checkpoints.map((item) => item.stageId)).toEqual(["stage-24"]);
  });

  it("introduces mechanics before reuse and avoids immediate repetition when alternatives exist", () => {
    const intents = generateObby(request).obbySpec.mechanicIntents;
    const seen = new Set<string>();
    for (const [index, intent] of intents.entries()) {
      expect(intent.use === "introduce").toBe(!seen.has(intent.mechanicId));
      if (index > 0 && index < intents.length - 1)
        expect(intent.mechanicId).not.toBe(intents[index - 1]?.mechanicId);
      seen.add(intent.mechanicId);
    }
  });

  it("enforces exclusions and emits a deterministic low-variety finding", () => {
    const bundle = generateObby({
      ...request,
      supportedMechanicPreferences: ["static-jumps"],
      excludedMechanics: ["moving-platform"],
    });
    expect(
      bundle.obbySpec.mechanicIntents.some(
        (item) => item.mechanicId === "moving-platform",
      ),
    ).toBe(false);
    expect(bundle.findings.map((item) => item.code)).toContain(
      "limited-mechanic-variety",
    );
    assertValidGenerationBundle(bundle, DEFAULT_MECHANIC_CATALOG);
  });

  it("never places catalog-forbidden mechanics next to each other", () => {
    const spec = generateObby({ ...request, stageCount: 50 }).obbySpec;
    const mechanicByIntent = new Map(
      spec.mechanicIntents.map((intent) => [
        intent.mechanicIntentId,
        intent.mechanicId,
      ]),
    );
    const definitionById = new Map(
      DEFAULT_MECHANIC_CATALOG.mechanics.map((definition) => [
        definition.mechanicId,
        definition,
      ]),
    );
    for (let index = 1; index < spec.stages.length; index += 1) {
      const previousId = mechanicByIntent.get(
        spec.stages[index - 1]?.mechanicIntentIds[0] ?? "",
      );
      const currentId = mechanicByIntent.get(
        spec.stages[index]?.mechanicIntentIds[0] ?? "",
      );
      expect(
        definitionById
          .get(previousId ?? "")
          ?.forbiddenAdjacentMechanicIds.includes(currentId ?? "") ?? false,
      ).toBe(false);
      expect(
        definitionById
          .get(currentId ?? "")
          ?.forbiddenAdjacentMechanicIds.includes(previousId ?? "") ?? false,
      ).toBe(false);
    }
  });
});

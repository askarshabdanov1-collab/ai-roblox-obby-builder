import { describe, expect, it } from "vitest";

import {
  DEFAULT_GENERATOR_CONFIGURATION,
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
  bundle.generationBundleId = `bundle-${bundle.obbySpec.obbySpecHash.slice(7, 23)}`;
  bundle.generationBundleHash = hashGeneratorPreimage(
    bundle,
    "generationBundleHash",
  );
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`missing ${label}`);
  return value;
}

function refreshMechanicUses(bundle: GenerationBundle): void {
  const intentById = new Map(
    bundle.obbySpec.mechanicIntents.map((intent) => [
      intent.mechanicIntentId,
      intent,
    ]),
  );
  const seen = new Set<string>();
  for (const stage of bundle.obbySpec.stages) {
    const intent = intentById.get(stage.mechanicIntentIds[0]);
    if (intent === undefined) continue;
    intent.use = seen.has(intent.mechanicId) ? "practice" : "introduce";
    seen.add(intent.mechanicId);
    intent.mechanicIntentHash = hashGeneratorPreimage(
      intent,
      "mechanicIntentHash",
    );
  }
}

function setStageMechanic(
  bundle: GenerationBundle,
  stageIndex: number,
  mechanicId: string,
): void {
  const stage = required(bundle.obbySpec.stages.at(stageIndex), "stage");
  const intent = required(
    bundle.obbySpec.mechanicIntents.find(
      (item) => item.mechanicIntentId === stage.mechanicIntentIds[0],
    ),
    "mechanic intent",
  );
  intent.mechanicId = mechanicId;
  intent.mechanicVersion = "1";
  for (const hazardId of stage.hazardIds) {
    const hazard = required(
      bundle.obbySpec.hazards.find((item) => item.hazardId === hazardId),
      "hazard",
    );
    hazard.mechanicId = mechanicId;
    hazard.kind = "kill-part";
    hazard.hazardHash = hashGeneratorPreimage(hazard, "hazardHash");
  }
}

function validate(bundle: GenerationBundle): void {
  assertValidGenerationBundle(
    bundle,
    DEFAULT_MECHANIC_CATALOG,
    DEFAULT_GENERATOR_CONFIGURATION,
  );
}

describe("G0 graph validation", () => {
  it("rejects unknown structural fields before semantic processing", () => {
    const bundle = generateObby(request) as GenerationBundle & {
      generatedAt?: string;
    };
    bundle.generatedAt = "2026-01-01T00:00:00Z";
    expect(() => validate(bundle)).toThrow(
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
    expect(() => validate(bundle)).toThrow(
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
    expect(() => validate(bundle)).toThrow(
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
    expect(() => validate(bundle)).toThrow(
      expect.objectContaining({ code: "invariant" }),
    );
  });

  it("rejects a stale seedIdentity after an explicit seed mutation", () => {
    const bundle = structuredClone(generateObby(request));
    bundle.obbySpec.seed += 1;
    refresh(bundle);
    expect(() => validate(bundle)).toThrow(
      expect.objectContaining({ code: "invalid-reference" }),
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
    expect(() => validate(bundle)).toThrow(
      expect.objectContaining({ code: "invalid-reference" }),
    );
  });

  it("rejects a playable stage without its required mechanic", () => {
    const bundle = structuredClone(generateObby(request));
    const stage = required(bundle.obbySpec.stages.at(0), "first stage");
    stage.mechanicIntentIds = [] as unknown as [string];
    stage.stageHash = hashGeneratorPreimage(stage, "stageHash");
    refresh(bundle);
    expect(() => validate(bundle)).toThrow(
      expect.objectContaining({ code: "schema" }),
    );
  });

  it("rejects an orphan mechanic intent", () => {
    const bundle = structuredClone(generateObby(request));
    const orphan = structuredClone(
      required(bundle.obbySpec.mechanicIntents.at(0), "first mechanic intent"),
    );
    orphan.mechanicIntentId = "mechanic-intent-orphan";
    orphan.mechanicIntentHash = hashGeneratorPreimage(
      orphan,
      "mechanicIntentHash",
    );
    bundle.obbySpec.mechanicIntents.push(orphan);
    refresh(bundle);
    expect(() => validate(bundle)).toThrow(
      expect.objectContaining({ code: "invariant" }),
    );
  });

  it("rejects a checkpoint route node without its CheckpointSpec", () => {
    const bundle = structuredClone(
      generateObby({ ...request, checkpointFrequency: 3 }),
    );
    bundle.obbySpec.checkpoints.shift();
    refresh(bundle);
    expect(() => validate(bundle)).toThrow();
  });

  it("rejects an incompatible moving hazard on a static mechanic", () => {
    const bundle = structuredClone(generateObby(request));
    const hazard = required(bundle.obbySpec.hazards.at(0), "first hazard");
    hazard.kind = "moving-obstacle-intent";
    hazard.hazardHash = hashGeneratorPreimage(hazard, "hazardHash");
    refresh(bundle);
    expect(() => validate(bundle)).toThrow(
      expect.objectContaining({ code: "invalid-reference" }),
    );
  });

  it("rejects external asset policy under native-parts-only", () => {
    const bundle = structuredClone(generateObby(request));
    const asset = required(bundle.obbySpec.assetIntents.at(0), "first asset");
    asset.preferredSourcePolicy = "external-assets-allowed-later";
    asset.assetIntentHash = hashGeneratorPreimage(asset, "assetIntentHash");
    refresh(bundle);
    expect(() => validate(bundle)).toThrow(
      expect.objectContaining({ code: "invariant" }),
    );
  });

  it("accepts a repetition limit exactly met and rejects the next repeat", () => {
    const exact = structuredClone(generateObby(request));
    for (let index = 0; index < 3; index += 1)
      setStageMechanic(exact, index, "static-jumps");
    setStageMechanic(exact, 3, "height-changes");
    refreshMechanicUses(exact);
    refresh(exact);
    expect(() => validate(exact)).not.toThrow();

    const exceeded = structuredClone(exact);
    setStageMechanic(exceeded, 3, "static-jumps");
    refreshMechanicUses(exceeded);
    refresh(exceeded);
    expect(() => validate(exceeded)).toThrow(
      expect.objectContaining({
        code: "invariant",
      }),
    );
  });

  it("rejects a catalog-forbidden adjacency with fresh hashes", () => {
    const bundle = structuredClone(generateObby(request));
    setStageMechanic(bundle, 1, "balance-beam");
    setStageMechanic(bundle, 2, "narrow-platforms");
    refreshMechanicUses(bundle);
    refresh(bundle);
    expect(() => validate(bundle)).toThrow(
      expect.objectContaining({
        code: "invariant",
      }),
    );
  });

  it("rejects gameplay-authoritative assets without native-Part fallback", () => {
    const bundle = structuredClone(generateObby(request));
    const asset = required(
      bundle.obbySpec.assetIntents.find(
        (item) => item.authority === "gameplay-authoritative",
      ),
      "gameplay asset",
    );
    (asset as unknown as { nativePartFallback: boolean }).nativePartFallback =
      false;
    asset.assetIntentHash = hashGeneratorPreimage(asset, "assetIntentHash");
    refresh(bundle);
    expect(() => validate(bundle)).toThrow(
      expect.objectContaining({ code: "schema" }),
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

  it("marks first use as introduction and respects catalog repetition limits", () => {
    const intents = generateObby(request).obbySpec.mechanicIntents;
    const seen = new Set<string>();
    let previous: string | undefined;
    let repeated = 0;
    for (const intent of intents) {
      expect(intent.use === "introduce").toBe(!seen.has(intent.mechanicId));
      repeated = intent.mechanicId === previous ? repeated + 1 : 1;
      expect(repeated).toBeLessThanOrEqual(
        DEFAULT_MECHANIC_CATALOG.mechanics.find(
          (mechanic) => mechanic.mechanicId === intent.mechanicId,
        )?.repetitionLimit ?? 0,
      );
      previous = intent.mechanicId;
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
    validate(bundle);
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

import { readdir, readFile } from "node:fs/promises";

import { compilePlaceSpec } from "@obby/obby-compiler";
import { describe, expect, it } from "vitest";

import {
  computeManifestHash,
  semanticPlaceSpecIssues,
  type PlaceSpec,
  type SceneManifest,
  validatePlaceSpec,
  validateSceneManifest,
} from "../src/index.js";

type MutationFixture = {
  contract: "PlaceSpec" | "SceneManifest";
  mutation: {
    operation: "delete" | "set";
    path: string;
    value?: unknown;
  };
  expectedIssue: string;
};

const validPlaceSpecUrl = new URL(
  "../../../examples/vertical-slice/place-spec.json",
  import.meta.url,
);
const invalidFixtureUrl = new URL(
  "../../../examples/invalid/",
  import.meta.url,
);

async function readJson(url: URL): Promise<unknown> {
  return JSON.parse(await readFile(url, "utf8")) as unknown;
}

async function validSpec(): Promise<PlaceSpec> {
  return (await readJson(validPlaceSpecUrl)) as PlaceSpec;
}

async function validateChangedManifestAsync(
  change: (manifest: SceneManifest) => void,
): Promise<ReturnType<typeof validateSceneManifest>> {
  const manifest = compilePlaceSpec(await validSpec());
  change(manifest);
  manifest.manifestHash = computeManifestHash(manifest);
  return validateSceneManifest(manifest);
}

function issueCodes(result: ReturnType<typeof validatePlaceSpec>): string[] {
  return result.ok ? [] : result.issues.map(({ code }) => code);
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function mutate(input: unknown, fixture: MutationFixture): unknown {
  const result = structuredClone(input) as Record<string, unknown>;
  const segments = fixture.mutation.path
    .split("/")
    .slice(1)
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  const key = segments.pop();
  if (key === undefined) throw new Error("Mutation path must not be empty");

  let target: unknown = result;
  for (const segment of segments) {
    if (typeof target !== "object" || target === null)
      throw new Error(`Invalid mutation path at ${segment}`);
    target = (target as Record<string, unknown>)[segment];
  }
  if (typeof target !== "object" || target === null)
    throw new Error("Invalid mutation target");

  if (fixture.mutation.operation === "delete") {
    if (Array.isArray(target)) target.splice(Number(key), 1);
    else Reflect.deleteProperty(target, key);
  } else if (Array.isArray(target)) {
    target[Number(key)] = fixture.mutation.value;
  } else {
    (target as Record<string, unknown>)[key] = fixture.mutation.value;
  }
  return result;
}

describe("contract validation", () => {
  it("accepts the positive vertical-slice contracts", async () => {
    const placeSpec = await readJson(validPlaceSpecUrl);
    const placeResult = validatePlaceSpec(placeSpec);
    expect(placeResult.ok).toBe(true);
    expect(validateSceneManifest(compilePlaceSpec(placeSpec)).ok).toBe(true);
  });

  it("accepts structural numeric boundaries when semantics remain valid", async () => {
    const placeSpec = (await readJson(validPlaceSpecUrl)) as Record<
      string,
      unknown
    >;
    placeSpec.seed = 2_147_483_647;
    expect(validatePlaceSpec(placeSpec).ok).toBe(true);
  });

  it("keeps structural and semantic validation separate", async () => {
    const placeSpec = (await readJson(validPlaceSpecUrl)) as PlaceSpec;
    const [firstObstacle, secondObstacle] = placeSpec.obstacles;
    secondObstacle.id = firstObstacle.id;
    const result = validatePlaceSpec(placeSpec);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues).toContainEqual(
        expect.objectContaining({ kind: "semantic" }),
      );
    expect(semanticPlaceSpecIssues(placeSpec)).toContainEqual(
      expect.objectContaining({ code: "duplicate-obstacle-id" }),
    );
  });

  it("rejects every named invalid fixture", async () => {
    const basePlaceSpec = await readJson(validPlaceSpecUrl);
    const baseManifest = compilePlaceSpec(basePlaceSpec);
    const fixtureNames = (await readdir(invalidFixtureUrl))
      .filter((name) => name.endsWith(".json"))
      .sort();
    expect(fixtureNames).toHaveLength(10);

    for (const fixtureName of fixtureNames) {
      const fixture = (await readJson(
        new URL(fixtureName, invalidFixtureUrl),
      )) as MutationFixture;
      const base =
        fixture.contract === "PlaceSpec" ? basePlaceSpec : baseManifest;
      const candidate = mutate(base, fixture);
      const result =
        fixture.contract === "PlaceSpec"
          ? validatePlaceSpec(candidate)
          : validateSceneManifest(candidate);
      expect(result.ok, fixtureName).toBe(false);
      if (!result.ok) {
        expect(
          result.issues.some((item) => item.code === fixture.expectedIssue),
          `${fixtureName} did not produce ${fixture.expectedIssue}: ${JSON.stringify(result.issues)}`,
        ).toBe(true);
      }
    }
  });

  it("detects any manifest mutation unless the canonical hash is recomputed", async () => {
    const manifest = compilePlaceSpec(await readJson(validPlaceSpecUrl));
    const changedObject = manifest.layers.gameplay.objects[1];
    changedObject.color = "#FFFFFF";
    const stale = validateSceneManifest(manifest);
    expect(stale.ok).toBe(false);
    if (!stale.ok)
      expect(stale.issues).toContainEqual(
        expect.objectContaining({ code: "manifest-hash" }),
      );

    manifest.manifestHash = computeManifestHash(manifest);
    expect(validateSceneManifest(manifest).ok).toBe(true);
  });

  it("rejects every unsupported native class and shape combination", async () => {
    const classes = ["Part", "SpawnLocation", "WedgePart"] as const;
    const shapes = ["Block", "Ball", "Cylinder", "Wedge"] as const;
    for (const objectIndex of [0, 1]) {
      for (const className of classes) {
        for (const shape of shapes) {
          const accepted =
            objectIndex === 0
              ? className === "SpawnLocation" && shape === "Block"
              : (className === "Part" && shape !== "Wedge") ||
                (className === "WedgePart" && shape === "Wedge");
          if (accepted) continue;
          const result = await validateChangedManifestAsync((manifest) => {
            const object = required(
              manifest.layers.gameplay.objects[objectIndex],
              "fixture gameplay object is missing",
            );
            object.className = className;
            object.shape = shape;
          });
          expect(result.ok, `${objectIndex}:${className}/${shape}`).toBe(false);
          if (!result.ok)
            expect(result.issues).toContainEqual(
              expect.objectContaining({ code: "class-shape" }),
            );
        }
      }
    }
  });

  it("rejects every gameplay role and behavior-kind mismatch", async () => {
    const roles = [
      "spawn",
      "platform",
      "checkpoint",
      "kill",
      "finish",
    ] as const;
    const objectIndexByRole = [0, 1, 2, 4, 5] as const;
    for (const [roleIndex, objectIndex] of objectIndexByRole.entries()) {
      const role = required(roles[roleIndex], "fixture role is missing");
      for (const kind of roles) {
        if (kind === role) continue;
        const result = await validateChangedManifestAsync((manifest) => {
          required(
            manifest.layers.gameplay.objects[objectIndex],
            "fixture gameplay object is missing",
          ).behavior.kind = kind;
        });
        expect(result.ok, `${role}/${kind}`).toBe(false);
        if (!result.ok)
          expect(result.issues).toContainEqual(
            expect.objectContaining({ code: "behavior-role" }),
          );
      }
    }
  });

  it("rejects unsupported material, behavior, physics, and decoration combinations", async () => {
    const structuralMaterial = await validateChangedManifestAsync(
      (manifest) => {
        (
          manifest.layers.gameplay.objects[1] as unknown as {
            material: string;
          }
        ).material = "Glass";
      },
    );
    expect(structuralMaterial.ok).toBe(false);

    const behavior = await validateChangedManifestAsync((manifest) => {
      manifest.layers.gameplay.objects[1].behavior.kind = "finish";
    });
    expect(behavior.ok).toBe(false);
    if (!behavior.ok)
      expect(behavior.issues).toContainEqual(
        expect.objectContaining({ code: "behavior-role" }),
      );

    const physics = await validateChangedManifestAsync((manifest) => {
      manifest.layers.gameplay.objects[1].physics.canCollide = false;
    });
    expect(physics.ok).toBe(false);
    if (!physics.ok)
      expect(physics.issues).toContainEqual(
        expect.objectContaining({ code: "gameplay-collision" }),
      );

    const classes = ["Part", "WedgePart"] as const;
    const shapes = ["Block", "Ball", "Cylinder", "Wedge"] as const;
    for (const className of classes) {
      for (const shape of shapes) {
        const accepted =
          (className === "Part" && shape !== "Wedge") ||
          (className === "WedgePart" && shape === "Wedge");
        if (accepted) continue;
        const decoration = await validateChangedManifestAsync((manifest) => {
          manifest.layers.decorative.objects.push({
            id: "UnsupportedDecoration",
            order: 0,
            role: "decoration",
            className,
            shape,
            transform: {
              position: { x: 0, y: 10, z: 10 },
              rotation: { x: 0, y: 0, z: 0 },
            },
            size: { x: 2, y: 2, z: 2 },
            color: "#FFFFFF",
            material: "SmoothPlastic",
            physics: {
              anchored: true,
              canCollide: false,
              canTouch: false,
              canQuery: true,
            },
            behavior: { kind: "decoration" },
          });
        });
        expect(decoration.ok, `${className}/${shape}`).toBe(false);
        if (!decoration.ok)
          expect(decoration.issues).toContainEqual(
            expect.objectContaining({ code: "decorative-class-shape" }),
          );
      }
    }
  });

  it("rejects missing, duplicate, out-of-order, and unknown navigation references", async () => {
    const cases: [string, (manifest: SceneManifest) => void, string][] = [
      [
        "missing",
        (manifest) => {
          manifest.navigation.safeRouteObjectIds.splice(1, 1);
        },
        "safe-route-order",
      ],
      [
        "duplicate",
        (manifest) => {
          manifest.navigation.safeRouteObjectIds[1] =
            manifest.navigation.safeRouteObjectIds[0];
        },
        "uniqueItems",
      ],
      [
        "out-of-order",
        (manifest) => {
          manifest.navigation.routeEntries[0].routeOrder = 2;
        },
        "route-entry-order",
      ],
      [
        "unknown",
        (manifest) => {
          manifest.navigation.safeRouteObjectIds[0] = "UnknownObject";
          manifest.navigation.stages[0].safeRouteObjectIds[0] = "UnknownObject";
          manifest.navigation.routeEntries[0].objectId = "UnknownObject";
        },
        "unknown-safe-route-object",
      ],
    ];
    for (const [name, change, code] of cases) {
      const result = await validateChangedManifestAsync(change);
      expect(result.ok, name).toBe(false);
      if (!result.ok)
        expect(result.issues).toContainEqual(expect.objectContaining({ code }));
    }
  });

  it("enforces coarse reachability boundaries for gaps, rises, and drops", async () => {
    const exactGap = await validSpec();
    exactGap.obstacles[0].transform.position.z = 17;
    expect(issueCodes(validatePlaceSpec(exactGap))).not.toContain(
      "coarse-reachability-gap",
    );
    exactGap.obstacles[0].transform.position.z = 17.000_001;
    expect(issueCodes(validatePlaceSpec(exactGap))).toContain(
      "coarse-reachability-gap",
    );

    const exactRise = await validSpec();
    exactRise.obstacles[0].transform.position.y =
      exactRise.spawn.transform.position.y +
      exactRise.spawn.size.y / 2 +
      exactRise.coarseReachability.maxVerticalRise -
      exactRise.obstacles[0].size.y / 2;
    expect(issueCodes(validatePlaceSpec(exactRise))).not.toContain(
      "coarse-reachability-rise",
    );
    exactRise.obstacles[0].transform.position.y += 0.000_001;
    expect(issueCodes(validatePlaceSpec(exactRise))).toContain(
      "coarse-reachability-rise",
    );

    const exactDrop = await validSpec();
    exactDrop.obstacles[0].transform.position.y = -17.5;
    expect(issueCodes(validatePlaceSpec(exactDrop))).not.toContain(
      "coarse-reachability-drop",
    );
    exactDrop.obstacles[0].transform.position.y = -17.500_001;
    expect(issueCodes(validatePlaceSpec(exactDrop))).toContain(
      "coarse-reachability-drop",
    );
  });

  it("applies part-size and world-extent budgets to spawn", async () => {
    const size = await validSpec();
    size.spawn.size.x = size.budgets.maxPartSize;
    expect(issueCodes(validatePlaceSpec(size))).not.toContain(
      "part-size-budget",
    );
    size.spawn.size.x = size.budgets.maxPartSize + 0.000_001;
    expect(issueCodes(validatePlaceSpec(size))).toContain("part-size-budget");

    const extent = await validSpec();
    const radius =
      Math.hypot(
        extent.spawn.size.x,
        extent.spawn.size.y,
        extent.spawn.size.z,
      ) / 2;
    extent.spawn.transform.position.x = extent.budgets.maxWorldExtent - radius;
    expect(issueCodes(validatePlaceSpec(extent))).not.toContain(
      "world-extent-budget",
    );
    extent.spawn.transform.position.x += 0.000_001;
    expect(issueCodes(validatePlaceSpec(extent))).toContain(
      "world-extent-budget",
    );
  });

  it("requires a safe deterministic character placement policy", async () => {
    const invalidOffset = await validSpec();
    invalidOffset.characterPlacement.verticalOffset = 1.999_999;
    const offsetResult = validatePlaceSpec(invalidOffset);
    expect(offsetResult.ok).toBe(false);
    if (!offsetResult.ok)
      expect(offsetResult.issues).toContainEqual(
        expect.objectContaining({ code: "minimum" }),
      );

    const tiltedSpawn = await validSpec();
    tiltedSpawn.spawn.transform.rotation.x = 1;
    expect(issueCodes(validatePlaceSpec(tiltedSpawn))).toContain(
      "character-placement-surface-rotation",
    );

    const tiltedCheckpoint = await validSpec();
    tiltedCheckpoint.obstacles[1].transform.rotation.z = 1;
    expect(issueCodes(validatePlaceSpec(tiltedCheckpoint))).toContain(
      "character-placement-surface-rotation",
    );
  });

  it("rejects missing or tilted manifest placement semantics", async () => {
    const missing = await validateChangedManifestAsync((manifest) => {
      Reflect.deleteProperty(manifest.navigation, "characterPlacement");
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok)
      expect(missing.issues).toContainEqual(
        expect.objectContaining({ code: "required" }),
      );

    const tilted = await validateChangedManifestAsync((manifest) => {
      manifest.layers.gameplay.objects[2].transform.rotation.x = 1;
    });
    expect(tilted.ok).toBe(false);
    if (!tilted.ok)
      expect(tilted.issues).toContainEqual(
        expect.objectContaining({
          code: "character-placement-surface-rotation",
        }),
      );
  });

  it("documents rotated and wedge transitions as coarse axis-aligned checks", async () => {
    const spec = await validSpec();
    const first = spec.obstacles[0];
    const wedge = required(spec.obstacles[2], "fixture wedge is missing");
    first.transform.rotation = { x: 25, y: 45, z: 10 };
    wedge.transform.rotation = { x: -15, y: 90, z: 20 };
    expect(wedge.shape).toBe("Wedge");
    expect(validatePlaceSpec(spec).ok).toBe(true);
    expect(spec.coarseReachability.model).toBe("axis-aligned-surfaces-v1");
  });

  it("validates coarse reachability across a stage boundary", async () => {
    const spec = await validSpec();
    spec.stages[0].routeObstacleIds = ["JumpPlatform01", "Checkpoint01"];
    spec.stages.push({
      id: "tower-finish",
      order: 2,
      name: "Tower Finish",
      difficulty: 4,
      routeObstacleIds: ["WedgeClimb01", "FinishPlatform"],
    });
    for (const obstacle of spec.obstacles.slice(2)) {
      obstacle.stageId = "tower-finish";
    }
    spec.difficultyProgression.end = 4;
    spec.difficultyProgression.curve = "linear";
    expect(validatePlaceSpec(spec).ok).toBe(true);

    const checkpoint = spec.obstacles[1];
    const wedge = required(spec.obstacles[2], "fixture wedge is missing");
    wedge.transform.position.y =
      checkpoint.transform.position.y +
      checkpoint.size.y / 2 +
      spec.coarseReachability.maxVerticalRise -
      wedge.size.y / 2 +
      0.000_001;
    expect(issueCodes(validatePlaceSpec(spec))).toContain(
      "coarse-reachability-rise",
    );
  });
});

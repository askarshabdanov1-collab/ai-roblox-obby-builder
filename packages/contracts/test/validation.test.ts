import { readdir, readFile } from "node:fs/promises";

import { compilePlaceSpec } from "@obby/obby-compiler";
import { describe, expect, it } from "vitest";

import {
  computeManifestHash,
  semanticPlaceSpecIssues,
  type PlaceSpec,
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
});

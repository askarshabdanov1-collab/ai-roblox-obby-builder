import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  normalizeGeometryObjects,
  normalizeTransitionInput,
} from "../src/index.js";

type GeometryFixture = {
  objects: unknown[];
  transition?: unknown;
  expected: Record<string, unknown>;
};

async function fixture(
  kind: "invalid" | "valid",
  name: string,
): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(
      new URL(`../fixtures/${kind}/${name}.json`, import.meta.url),
      "utf8",
    ),
  ) as Record<string, unknown>;
}

describe("geometry fixtures", () => {
  it.each(["horizontal-platforms", "vertical-rise", "downward-transition"])(
    "normalizes the %s transition fixture",
    async (name) => {
      const value = (await fixture("valid", name)) as GeometryFixture;
      const transition = normalizeTransitionInput(
        value.transition,
        normalizeGeometryObjects(value.objects),
      );
      expect({
        horizontalGap: transition.horizontalSeparation.value,
        verticalRise: transition.verticalRise.value,
        downwardDrop: transition.downwardDrop.value,
      }).toEqual(value.expected);
    },
  );

  it.each(["rotated-parts", "wedge", "cylinder"])(
    "normalizes the %s shape fixture",
    async (name) => {
      const value = (await fixture("valid", name)) as GeometryFixture;
      const object = [...normalizeGeometryObjects(value.objects).values()][0];
      expect(object).toBeDefined();
      if (name === "rotated-parts") {
        expect(object?.axisAlignedBounds).toEqual(value.expected);
      } else {
        expect(object?.topSurface).toMatchObject(value.expected);
      }
    },
  );

  it.each([
    "non-finite-geometry",
    "decorative-only-target",
    "missing-object-reference",
  ])("rejects the %s fixture", async (name) => {
    const value = await fixture("invalid", name);
    expect(() => {
      const objects = normalizeGeometryObjects(value.objects as unknown[]);
      if (value.transition !== undefined) {
        normalizeTransitionInput(value.transition, objects);
      }
    }).toThrow(
      new RegExp(
        name === "non-finite-geometry"
          ? "validation"
          : String(value.expectedError),
        "i",
      ),
    );
  });
});

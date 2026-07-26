import { describe, expect, it } from "vitest";

import {
  classifyCoarseTransition,
  createDefaultControllerProfile,
  evaluateRoutePlayability,
} from "../src/index.js";
import {
  manifestFixture,
  rehashManifest,
  requiredFixture,
} from "./fixtures.js";

function firstClassificationAt(x: number, y: number, z: number) {
  const manifest = manifestFixture();
  const first = requiredFixture(
    manifest.layers.gameplay.objects.find(
      (object) => object.id === "JumpPlatform01",
    ),
    "first platform",
  );
  first.transform.position = { x, y, z };
  manifest.worldBounds.minimum = { x: -100, y: -100, z: -100 };
  manifest.worldBounds.maximum = { x: 100, y: 100, z: 100 };
  rehashManifest(manifest);
  const result = evaluateRoutePlayability({
    manifest,
    controllerProfile: createDefaultControllerProfile(),
  });
  return requiredFixture(result.transitionStates[0], "first transition state");
}

describe("coarse model-relative transition classification", () => {
  it.each([
    [16, 4, 0],
    [-16, 4, 0],
    [0, 4, 16],
    [0, 4, -16],
    [11.071067811865, 4, 11.071067811865],
  ])("classifies a supported direction (%s, %s, %s)", (x, y, z) => {
    expect(firstClassificationAt(x, y, z).state).toBe("feasible-under-model");
  });

  it("uses inclusive limits and rejects epsilon outside the horizontal limit", () => {
    const profile = createDefaultControllerProfile();
    const base = firstClassificationAt(0, 4, 16).transition;
    expect(
      classifyCoarseTransition(
        {
          ...base,
          horizontalSeparation: {
            ...base.horizontalSeparation,
            value: profile.maximumHorizontalGap.value,
          },
        },
        profile,
      ).state,
    ).toBe("feasible-under-model");
    expect(
      classifyCoarseTransition(
        {
          ...base,
          horizontalSeparation: {
            ...base.horizontalSeparation,
            value:
              profile.maximumHorizontalGap.value +
              profile.tolerancePolicy.comparisonToleranceStuds * 2,
          },
        },
        profile,
      ).state,
    ).toBe("infeasible-under-model");
  });

  it.each([
    ["horizontalSeparation", 7],
    ["verticalRise", 6],
    ["downwardDrop", 21],
  ] as const)(
    "classifies excessive %s relative to the profile",
    (field, value) => {
      const profile = createDefaultControllerProfile();
      const base = firstClassificationAt(0, 4, 16).transition;
      const result = classifyCoarseTransition(
        { ...base, [field]: { ...base[field], value } },
        profile,
      );
      expect(result.state).toBe("infeasible-under-model");
      expect(result.limitations.join(" ")).toContain("model");
      expect(result.limitations.join(" ")).not.toContain("impossible");
    },
  );

  it("returns indeterminate for unsupported curved-to-curved surfaces", () => {
    const profile = createDefaultControllerProfile();
    const base = firstClassificationAt(0, 4, 16).transition;
    const curved = {
      kind: "spherical-surface" as const,
      shape: "Ball" as const,
      center: { x: 0, y: 0, z: 0 },
      radius: 2,
      topPoint: { x: 0, y: 2, z: 0 },
      maximumY: 2,
      approximationKind: "exact-native-primitive" as const,
    };
    expect(
      classifyCoarseTransition(
        { ...base, sourceSurface: curved, destinationSurface: curved },
        profile,
      ).state,
    ).toBe("indeterminate");
  });

  it("classifies a vertical-only supported transition from explicit measurements", () => {
    const profile = createDefaultControllerProfile();
    const base = firstClassificationAt(0, 4, 16).transition;
    expect(
      classifyCoarseTransition(
        {
          ...base,
          horizontalSeparation: { ...base.horizontalSeparation, value: 0 },
          verticalRise: { ...base.verticalRise, value: 2 },
          downwardDrop: { ...base.downwardDrop, value: 0 },
        },
        profile,
      ).state,
    ).toBe("feasible-under-model");
  });

  it("classifies the reference wedge transitions only through supported approximation metadata", () => {
    const result = evaluateRoutePlayability({
      manifest: manifestFixture(),
      controllerProfile: createDefaultControllerProfile(),
    });
    const wedge = result.transitionStates.find(
      (item) =>
        item.transition.sourceSurface.kind === "wedge-surfaces" ||
        item.transition.destinationSurface.kind === "wedge-surfaces",
    );
    expect(["feasible-under-model", "infeasible-under-model"]).toContain(
      wedge?.state,
    );
    expect(wedge?.transition.horizontalSeparation.applicability).toBe(
      "broad-phase-only",
    );
  });
});

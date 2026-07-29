import { computePlaceSpecV03Hash, validatePlaceSpecV03 } from "@obby/contracts";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
} from "@obby/obby-generator";
import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
} from "@obby/obby-layout-engine";
import { describe, expect, it } from "vitest";

import { LayoutProjectionError, projectLayoutBundle } from "../src/index.js";
import { canonical, projectionFor } from "./helpers.js";

describe("deterministic LayoutBundle to PlaceSpec 0.3 projection", () => {
  it.each([20, 21, 50])(
    "projects %i stages within the approved contract",
    (stageCount) => {
      const { placeSpec } = projectionFor({
        stageCount,
        checkpointFrequency: 5,
      });
      expect(placeSpec.stages).toHaveLength(stageCount);
      expect(placeSpec.objects.length).toBeLessThanOrEqual(501);
      expect(validatePlaceSpecV03(placeSpec)).toEqual(
        expect.objectContaining({ ok: true }),
      );
    },
  );

  it("represents zero checkpoints as empty ordered data", () => {
    const { placeSpec } = projectionFor({
      stageCount: 5,
      checkpointFrequency: 5,
    });
    expect(placeSpec.checkpointPlan.checkpointObjectIds).toEqual([]);
    expect(
      placeSpec.objects.some((object) => object.role === "checkpoint"),
    ).toBe(false);
  });

  it("preserves exact G0 and G1 references with deterministic derived IDs", () => {
    const { source, layout, placeSpec } = projectionFor({ stageCount: 5 });
    expect(placeSpec.specId).toBe(
      `place-spec-${layout.layoutSpec.layoutSpecHash.slice(7, 23)}`,
    );
    expect(placeSpec.provenance).toMatchObject({
      generationBundleHash: source.generationBundleHash,
      obbySpecId: source.obbySpec.obbySpecId,
      obbySpecHash: source.obbySpec.obbySpecHash,
      layoutBundleHash: layout.layoutBundleHash,
      layoutSpecId: layout.layoutSpec.layoutSpecId,
      layoutSpecHash: layout.layoutSpec.layoutSpecHash,
    });
    expect(placeSpec.objects.map((object) => object.id)).toEqual(
      layout.layoutSpec.objects.map((object) => object.objectId),
    );
    expect(placeSpec.placeSpecHash).toBe(computePlaceSpecV03Hash(placeSpec));
  });

  it("is byte-identical for the same immutable authorities", () => {
    const first = projectionFor({ stageCount: 20, seed: 90 }).placeSpec;
    const second = projectionFor({ stageCount: 20, seed: 90 }).placeSpec;
    expect(canonical(second)).toBe(canonical(first));
  });

  it("normalizes every native gameplay primitive and binds full transition evidence", () => {
    const { placeSpec } = projectionFor({ stageCount: 5 });
    expect(
      placeSpec.objects.every(
        (object) => object.geometry.methodId === "geometry-evaluator-v0.1",
      ),
    ).toBe(true);
    expect(placeSpec.reachability.requiredTransitions).toHaveLength(
      placeSpec.route.orderedObjectIds.length,
    );
    for (const transition of placeSpec.reachability.requiredTransitions) {
      expect(transition.horizontalSeparation.status).toBe("available");
      expect(transition.verticalRise.status).toBe("available");
      expect(transition.downwardDrop.status).toBe("available");
      expect(transition.landingRegion.status).toBe("available");
      expect(transition.outcome).toBe("feasible-under-model");
    }
  });

  it("never promotes hazards or decorative zones to route endpoints", () => {
    const { placeSpec } = projectionFor({ stageCount: 15, difficulty: "hard" });
    const hazards = new Set(
      placeSpec.objects
        .filter((object) => object.role === "kill")
        .map((object) => object.id),
    );
    expect(placeSpec.route.orderedObjectIds.some((id) => hazards.has(id))).toBe(
      false,
    );
    expect(
      placeSpec.route.orderedObjectIds.some((id) => id.startsWith("zone-")),
    ).toBe(false);
  });

  it("fails closed on stale provenance and authority hashes", () => {
    const { source, layout } = projectionFor({ stageCount: 5 });
    const stale = structuredClone(layout);
    stale.layoutSpec.source.obbySpecHash = `sha256:${"1".repeat(64)}`;
    expect(() =>
      projectLayoutBundle(
        stale,
        source,
        DEFAULT_GENERATOR_CONFIGURATION,
        DEFAULT_MECHANIC_CATALOG,
        DEFAULT_LAYOUT_CONFIGURATION,
        DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
      ),
    ).toThrow(
      expect.objectContaining<Partial<LayoutProjectionError>>({
        code: "stale-provenance",
      }),
    );
  });
});

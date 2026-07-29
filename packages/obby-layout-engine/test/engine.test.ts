import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
} from "@obby/obby-generator";
import { assertValidLayoutBundle } from "@obby/obby-layout-contracts";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  packSerpentineCell,
} from "../src/index.js";
import { canonicalLayout, layoutFor, sourceBundle } from "./helpers.js";

describe("pure deterministic G1b layout engine", () => {
  it("produces byte-identical complete validated LayoutBundles", () => {
    const source = sourceBundle();
    const first = layoutFor(source);
    const second = layoutFor(structuredClone(source));
    expect(canonicalLayout(second)).toBe(canonicalLayout(first));
    expect(() =>
      assertValidLayoutBundle(
        first,
        source,
        DEFAULT_GENERATOR_CONFIGURATION,
        DEFAULT_MECHANIC_CATALOG,
        DEFAULT_LAYOUT_CONFIGURATION,
        DEFAULT_MECHANIC_LAYOUT_DEFINITIONS.filter((definition) =>
          first.layoutSpec.mechanicLayoutDefinitionHashes.includes(
            definition.mechanicLayoutDefinitionHash,
          ),
        ),
      ),
    ).not.toThrow();
  });

  it("expands the G0 route in exact source order and preserves every gameplay source reference", () => {
    const source = sourceBundle({ stageCount: 30, difficulty: "hard" });
    const output = layoutFor(source);
    const sourceRouteStageNodes = source.obbySpec.route.orderedNodeIds
      .map((id) =>
        source.obbySpec.route.nodes.find((node) => node.routeNodeId === id),
      )
      .filter((node) => node?.stageId !== undefined);
    expect(
      output.layoutSpec.stages.map((stage) => stage.sourceRouteNodeId),
    ).toEqual(sourceRouteStageNodes.map((node) => node?.routeNodeId));
    expect(output.layoutSpec.route.orderedObjectIds).toEqual([
      ...output.layoutSpec.stages.flatMap((stage) => stage.routeObjectIds),
      "Finish",
    ]);

    const sourceStageIds = new Set(
      source.obbySpec.stages.map((stage) => stage.stageId),
    );
    const sourceIntentIds = new Set(
      source.obbySpec.mechanicIntents.map((intent) => intent.mechanicIntentId),
    );
    const sourceHazardIds = new Set(
      source.obbySpec.hazards.map((hazard) => hazard.hazardId),
    );
    const sourceCheckpointIds = new Set(
      source.obbySpec.checkpoints.map((checkpoint) => checkpoint.checkpointId),
    );
    const sourceAssetIds = new Set(
      source.obbySpec.assetIntents.map((asset) => asset.assetIntentId),
    );
    const gameplayRouteAssetIds = source.obbySpec.assetIntents
      .filter((asset) => asset.semanticRole === "gameplay-route")
      .map((asset) => asset.assetIntentId);
    const sourceStages = new Map(
      source.obbySpec.stages.map((stage) => [stage.stageId, stage]),
    );
    for (const object of output.layoutSpec.objects) {
      if (object.role === "spawn") {
        expect(object.sourceReferences).toEqual({
          sourceAssetIntentIds: gameplayRouteAssetIds,
        });
        expect(object.transform.rotationDegrees).toEqual({
          x: 0,
          y: -90,
          z: 0,
        });
        continue;
      }
      if (object.role === "finish") {
        expect(object.sourceReferences.sourceFinishId).toBe(
          source.obbySpec.finish.finishId,
        );
      } else {
        expect(
          sourceStageIds.has(object.sourceReferences.sourceStageId ?? ""),
        ).toBe(true);
        expect(
          sourceIntentIds.has(
            object.sourceReferences.sourceMechanicIntentId ?? "",
          ),
        ).toBe(true);
      }
      const sourceStage = sourceStages.get(
        object.sourceReferences.sourceStageId ?? "",
      );
      expect(object.sourceReferences.sourceAssetIntentIds).toEqual(
        sourceStage?.assetIntentIds,
      );
      expect(object.sourceReferences.sourceMechanicIntentId).toBe(
        sourceStage?.mechanicIntentIds[0],
      );
      if (object.role === "kill")
        expect(
          sourceHazardIds.has(object.sourceReferences.sourceHazardId ?? ""),
        ).toBe(true);
      if (object.role === "checkpoint")
        expect(
          sourceCheckpointIds.has(
            object.sourceReferences.sourceCheckpointId ?? "",
          ),
        ).toBe(true);
      expect(
        object.sourceReferences.sourceAssetIntentIds.every((id) =>
          sourceAssetIds.has(id),
        ),
      ).toBe(true);
    }
  });

  it("uses bounded stage-major serpentine cells with deterministic row reversal", () => {
    const cells = Array.from({ length: 10 }, (_, index) =>
      packSerpentineCell(index, 4, 16, 20, 6),
    );
    expect(cells).toEqual([
      { index: 0, row: 0, column: 0, x: 0, z: 0 },
      { index: 1, row: 0, column: 1, x: 16, z: 0 },
      { index: 2, row: 0, column: 2, x: 32, z: 0 },
      { index: 3, row: 0, column: 3, x: 48, z: 0 },
      { index: 4, row: 1, column: 3, x: 48, z: 20 },
      { index: 5, row: 1, column: 2, x: 32, z: 20 },
      { index: 6, row: 1, column: 1, x: 16, z: 20 },
      { index: 7, row: 1, column: 0, x: 0, z: 20 },
      { index: 8, row: 2, column: 0, x: 0, z: 40 },
      { index: 9, row: 2, column: 1, x: 16, z: 40 },
    ]);
  });

  it("emits checkpoints, hazards, finish, decorative zones, findings, and enclosing bounds", () => {
    const source = sourceBundle({ stageCount: 15, checkpointFrequency: 5 });
    const { layoutSpec } = layoutFor(source);
    expect(
      layoutSpec.objects.filter((object) => object.role === "checkpoint"),
    ).toHaveLength(source.obbySpec.checkpoints.length);
    expect(
      layoutSpec.objects.filter((object) => object.role === "kill"),
    ).toHaveLength(source.obbySpec.hazards.length);
    expect(
      layoutSpec.objects.filter((object) => object.role === "finish"),
    ).toHaveLength(1);
    expect(layoutSpec.decorativeZones).toHaveLength(
      source.obbySpec.stages.length,
    );
    expect(layoutSpec.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "model-relative-reachability",
        "native-fallback-selected",
        "route-row-wrapped",
      ]),
    );
    for (const object of layoutSpec.objects)
      for (const axis of ["x", "y", "z"] as const) {
        expect(
          object.transform.position[axis] - object.size[axis] / 2,
        ).toBeGreaterThanOrEqual(layoutSpec.worldBounds.minimum[axis]);
        expect(
          object.transform.position[axis] + object.size[axis] / 2,
        ).toBeLessThanOrEqual(layoutSpec.worldBounds.maximum[axis]);
      }
  });

  it("preserves valid zero-checkpoint semantics", () => {
    const source = sourceBundle({ stageCount: 5, checkpointFrequency: 5 });
    const { layoutSpec } = layoutFor(source);
    expect(source.obbySpec.checkpoints).toEqual([]);
    expect(
      layoutSpec.objects.some((object) => object.role === "checkpoint"),
    ).toBe(false);
    expect(
      layoutSpec.stages.some((stage) => stage.checkpointObjectId !== undefined),
    ).toBe(false);
  });
});

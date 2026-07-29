import { evaluatorCanonicalStringify } from "@obby/canonical-json";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  generateObby,
} from "@obby/obby-generator";
import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_LAYOUT_CONTROLLER_PROFILE,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  generateLayout,
} from "@obby/obby-layout-engine";
import { classifyCoarseTransition } from "@obby/route-playability-evaluator";
import { describe, expect, it } from "vitest";

import {
  buildReachabilityEvidence,
  estimateProjectionWorkUnits,
  normalizeLayoutGeometry,
  projectLayoutBundle,
  type ProjectionWorkAdmission,
} from "../src/index.js";

function inputs() {
  const source = generateObby({
    schemaVersion: "0.1",
    requestId: "g1c-budget-test",
    workingName: "G1c budget test",
    genre: "obby",
    theme: "classic",
    stageCount: 5,
    difficulty: "medium",
    checkpointFrequency: 5,
    assetPolicy: "native-parts-only",
    seed: 12,
  });
  const layout = generateLayout(
    source,
    DEFAULT_GENERATOR_CONFIGURATION,
    DEFAULT_MECHANIC_CATALOG,
    DEFAULT_LAYOUT_CONFIGURATION,
    DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  );
  return { source, layout };
}

function project(
  source: unknown,
  layout: unknown,
  maxWorkUnits?: number,
  onWorkAdmitted?: (admission: ProjectionWorkAdmission) => void,
) {
  return projectLayoutBundle(
    layout,
    source,
    DEFAULT_GENERATOR_CONFIGURATION,
    DEFAULT_MECHANIC_CATALOG,
    DEFAULT_LAYOUT_CONFIGURATION,
    DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
    {
      ...(maxWorkUnits === undefined ? {} : { maxWorkUnits }),
      ...(onWorkAdmitted === undefined ? {} : { onWorkAdmitted }),
    },
  );
}

describe("projection work admission and reachability blocking", () => {
  it("rejects N-1 and emits identical bytes at N and N+1", () => {
    const { source, layout } = inputs();
    const required = estimateProjectionWorkUnits({
      stageCount: layout.layoutSpec.stages.length,
      objectCount: layout.layoutSpec.objects.length,
      routeCount: layout.layoutSpec.route.orderedObjectIds.length,
      zoneCount: layout.layoutSpec.decorativeZones.length,
      definitionCount: DEFAULT_MECHANIC_LAYOUT_DEFINITIONS.length,
    });
    let callbackCalled = false;
    expect(() =>
      project(source, layout, required - 1, () => {
        callbackCalled = true;
      }),
    ).toThrow(expect.objectContaining({ code: "work-limit" }));
    expect(callbackCalled).toBe(false);
    expect(
      evaluatorCanonicalStringify(project(source, layout, required + 1)),
    ).toBe(evaluatorCanonicalStringify(project(source, layout, required)));
  });

  it("uses one immutable snapshot across the admitted callback seam", () => {
    const sourceControl = inputs();
    const source = structuredClone(sourceControl.source);
    const layout = structuredClone(sourceControl.layout);
    const control = project(sourceControl.source, sourceControl.layout);
    let frozen = false;
    const result = project(source, layout, undefined, (admission) => {
      frozen = Object.isFrozen(admission);
      source.obbySpec.stages.splice(1);
      layout.layoutSpec.objects.splice(1);
    });
    expect(frozen).toBe(true);
    expect(evaluatorCanonicalStringify(result)).toBe(
      evaluatorCanonicalStringify(control),
    );
  });

  it.each(["indeterminate", "infeasible-under-model"] as const)(
    "blocks a required transition classified as %s",
    (state) => {
      const { layout } = inputs();
      const geometry = normalizeLayoutGeometry(layout.layoutSpec);
      expect(() =>
        buildReachabilityEvidence(
          layout.layoutSpec,
          geometry,
          DEFAULT_LAYOUT_CONTROLLER_PROFILE,
          (input, profile) => ({
            ...classifyCoarseTransition(input, profile),
            state,
          }),
        ),
      ).toThrow(
        expect.objectContaining({
          code:
            state === "indeterminate"
              ? "reachability-indeterminate"
              : "reachability-infeasible",
        }),
      );
    },
  );
});

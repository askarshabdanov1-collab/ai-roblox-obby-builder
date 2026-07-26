import { describe, expect, it } from "vitest";

import {
  normalizeGeometryObjects,
  normalizeTransitionInput,
  normalizeTransitionInputs,
} from "../src/index.js";
import { assertUniqueTransitionCollection } from "../src/internal/transition-collection.js";

function object(
  objectId: string,
  position: { x: number; y: number; z: number },
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: "0.1",
    objectId,
    shape: "Block",
    authority: "native-gameplay",
    collision: { canCollide: true, canTouch: true, canQuery: true },
    gameplayOwnership: "native-part",
    promotionStatus: "not-applicable",
    transform: {
      position,
      rotationDegrees: { x: 0, y: 0, z: 0 },
    },
    size: { x: 10, y: 2, z: 10 },
    safeRouteRef: {
      routeId: "global-safe-route",
      globalIndex: objectId === "platform-a" ? 0 : 1,
    },
    ...overrides,
  };
}

function transition(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: "0.1",
    transitionId: "route:global-safe-route/platform-a/platform-b/0/1",
    routeId: "global-safe-route",
    fromObjectId: "platform-a",
    toObjectId: "platform-b",
    fromGlobalIndex: 0,
    toGlobalIndex: 1,
    controllerProfileRef: "roblox-default-r15",
    ...overrides,
  };
}

describe("transition input normalization", () => {
  it("computes horizontal gap inputs without classifying feasibility", () => {
    const objects = normalizeGeometryObjects([
      object("platform-a", { x: 0, y: 0, z: 0 }),
      object("platform-b", { x: 14, y: 0, z: 0 }),
    ]);
    const normalized = normalizeTransitionInput(transition(), objects);
    expect(normalized.horizontalSeparation.value).toBe(4);
    expect(normalized.horizontalSeparation.method).toBe(
      "world-aabb-horizontal-separation",
    );
    expect(normalized.horizontalSeparation.approximationKind).toBe(
      "conservative-lower-bound",
    );
    expect(normalized.verticalRise.value).toBe(0);
    expect(normalized.downwardDrop.value).toBe(0);
    expect(normalized).not.toHaveProperty("classification");
    expect(normalized).not.toHaveProperty("feasible");
  });

  it("normalizes vertical rise and downward drop separately", () => {
    const rise = normalizeTransitionInput(
      transition(),
      normalizeGeometryObjects([
        object("platform-a", { x: 0, y: 0, z: 0 }),
        object("platform-b", { x: 10, y: 4, z: 0 }),
      ]),
    );
    expect(rise.verticalRise.value).toBe(4);
    expect(rise.downwardDrop.value).toBe(0);

    const drop = normalizeTransitionInput(
      transition(),
      normalizeGeometryObjects([
        object("platform-a", { x: 0, y: 6, z: 0 }),
        object("platform-b", { x: 10, y: 1, z: 0 }),
      ]),
    );
    expect(drop.verticalRise.value).toBe(0);
    expect(drop.downwardDrop.value).toBe(5);
  });

  it("supports rotated blocks, wedges, and cylinders as normalized inputs", () => {
    const objects = normalizeGeometryObjects([
      object(
        "platform-a",
        { x: 0, y: 0, z: 0 },
        {
          shape: "Wedge",
          transform: {
            position: { x: 0, y: 0, z: 0 },
            rotationDegrees: { x: 0, y: 90, z: 0 },
          },
        },
      ),
      object(
        "platform-b",
        { x: 14, y: 0, z: 0 },
        { shape: "Cylinder", size: { x: 10, y: 4, z: 4 } },
      ),
    ]);
    const normalized = normalizeTransitionInput(transition(), objects);
    expect(normalized.sourceSurface.shape).toBe("Wedge");
    expect(normalized.destinationSurface.shape).toBe("Cylinder");
  });

  it("rejects missing references and decorative-only targets", () => {
    const missing = normalizeGeometryObjects([
      object("platform-a", { x: 0, y: 0, z: 0 }),
    ]);
    expect(() => normalizeTransitionInput(transition(), missing)).toThrow(
      /platform-b/i,
    );

    const decorative = normalizeGeometryObjects([
      object("platform-a", { x: 0, y: 0, z: 0 }),
      object(
        "platform-b",
        { x: 14, y: 0, z: 0 },
        {
          authority: "decorative",
          collision: { canCollide: true, canTouch: true, canQuery: true },
          gameplayOwnership: "none",
          promotionStatus: "not-promoted",
        },
      ),
    ]);
    expect(() => normalizeTransitionInput(transition(), decorative)).toThrow(
      /decorative/i,
    );
  });

  it("normalizes gaps at or below tolerance to zero and preserves larger gaps", () => {
    const a = object("platform-a", { x: 0, y: 0, z: 0 });
    for (const gap of [0.0000000005, 0.000000001]) {
      const normalized = normalizeTransitionInput(
        transition(),
        normalizeGeometryObjects([
          a,
          object("platform-b", { x: 10 + gap, y: 0, z: 0 }),
        ]),
      );
      expect(normalized.horizontalSeparation.value).toBe(0);
      expect(normalized.horizontalSeparation.toleranceStuds).toBe(0.000000001);
      expect(normalized.horizontalSeparation.approximationKind).toBe(
        "conservative-lower-bound",
      );
      expect(normalized.horizontalSeparation.method).toBe(
        "world-aabb-horizontal-separation",
      );
      expect(normalized.horizontalSeparation.applicability).toBe(
        "broad-phase-only",
      );
      expect(normalized.horizontalSeparation.limitations).toEqual([
        "World AABB overlap does not prove native primitive surface contact.",
      ]);
    }
    const larger = normalizeTransitionInput(
      transition(),
      normalizeGeometryObjects([
        a,
        object("platform-b", { x: 10.0000000011, y: 0, z: 0 }),
      ]),
    );
    expect(larger.horizontalSeparation.value).toBe(0.0000000011);
    expect(larger.horizontalSeparation.method).toBe(
      "world-aabb-horizontal-separation",
    );
    expect(larger.horizontalSeparation.approximationKind).toBe(
      "conservative-lower-bound",
    );
    expect(larger.horizontalSeparation.toleranceStuds).toBe(0.000000001);
    expect(larger.horizontalSeparation.applicability).toBe("broad-phase-only");
    expect(larger.horizontalSeparation.limitations).toEqual([
      "World AABB overlap does not prove native primitive surface contact.",
    ]);
  });

  it("rejects invalid route identities and duplicate transition tuples", () => {
    const objects = normalizeGeometryObjects([
      object("platform-a", { x: 0, y: 0, z: 0 }),
      object("platform-b", { x: 14, y: 0, z: 0 }),
    ]);
    expect(() =>
      normalizeTransitionInput(
        transition({
          toObjectId: "platform-a",
          toGlobalIndex: 0,
          transitionId: "route:global-safe-route/platform-a/platform-a/0/0",
        }),
        objects,
      ),
    ).toThrow();
    expect(() =>
      normalizeTransitionInput(
        transition({
          fromGlobalIndex: 1,
          toGlobalIndex: 0,
          transitionId: "route:global-safe-route/platform-a/platform-b/1/0",
        }),
        objects,
      ),
    ).toThrow();
    expect(() =>
      normalizeTransitionInput(
        transition({
          routeId: "other-route",
          transitionId: "route:other-route/platform-a/platform-b/0/1",
        }),
        objects,
      ),
    ).toThrow(/route/i);
    expect(() =>
      normalizeTransitionInputs([transition(), transition()], objects),
    ).toThrow(/duplicate/i);
  });

  it("rejects every safe-route identity mismatch explicitly", () => {
    const a = object("platform-a", { x: 0, y: 0, z: 0 });
    const b = object("platform-b", { x: 14, y: 0, z: 0 });
    const nonAdjacent = normalizeGeometryObjects([
      a,
      object(
        "platform-b",
        { x: 14, y: 0, z: 0 },
        {
          safeRouteRef: { routeId: "global-safe-route", globalIndex: 2 },
        },
      ),
    ]);
    expect(() =>
      normalizeTransitionInput(
        transition({
          fromGlobalIndex: 0,
          toGlobalIndex: 2,
          transitionId: "route:global-safe-route/platform-a/platform-b/0/2",
        }),
        nonAdjacent,
      ),
    ).toThrow(/adjacent forward indexes/i);
    const missingRoute = object("platform-a", { x: 0, y: 0, z: 0 });
    Reflect.deleteProperty(missingRoute, "safeRouteRef");
    expect(() =>
      normalizeTransitionInput(
        transition(),
        normalizeGeometryObjects([missingRoute, b]),
      ),
    ).toThrow(/require safeRouteRef metadata/i);
    expect(() =>
      normalizeTransitionInput(
        transition(),
        normalizeGeometryObjects([
          a,
          object(
            "platform-b",
            { x: 14, y: 0, z: 0 },
            {
              safeRouteRef: { routeId: "global-safe-route", globalIndex: 2 },
            },
          ),
        ]),
      ),
    ).toThrow(/inconsistent with safeRouteRef metadata/i);
    expect(() =>
      normalizeTransitionInput(
        transition(),
        normalizeGeometryObjects([
          a,
          object(
            "platform-b",
            { x: 14, y: 0, z: 0 },
            {
              safeRouteRef: { routeId: "other-route", globalIndex: 1 },
            },
          ),
        ]),
      ),
    ).toThrow(/inconsistent with safeRouteRef metadata/i);
  });

  it("orders shuffled transition collections deterministically", () => {
    const objects = normalizeGeometryObjects([
      object("platform-a", { x: 0, y: 0, z: 0 }),
      object("platform-b", { x: 14, y: 0, z: 0 }),
      object(
        "platform-c",
        { x: 28, y: 0, z: 0 },
        {
          safeRouteRef: { routeId: "global-safe-route", globalIndex: 2 },
        },
      ),
    ]);
    const first = transition();
    const second = transition({
      transitionId: "route:global-safe-route/platform-b/platform-c/1/2",
      fromObjectId: "platform-b",
      toObjectId: "platform-c",
      fromGlobalIndex: 1,
      toGlobalIndex: 2,
    });
    expect(normalizeTransitionInputs([second, first], objects)).toEqual(
      normalizeTransitionInputs([first, second], objects),
    );
  });

  it("selects the same error for shuffled equivalent invalid transitions", () => {
    const objects = normalizeGeometryObjects([
      object("platform-a", { x: 0, y: 0, z: 0 }),
      object("platform-b", { x: 14, y: 0, z: 0 }),
    ]);
    const invalidA = transition({
      routeId: "route-z",
      transitionId: "route:route-z/platform-a/platform-b/0/1",
    });
    const invalidB = transition({
      routeId: "route-a",
      transitionId: "route:route-a/platform-a/platform-b/0/1",
    });
    const message = (values: unknown[]) => {
      try {
        normalizeTransitionInputs(values, objects);
      } catch (caught) {
        return String(caught);
      }
      throw new Error("expected transition failure");
    };
    expect(message([invalidA, invalidB])).toBe(message([invalidB, invalidA]));
  });

  it("distinguishes duplicate transition IDs from duplicate semantic tuples", () => {
    const identity = {
      transitionId: "route:r/a/b/0/1",
      routeId: "r",
      fromObjectId: "a",
      toObjectId: "b",
      fromGlobalIndex: 0,
      toGlobalIndex: 1,
    };
    expect(() =>
      assertUniqueTransitionCollection([identity, identity]),
    ).toThrow(/duplicate transition ID/i);
    expect(() =>
      assertUniqueTransitionCollection([
        identity,
        { ...identity, transitionId: "synthetic-distinct-id" },
      ]),
    ).toThrow(/duplicate transition tuple/i);
  });
});

import { describe, expect, it } from "vitest";

import {
  normalizeGeometryObjects,
  normalizeTransitionInput,
  normalizeTransitionInputs,
} from "../src/index.js";

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

  it("is stable for shuffled object input and touching epsilon boundaries", () => {
    const a = object("platform-a", { x: 0, y: 0, z: 0 });
    const b = object("platform-b", {
      x: 10.000000000000002,
      y: 0,
      z: 0,
    });
    const first = normalizeTransitionInput(
      transition(),
      normalizeGeometryObjects([a, b]),
    );
    const second = normalizeTransitionInput(
      transition(),
      normalizeGeometryObjects([b, a]),
    );
    expect(first).toEqual(second);
    expect(first.horizontalSeparation.value).toBeGreaterThanOrEqual(0);
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
});

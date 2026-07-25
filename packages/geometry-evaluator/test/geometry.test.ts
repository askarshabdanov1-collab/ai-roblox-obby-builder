import { describe, expect, it } from "vitest";

import {
  normalizeGeometryObject,
  normalizeGeometryObjects,
} from "../src/index.js";

function object(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: "0.1",
    objectId: "platform-a",
    shape: "Block",
    authority: "native-gameplay",
    collision: { canCollide: true, canTouch: true, canQuery: true },
    gameplayOwnership: "native-part",
    promotionStatus: "not-applicable",
    transform: {
      position: { x: 0, y: 5, z: 0 },
      rotationDegrees: { x: 0, y: 0, z: 0 },
    },
    size: { x: 10, y: 2, z: 8 },
    ...overrides,
  };
}

describe("deterministic geometry normalization", () => {
  it("normalizes block centers, bounds, top surfaces, and studs", () => {
    const normalized = normalizeGeometryObject(object());
    expect(normalized.center).toEqual({ x: 0, y: 5, z: 0 });
    expect(normalized.axisAlignedBounds).toEqual({
      minimum: { x: -5, y: 4, z: -4 },
      maximum: { x: 5, y: 6, z: 4 },
    });
    expect(normalized.topSurface.maximumY).toBe(6);
    expect(normalized.topSurface.kind).toBe("planar-face");
    if (normalized.topSurface.kind === "planar-face") {
      expect(normalized.topSurface.normal).toEqual({ x: 0, y: 1, z: 0 });
      expect(normalized.topSurface.corners).toHaveLength(4);
      expect(normalized.topSurface.plane.point.y).toBe(6);
    }
    expect(normalized.orientedBounds.halfExtents).toEqual({
      x: 5,
      y: 1,
      z: 4,
    });
    expect(normalized.units).toBe("studs");
    expect(normalized.collisionAuthority).toBe("native-gameplay");
  });

  it.each(["Block", "Ball", "Cylinder", "Wedge"] as const)(
    "normalizes supported %s geometry without a physics verdict",
    (shape) => {
      const normalized = normalizeGeometryObject(
        object({
          shape,
          ...(shape === "Ball"
            ? { size: { x: 4, y: 4, z: 4 } }
            : shape === "Cylinder"
              ? { size: { x: 10, y: 4, z: 4 } }
              : {}),
        }),
      );
      expect(normalized.shape).toBe(shape);
      expect(normalized).not.toHaveProperty("feasibility");
      expect(normalized).not.toHaveProperty("verdict");
    },
  );

  it("normalizes equivalent rotations and rotated bounds deterministically", () => {
    const a = normalizeGeometryObject(
      object({
        transform: {
          position: { x: 0, y: 5, z: 0 },
          rotationDegrees: { x: 0, y: 450, z: 0 },
        },
      }),
    );
    const b = normalizeGeometryObject(
      object({
        transform: {
          position: { x: 0, y: 5, z: 0 },
          rotationDegrees: { x: 0, y: 90, z: 0 },
        },
      }),
    );
    expect(a).toEqual(b);
    expect(a.axisAlignedBounds.maximum.x).toBeCloseTo(4, 12);
    expect(a.axisAlignedBounds.maximum.z).toBeCloseTo(5, 12);
  });

  it.each([
    [
      { x: 90, y: 0, z: 0 },
      { x: 5, y: 4, z: 1 },
    ],
    [
      { x: 0, y: 90, z: 0 },
      { x: 4, y: 1, z: 5 },
    ],
    [
      { x: 0, y: 0, z: 90 },
      { x: 1, y: 5, z: 4 },
    ],
  ])("normalizes rotation around every axis", (rotationDegrees, extents) => {
    const normalized = normalizeGeometryObject(
      object({
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotationDegrees,
        },
      }),
    );
    expect(normalized.axisAlignedBounds.maximum).toEqual(extents);
  });

  it("matches Roblox CFrame XYZ composition for compound rotation", () => {
    const normalized = normalizeGeometryObject(
      object({
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotationDegrees: { x: 30, y: 40, z: 50 },
        },
      }),
    );
    expect(normalized.orientedBounds.rotationMatrix).toEqual([
      [0.492403876506, -0.586824088833, 0.642787609687],
      [0.870001903752, 0.310468460973, -0.383022221559],
      [0.025201386257, 0.747828070819, 0.663413948169],
    ]);
  });

  it("distinguishes decorative geometry from gameplay authority", () => {
    const normalized = normalizeGeometryObject(
      object({
        authority: "decorative",
        collision: { canCollide: true, canTouch: true, canQuery: false },
        gameplayOwnership: "none",
        promotionStatus: "not-promoted",
      }),
    );
    expect(normalized.collisionAuthority).toBe("decorative");
    expect(normalized.gameplayAuthoritative).toBe(false);
    expect(normalized.invariantViolationCandidates).toEqual([
      "decorative-collision-enabled",
      "decorative-touch-enabled",
    ]);
  });

  it("models cylinder X-axis, wedge slope, and ball curvature explicitly", () => {
    const cylinder = normalizeGeometryObject(
      object({ shape: "Cylinder", size: { x: 10, y: 4, z: 4 } }),
    );
    expect(cylinder.topSurface.kind).toBe("cylinder-surfaces");
    if (cylinder.topSurface.kind === "cylinder-surfaces") {
      expect(cylinder.topSurface.axisDirection).toEqual({ x: 1, y: 0, z: 0 });
      expect(cylinder.topSurface.positiveEndcap.center.x).toBe(5);
      expect(cylinder.topSurface.upwardFacingCandidate).toBe("curved-side");
    }

    const wedge = normalizeGeometryObject(object({ shape: "Wedge" }));
    expect(wedge.topSurface.kind).toBe("wedge-surfaces");
    if (wedge.topSurface.kind === "wedge-surfaces") {
      expect(wedge.topSurface.slopedFace.corners).toHaveLength(4);
      expect(wedge.topSurface.slopedFace.normal.y).toBeGreaterThan(0);
    }

    const ball = normalizeGeometryObject(
      object({ shape: "Ball", size: { x: 4, y: 4, z: 4 } }),
    );
    expect(ball.topSurface.kind).toBe("spherical-surface");
    if (ball.topSurface.kind === "spherical-surface") {
      expect(ball.topSurface.radius).toBe(2);
      expect(ball.topSurface.topPoint).toEqual({ x: 0, y: 7, z: 0 });
      expect(ball.topSurface).not.toHaveProperty("corners");
    }
  });

  it("enforces minimum geometry dimensions without positive-to-zero rounding", () => {
    expect(
      normalizeGeometryObject(
        object({ size: { x: 0.000001, y: 0.000001, z: 0.000001 } }),
      ).size.x,
    ).toBe(0.000001);
    for (const invalid of [0.000000999999, 1e-13]) {
      expect(() =>
        normalizeGeometryObject(object({ size: { x: invalid, y: 1, z: 1 } })),
      ).toThrow();
    }
  });

  it("rejects non-finite coordinates, invalid sizes, and duplicate IDs", () => {
    expect(() =>
      normalizeGeometryObject(
        object({
          transform: {
            position: { x: Number.NaN, y: 0, z: 0 },
            rotationDegrees: { x: 0, y: 0, z: 0 },
          },
        }),
      ),
    ).toThrow();
    expect(() =>
      normalizeGeometryObject(object({ size: { x: 0, y: 1, z: 1 } })),
    ).toThrow();
    expect(() => normalizeGeometryObjects([object(), object()])).toThrow(
      /duplicate/i,
    );
    const tooMany = Array.from({ length: 100_001 }, (_, index) =>
      object({ objectId: `platform-${index}` }),
    );
    expect(() => normalizeGeometryObjects(tooMany)).toThrow(/object budget/i);
  });

  it("is translation/reflection stable and does not mutate input", () => {
    const input = object();
    const before = structuredClone(input);
    const base = normalizeGeometryObject(input);
    const translated = normalizeGeometryObject(
      object({
        transform: {
          position: { x: 20, y: 8, z: -11 },
          rotationDegrees: { x: 0, y: 0, z: 0 },
        },
      }),
    );
    const reflected = normalizeGeometryObject(
      object({
        transform: {
          position: { x: 0, y: 5, z: 0 },
          rotationDegrees: { x: 0, y: -90, z: 0 },
        },
      }),
    );
    expect(
      translated.axisAlignedBounds.minimum.x - base.axisAlignedBounds.minimum.x,
    ).toBe(20);
    expect(
      translated.axisAlignedBounds.minimum.y - base.axisAlignedBounds.minimum.y,
    ).toBe(3);
    expect(reflected.axisAlignedBounds.maximum.x).toBeCloseTo(4, 12);
    expect(input).toEqual(before);
  });

  it("is reproducible across a fixed-seed numeric property sample", () => {
    let state = 0x5eeda11;
    const next = (): number => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 0x1_0000_0000;
    };
    for (let index = 0; index < 256; index += 1) {
      const input = object({
        objectId: `platform-${index}`,
        transform: {
          position: {
            x: next() * 2000 - 1000,
            y: next() * 2000 - 1000,
            z: next() * 2000 - 1000,
          },
          rotationDegrees: {
            x: next() * 720 - 360,
            y: next() * 720 - 360,
            z: next() * 720 - 360,
          },
        },
        size: {
          x: 0.000001 + next() * 100,
          y: 0.000001 + next() * 100,
          z: 0.000001 + next() * 100,
        },
      });
      expect(normalizeGeometryObject(input)).toEqual(
        normalizeGeometryObject(structuredClone(input)),
      );
    }
  });
});

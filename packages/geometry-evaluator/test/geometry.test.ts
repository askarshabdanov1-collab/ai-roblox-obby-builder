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
      const normalized = normalizeGeometryObject(object({ shape }));
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

  it("distinguishes decorative geometry from gameplay authority", () => {
    const normalized = normalizeGeometryObject(
      object({ authority: "decorative" }),
    );
    expect(normalized.collisionAuthority).toBe("decorative");
    expect(normalized.gameplayAuthoritative).toBe(false);
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
});

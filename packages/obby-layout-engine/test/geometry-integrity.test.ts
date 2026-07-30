import { evaluatorCanonicalStringify } from "@obby/canonical-json";
import type { LayoutObject } from "@obby/obby-layout-contracts";
import { describe, expect, it } from "vitest";

import { assessLayoutGeometryIntegrity } from "../src/index.js";
import { layoutFor, sourceBundle } from "./helpers.js";

const EPSILON = 1e-6;

function object(
  objectId: string,
  role: LayoutObject["role"],
  position: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number },
  options: Partial<Pick<LayoutObject, "shape" | "transform">> = {},
): LayoutObject {
  return {
    objectId,
    authority: "native-gameplay",
    collision: {
      anchored: true,
      canCollide: role !== "kill",
      canTouch: role === "kill" || role === "checkpoint" || role === "finish",
      canQuery: true,
    },
    role,
    shape: options.shape ?? "Block",
    size,
    sourceReferences: {
      sourceStageId: `stage-${objectId}`,
      sourceMechanicIntentId: `mechanic-${objectId}`,
      sourceAssetIntentIds: ["asset-gameplay-route"],
      ...(role === "kill" ? { sourceHazardId: `hazard-${objectId}` } : {}),
    },
    transform: options.transform ?? {
      position,
      rotationDegrees: { x: 0, y: 0, z: 0 },
    },
  };
}

function scan(objects: readonly LayoutObject[]) {
  return assessLayoutGeometryIntegrity(objects, {
    epsilonStuds: EPSILON,
    firstFailingPipelineBoundary: "LayoutSpec-generation",
    maximumFindings: 256,
  });
}

describe("deterministic layout geometry integrity", () => {
  it.each([20, 21, 50])(
    "accepts the generated %i-stage layout without blocking geometry findings",
    (stageCount) => {
      const output = layoutFor(sourceBundle({ stageCount }));
      const report = scan(output.layoutSpec.objects);
      expect(report.blockingFindingCount).toBe(0);
      expect(report.truncated).toBe(false);
    },
  );

  it("accepts every mechanic recipe in the reference layout", () => {
    const output = layoutFor();
    const report = scan(output.layoutSpec.objects);
    expect(report.blockingFindingCount).toBe(0);
    expect(
      new Set(
        output.layoutSpec.objects.flatMap((candidate) =>
          candidate.sourceReferences.sourceMechanicIntentId === undefined
            ? []
            : [candidate.sourceReferences.sourceMechanicIntentId],
        ),
      ).size,
    ).toBeGreaterThanOrEqual(9);
  });

  it("allows exact edge adjacency and vertical support contact", () => {
    const report = scan([
      object("EdgeA", "platform", { x: 0, y: 1, z: 0 }, { x: 2, y: 2, z: 2 }),
      object("EdgeB", "platform", { x: 2, y: 1, z: 0 }, { x: 2, y: 2, z: 2 }),
      object("Support", "platform", { x: 0, y: 3, z: 0 }, { x: 2, y: 2, z: 2 }),
    ]);
    expect(report.blockingFindingCount).toBe(0);
    expect(report.findings.map((finding) => finding.classification)).toEqual([
      "allowed-edge-adjacency",
      "allowed-support-contact",
    ]);
  });

  it("rejects penetration and coincident visible top surfaces", () => {
    const report = scan([
      object("A", "platform", { x: 0, y: 1, z: 0 }, { x: 4, y: 2, z: 4 }),
      object("B", "platform", { x: 1, y: 1, z: 0 }, { x: 4, y: 2, z: 4 }),
    ]);
    expect(report.blockingFindingCount).toBe(1);
    expect(report.findings[0]?.classification).toBe(
      "coplanar-visible-surface-risk",
    );
    expect(report.findings[0]?.overlapDepth).toEqual({ x: 3, y: 2, z: 4 });
  });

  it("classifies near-coplanar separation below epsilon deterministically", () => {
    const report = scan([
      object("A", "platform", { x: 0, y: 1, z: 0 }, { x: 2, y: 2, z: 2 }),
      object(
        "B",
        "platform",
        { x: 2 + EPSILON / 2, y: 1, z: 0 },
        { x: 2, y: 2, z: 2 },
      ),
    ]);
    expect(report.blockingFindingCount).toBe(1);
    expect(report.findings[0]?.classification).toBe(
      "near-coplanar-below-epsilon",
    );
  });

  it.each(["spawn", "checkpoint", "finish"] as const)(
    "rejects a hazard intersecting the %s landing region",
    (role) => {
      const report = scan([
        object("Landing", role, { x: 0, y: 1, z: 0 }, { x: 6, y: 2, z: 6 }),
        object("Hazard", "kill", { x: 0, y: 0.25, z: 0 }, { x: 2, y: 1, z: 2 }),
      ]);
      expect(report.blockingFindingCount).toBe(1);
      expect(report.findings[0]?.classification).toBe(
        "hazard-landing-penetration",
      );
    },
  );

  it("accepts a hazard below a platform with explicit clearance", () => {
    const report = scan([
      object(
        "Platform",
        "platform",
        { x: 0, y: 2, z: 0 },
        { x: 6, y: 2, z: 6 },
      ),
      object("Hazard", "kill", { x: 0, y: -1, z: 0 }, { x: 6, y: 1, z: 6 }),
    ]);
    expect(report.blockingFindingCount).toBe(0);
    expect(report.findings).toEqual([]);
  });

  it("allows an explicitly authorized mechanic-specific hazard relationship", () => {
    const objects = [
      object(
        "Platform",
        "platform",
        { x: 0, y: 1, z: 0 },
        { x: 6, y: 2, z: 6 },
      ),
      object("Hazard", "kill", { x: 0, y: 1, z: 0 }, { x: 2, y: 2, z: 2 }),
    ];
    const report = assessLayoutGeometryIntegrity(objects, {
      epsilonStuds: EPSILON,
      firstFailingPipelineBoundary: "LayoutSpec-generation",
      maximumFindings: 256,
      authorizedPairKeys: ["Hazard|Platform"],
    });
    expect(report.blockingFindingCount).toBe(0);
    expect(report.findings[0]?.classification).toBe(
      "authorized-hazard-relationship",
    );
  });

  it("rejects a non-adjacent safe-route spatial crossing", () => {
    const objects = [
      object("RouteA", "platform", { x: 0, y: 1, z: 0 }, { x: 4, y: 2, z: 4 }),
      object(
        "RouteMiddle",
        "platform",
        { x: 20, y: 1, z: 0 },
        { x: 4, y: 2, z: 4 },
      ),
      object("RouteC", "platform", { x: 1, y: 1, z: 0 }, { x: 4, y: 2, z: 4 }),
    ];
    const report = assessLayoutGeometryIntegrity(objects, {
      epsilonStuds: EPSILON,
      firstFailingPipelineBoundary: "LayoutSpec-generation",
      maximumFindings: 256,
      orderedRouteObjectIds: ["RouteA", "RouteMiddle", "RouteC"],
    });
    const crossing = report.findings.find(
      (finding) => finding.relationship === "non-adjacent-route-crossing",
    );
    expect(crossing?.blocking).toBe(true);
  });

  it.each(["Wedge", "Cylinder"] as const)(
    "fails closed on an overlapping rotated %s broad-phase pair",
    (shape) => {
      const report = scan([
        object("Block", "platform", { x: 0, y: 1, z: 0 }, { x: 4, y: 2, z: 4 }),
        object(
          "Primitive",
          "platform",
          { x: 0, y: 1, z: 0 },
          { x: 2, y: 2, z: 2 },
          {
            shape,
            transform: {
              position: { x: 0, y: 1, z: 0 },
              rotationDegrees: { x: 0, y: 45, z: 0 },
            },
          },
        ),
      ]);
      expect(report.blockingFindingCount).toBe(1);
      expect(report.findings[0]?.classification).toBe(
        "indeterminate-rotated-shape",
      );
    },
  );

  it("rejects duplicate transforms and orders reports byte-deterministically", () => {
    const objects = [
      object("Z", "platform", { x: 0, y: 1, z: 0 }, { x: 2, y: 2, z: 2 }),
      object("A", "platform", { x: 0, y: 1, z: 0 }, { x: 2, y: 2, z: 2 }),
      object("M", "platform", { x: 0.5, y: 1, z: 0 }, { x: 2, y: 2, z: 2 }),
    ];
    const first = scan(objects);
    const second = scan([...objects].reverse());
    expect(first.blockingFindingCount).toBeGreaterThan(0);
    expect(
      first.findings.some(
        (finding) =>
          finding.classification === "duplicate-or-near-duplicate-transform",
      ),
    ).toBe(true);
    expect(evaluatorCanonicalStringify(second)).toBe(
      evaluatorCanonicalStringify(first),
    );
  });
});

import { compareUnicodeScalars, normalizeNumber } from "@obby/canonical-json";
import {
  normalizeGeometryObjects,
  type AxisAlignedBounds,
} from "@obby/geometry-evaluator";
import type { LayoutObject } from "@obby/obby-layout-contracts";

export type GeometryIntegrityClassification =
  | "allowed-edge-adjacency"
  | "allowed-support-contact"
  | "authorized-hazard-relationship"
  | "invalid-volumetric-penetration"
  | "coplanar-visible-surface-risk"
  | "near-coplanar-below-epsilon"
  | "duplicate-or-near-duplicate-transform"
  | "hazard-landing-penetration"
  | "indeterminate-rotated-shape";

export type GeometryIntegrityFinding = Readonly<{
  objectAId: string;
  objectBId: string;
  stageAId: string | null;
  stageBId: string | null;
  mechanicAId: string | null;
  mechanicBId: string | null;
  roleA: LayoutObject["role"];
  roleB: LayoutObject["role"];
  positionA: LayoutObject["transform"]["position"];
  positionB: LayoutObject["transform"]["position"];
  sizeA: LayoutObject["size"];
  sizeB: LayoutObject["size"];
  rotationA: LayoutObject["transform"]["rotationDegrees"];
  rotationB: LayoutObject["transform"]["rotationDegrees"];
  overlapDepth: Readonly<{ x: number; y: number; z: number }>;
  minimumSeparation: number;
  classification: GeometryIntegrityClassification;
  relationship:
    | "same-stage"
    | "adjacent-safe-route"
    | "non-adjacent-route-crossing"
    | "cross-stage"
    | "authorized-pair";
  blocking: boolean;
  firstFailingPipelineBoundary: string;
}>;

export type GeometryIntegrityReport = Readonly<{
  schemaVersion: "layout-geometry-integrity-v1";
  epsilonStuds: number;
  checkedPairCount: number;
  suspiciousPairCount: number;
  blockingFindingCount: number;
  truncated: boolean;
  findings: readonly GeometryIntegrityFinding[];
}>;

export type GeometryIntegrityOptions = Readonly<{
  epsilonStuds: number;
  firstFailingPipelineBoundary: string;
  maximumFindings: number;
  orderedRouteObjectIds?: readonly string[];
  authorizedPairKeys?: readonly string[];
}>;

type PreparedObject = Readonly<{
  object: LayoutObject;
  bounds: AxisAlignedBounds;
}>;

const REPORT_PRECISION = 9;
const EXACT_CONTACT_EPSILON = 1e-12;
const LANDING_ROLES = new Set<LayoutObject["role"]>([
  "spawn",
  "checkpoint",
  "finish",
  "platform",
]);

function pairKey(left: string, right: string): string {
  return compareUnicodeScalars(left, right) <= 0
    ? `${left}|${right}`
    : `${right}|${left}`;
}

function near(left: number, right: number, epsilon: number): boolean {
  return Math.abs(left - right) <= epsilon;
}

function sameVector(
  left: Readonly<{ x: number; y: number; z: number }>,
  right: Readonly<{ x: number; y: number; z: number }>,
  epsilon: number,
): boolean {
  return (
    near(left.x, right.x, epsilon) &&
    near(left.y, right.y, epsilon) &&
    near(left.z, right.z, epsilon)
  );
}

function cardinalRotation(object: LayoutObject, epsilon: number): boolean {
  if (object.shape !== "Block") return false;
  return [
    object.transform.rotationDegrees.x,
    object.transform.rotationDegrees.y,
    object.transform.rotationDegrees.z,
  ].every((value) => near(value / 90, Math.round(value / 90), epsilon));
}

function normalizedGeometry(
  objects: readonly LayoutObject[],
): PreparedObject[] {
  const ordered = [...objects].sort((left, right) =>
    compareUnicodeScalars(left.objectId, right.objectId),
  );
  const geometry = normalizeGeometryObjects(
    ordered.map((object) => ({
      schemaVersion: "0.1" as const,
      objectId: object.objectId,
      shape: object.shape,
      authority: object.authority,
      collision: {
        canCollide: object.collision.canCollide,
        canTouch: object.collision.canTouch,
        canQuery: object.collision.canQuery,
      },
      gameplayOwnership: "native-part" as const,
      promotionStatus: "not-applicable" as const,
      transform: object.transform,
      size: object.size,
    })),
  );
  return ordered.map((object) => {
    const normalized = geometry.get(object.objectId);
    if (normalized === undefined)
      throw new Error(`missing normalized geometry for ${object.objectId}`);
    return { object, bounds: normalized.axisAlignedBounds };
  });
}

function depth(
  left: AxisAlignedBounds,
  right: AxisAlignedBounds,
): Readonly<{ x: number; y: number; z: number }> {
  return {
    x: normalizeNumber(
      Math.min(left.maximum.x, right.maximum.x) -
        Math.max(left.minimum.x, right.minimum.x),
      REPORT_PRECISION,
    ),
    y: normalizeNumber(
      Math.min(left.maximum.y, right.maximum.y) -
        Math.max(left.minimum.y, right.minimum.y),
      REPORT_PRECISION,
    ),
    z: normalizeNumber(
      Math.min(left.maximum.z, right.maximum.z) -
        Math.max(left.minimum.z, right.minimum.z),
      REPORT_PRECISION,
    ),
  };
}

function relationship(
  left: LayoutObject,
  right: LayoutObject,
  routePositions: ReadonlyMap<string, number>,
  authorized: ReadonlySet<string>,
): GeometryIntegrityFinding["relationship"] {
  if (authorized.has(pairKey(left.objectId, right.objectId)))
    return "authorized-pair";
  const leftRoute = routePositions.get(left.objectId);
  const rightRoute = routePositions.get(right.objectId);
  if (leftRoute !== undefined && rightRoute !== undefined)
    return Math.abs(leftRoute - rightRoute) === 1
      ? "adjacent-safe-route"
      : "non-adjacent-route-crossing";
  return left.sourceReferences.sourceStageId ===
    right.sourceReferences.sourceStageId
    ? "same-stage"
    : "cross-stage";
}

function classification(
  left: PreparedObject,
  right: PreparedObject,
  overlapDepth: Readonly<{ x: number; y: number; z: number }>,
  pairRelationship: GeometryIntegrityFinding["relationship"],
  epsilon: number,
): Readonly<{
  classification: GeometryIntegrityClassification;
  blocking: boolean;
}> | null {
  const values = [overlapDepth.x, overlapDepth.y, overlapDepth.z];
  if (values.some((value) => value < -epsilon)) return null;
  const exactContactAxes = values.filter(
    (value) => Math.abs(value) <= EXACT_CONTACT_EPSILON,
  ).length;
  const nearContactAxes = values.filter(
    (value) => Math.abs(value) <= epsilon,
  ).length;
  const positiveAxes = values.filter((value) => value > epsilon).length;
  if (nearContactAxes > 0) {
    if (nearContactAxes !== 1 || positiveAxes !== 2) return null;
    if (exactContactAxes === 1)
      return {
        classification:
          Math.abs(overlapDepth.y) <= EXACT_CONTACT_EPSILON
            ? "allowed-support-contact"
            : "allowed-edge-adjacency",
        blocking: false,
      };
    return { classification: "near-coplanar-below-epsilon", blocking: true };
  }
  if (positiveAxes !== 3) return null;
  const a = left.object;
  const b = right.object;
  if (
    sameVector(a.transform.position, b.transform.position, epsilon) &&
    sameVector(
      a.transform.rotationDegrees,
      b.transform.rotationDegrees,
      epsilon,
    ) &&
    sameVector(a.size, b.size, epsilon)
  )
    return {
      classification: "duplicate-or-near-duplicate-transform",
      blocking: true,
    };
  if (pairRelationship === "authorized-pair")
    return {
      classification: "authorized-hazard-relationship",
      blocking: false,
    };
  if (!cardinalRotation(a, epsilon) || !cardinalRotation(b, epsilon))
    return { classification: "indeterminate-rotated-shape", blocking: true };
  const hazardLanding =
    (a.role === "kill" && LANDING_ROLES.has(b.role)) ||
    (b.role === "kill" && LANDING_ROLES.has(a.role));
  if (hazardLanding)
    return { classification: "hazard-landing-penetration", blocking: true };
  if (
    near(left.bounds.maximum.y, right.bounds.maximum.y, epsilon) ||
    near(left.bounds.minimum.y, right.bounds.minimum.y, epsilon)
  )
    return { classification: "coplanar-visible-surface-risk", blocking: true };
  return { classification: "invalid-volumetric-penetration", blocking: true };
}

export function assessLayoutGeometryIntegrity(
  objects: readonly LayoutObject[],
  options: GeometryIntegrityOptions,
): GeometryIntegrityReport {
  if (
    !Number.isFinite(options.epsilonStuds) ||
    options.epsilonStuds <= 0 ||
    !Number.isSafeInteger(options.maximumFindings) ||
    options.maximumFindings < 1 ||
    typeof options.firstFailingPipelineBoundary !== "string" ||
    options.firstFailingPipelineBoundary === ""
  )
    throw new Error("geometry integrity options are invalid");
  const prepared = normalizedGeometry(objects);
  const routePositions = new Map(
    (options.orderedRouteObjectIds ?? []).map((objectId, index) => [
      objectId,
      index,
    ]),
  );
  const authorized = new Set(options.authorizedPairKeys ?? []);
  const findings: GeometryIntegrityFinding[] = [];
  let checkedPairCount = 0;
  let suspiciousPairCount = 0;
  let blockingFindingCount = 0;
  for (let leftIndex = 0; leftIndex < prepared.length; leftIndex += 1)
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < prepared.length;
      rightIndex += 1
    ) {
      checkedPairCount += 1;
      const left = prepared[leftIndex];
      const right = prepared[rightIndex];
      if (left === undefined || right === undefined)
        throw new Error("geometry pair preparation is incomplete");
      const overlapDepth = depth(left.bounds, right.bounds);
      const pairRelationship = relationship(
        left.object,
        right.object,
        routePositions,
        authorized,
      );
      const result = classification(
        left,
        right,
        overlapDepth,
        pairRelationship,
        options.epsilonStuds,
      );
      if (result === null) continue;
      suspiciousPairCount += 1;
      if (result.blocking) blockingFindingCount += 1;
      if (findings.length >= options.maximumFindings) continue;
      const minimumSeparation = normalizeNumber(
        Math.max(0, -overlapDepth.x, -overlapDepth.y, -overlapDepth.z),
        REPORT_PRECISION,
      );
      findings.push(
        Object.freeze({
          objectAId: left.object.objectId,
          objectBId: right.object.objectId,
          stageAId: left.object.sourceReferences.sourceStageId ?? null,
          stageBId: right.object.sourceReferences.sourceStageId ?? null,
          mechanicAId:
            left.object.sourceReferences.sourceMechanicIntentId ?? null,
          mechanicBId:
            right.object.sourceReferences.sourceMechanicIntentId ?? null,
          roleA: left.object.role,
          roleB: right.object.role,
          positionA: left.object.transform.position,
          positionB: right.object.transform.position,
          sizeA: left.object.size,
          sizeB: right.object.size,
          rotationA: left.object.transform.rotationDegrees,
          rotationB: right.object.transform.rotationDegrees,
          overlapDepth,
          minimumSeparation,
          classification: result.classification,
          relationship: pairRelationship,
          blocking: result.blocking,
          firstFailingPipelineBoundary: options.firstFailingPipelineBoundary,
        }),
      );
    }
  return Object.freeze({
    schemaVersion: "layout-geometry-integrity-v1",
    epsilonStuds: options.epsilonStuds,
    checkedPairCount,
    suspiciousPairCount,
    blockingFindingCount,
    truncated: suspiciousPairCount > findings.length,
    findings: Object.freeze(findings),
  });
}

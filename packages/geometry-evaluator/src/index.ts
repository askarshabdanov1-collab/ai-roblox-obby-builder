import { normalizeNumber } from "@obby/canonical-json";
import {
  parseGeometryObjectInput,
  parseTransitionInput,
  type GeometryObjectInput,
  type TransitionInput,
  type Vector3,
} from "@obby/obby-evaluator-contracts";

export const GEOMETRY_NUMERIC_POLICY = Object.freeze({
  minimumDimensionStuds: 0.000001,
  coordinatePrecisionDigits: 12,
  anglePrecisionDigits: 12,
  measurementPrecisionDigits: 12,
  measurementToleranceStuds: 0.000000001,
});

export type Matrix3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

export type AxisAlignedBounds = {
  minimum: Vector3;
  maximum: Vector3;
};

export type OrientedBounds = {
  center: Vector3;
  halfExtents: Vector3;
  rotationMatrix: Matrix3;
};

export type Plane = {
  point: Vector3;
  normal: Vector3;
};

export type PlanarFace = {
  kind: "planar-face";
  face: string;
  plane: Plane;
  normal: Vector3;
  corners: readonly [Vector3, Vector3, Vector3, Vector3];
  bounds: AxisAlignedBounds;
  maximumY: number;
  approximationKind: "exact-native-primitive";
};

export type BlockSurfaceDescriptor = PlanarFace & {
  shape: "Block";
  face: "local-positive-y";
};

export type CylinderSurfaceDescriptor = {
  kind: "cylinder-surfaces";
  shape: "Cylinder";
  axisDirection: Vector3;
  radius: number;
  positiveEndcap: {
    kind: "circular-endcap";
    center: Vector3;
    normal: Vector3;
    radius: number;
  };
  negativeEndcap: {
    kind: "circular-endcap";
    center: Vector3;
    normal: Vector3;
    radius: number;
  };
  curvedSide: {
    kind: "cylindrical-curved-side";
    axisStart: Vector3;
    axisEnd: Vector3;
    radius: number;
  };
  upwardFacingCandidate: "positive-endcap" | "negative-endcap" | "curved-side";
  maximumY: number;
  approximationKind: "exact-native-primitive";
};

export type WedgeSurfaceDescriptor = {
  kind: "wedge-surfaces";
  shape: "Wedge";
  slopedFace: PlanarFace & { face: "local-slope-rising-positive-z" };
  nonSlopedFaces: readonly [
    PlanarFace & { face: "local-negative-y" },
    PlanarFace & { face: "local-positive-z" },
  ];
  faceOrientation: "rises-toward-local-positive-z";
  maximumY: number;
  approximationKind: "exact-native-primitive";
};

export type BallSurfaceDescriptor = {
  kind: "spherical-surface";
  shape: "Ball";
  center: Vector3;
  radius: number;
  topPoint: Vector3;
  maximumY: number;
  approximationKind: "exact-native-primitive";
};

export type SurfaceDescriptor =
  | BallSurfaceDescriptor
  | BlockSurfaceDescriptor
  | CylinderSurfaceDescriptor
  | WedgeSurfaceDescriptor;

export type CollisionFacts = {
  canCollide: boolean;
  canTouch: boolean;
  canQuery: boolean;
  authority: GeometryObjectInput["authority"];
  gameplayOwnership: GeometryObjectInput["gameplayOwnership"];
  promotionStatus: GeometryObjectInput["promotionStatus"];
};

export type GeometryInvariantViolationCandidate =
  "decorative-collision-enabled" | "decorative-touch-enabled";

export type NormalizedGeometryObject = {
  schemaVersion: "0.1";
  objectId: string;
  shape: GeometryObjectInput["shape"];
  center: Vector3;
  rotationDegrees: Vector3;
  size: Vector3;
  orientedBounds: OrientedBounds;
  axisAlignedBounds: AxisAlignedBounds;
  topSurface: SurfaceDescriptor;
  units: "studs";
  collisionAuthority: GeometryObjectInput["authority"];
  collision: CollisionFacts;
  invariantViolationCandidates: GeometryInvariantViolationCandidate[];
  gameplayAuthoritative: boolean;
  safeRouteRef?: GeometryObjectInput["safeRouteRef"];
};

export type ConservativeMeasurement = {
  value: number;
  method: "surface-envelope-height-delta" | "world-aabb-horizontal-separation";
  approximationKind: "conservative-bounds-delta" | "conservative-lower-bound";
  toleranceStuds: number;
  limitations: readonly string[];
  applicability: "broad-phase-only";
};

export type NormalizedTransitionInput = {
  schemaVersion: "0.1";
  transitionId: string;
  routeId: string;
  fromObjectId: string;
  toObjectId: string;
  fromGlobalIndex: number;
  toGlobalIndex: number;
  controllerProfileRef: string;
  horizontalSeparation: ConservativeMeasurement;
  verticalRise: ConservativeMeasurement;
  downwardDrop: ConservativeMeasurement;
  sourceSurface: SurfaceDescriptor;
  destinationSurface: SurfaceDescriptor;
  units: "studs";
};

const normalizeCoordinate = (value: number): number =>
  normalizeNumber(value, GEOMETRY_NUMERIC_POLICY.coordinatePrecisionDigits);

const normalizeMeasurement = (value: number): number =>
  Math.abs(value) <= GEOMETRY_NUMERIC_POLICY.measurementToleranceStuds
    ? 0
    : normalizeNumber(
        value,
        GEOMETRY_NUMERIC_POLICY.measurementPrecisionDigits,
      );

function normalizeAngle(value: number): number {
  const angle = ((((value + 180) % 360) + 360) % 360) - 180;
  return normalizeNumber(angle, GEOMETRY_NUMERIC_POLICY.anglePrecisionDigits);
}

function vector(value: Vector3): Vector3 {
  return {
    x: normalizeCoordinate(value.x),
    y: normalizeCoordinate(value.y),
    z: normalizeCoordinate(value.z),
  };
}

function rotationMatrix(rotation: Vector3): Matrix3 {
  const radians = {
    x: (rotation.x * Math.PI) / 180,
    y: (rotation.y * Math.PI) / 180,
    z: (rotation.z * Math.PI) / 180,
  };
  const cx = Math.cos(radians.x);
  const sx = Math.sin(radians.x);
  const cy = Math.cos(radians.y);
  const sy = Math.sin(radians.y);
  const cz = Math.cos(radians.z);
  const sz = Math.sin(radians.z);
  // Roblox CFrame.Angles / CFrame.fromEulerAnglesXYZ composition: Rx * Ry * Rz.
  return [
    [cy * cz, -cy * sz, sy],
    [cx * sz + cz * sx * sy, cx * cz - sx * sy * sz, -cy * sx],
    [sx * sz - cx * cz * sy, cz * sx + cx * sy * sz, cx * cy],
  ];
}

function rotate(local: Vector3, matrix: Matrix3): Vector3 {
  return vector({
    x: matrix[0][0] * local.x + matrix[0][1] * local.y + matrix[0][2] * local.z,
    y: matrix[1][0] * local.x + matrix[1][1] * local.y + matrix[1][2] * local.z,
    z: matrix[2][0] * local.x + matrix[2][1] * local.y + matrix[2][2] * local.z,
  });
}

function transform(local: Vector3, center: Vector3, matrix: Matrix3): Vector3 {
  const rotated = rotate(local, matrix);
  return vector({
    x: center.x + rotated.x,
    y: center.y + rotated.y,
    z: center.z + rotated.z,
  });
}

function negate(value: Vector3): Vector3 {
  return vector({ x: -value.x, y: -value.y, z: -value.z });
}

function normalizeDirection(value: Vector3): Vector3 {
  const length = Math.hypot(value.x, value.y, value.z);
  return vector({
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
  });
}

function boundsOf(points: readonly Vector3[]): AxisAlignedBounds {
  return {
    minimum: vector({
      x: Math.min(...points.map((point) => point.x)),
      y: Math.min(...points.map((point) => point.y)),
      z: Math.min(...points.map((point) => point.z)),
    }),
    maximum: vector({
      x: Math.max(...points.map((point) => point.x)),
      y: Math.max(...points.map((point) => point.y)),
      z: Math.max(...points.map((point) => point.z)),
    }),
  };
}

function planarFace(
  face: string,
  localCorners: readonly [Vector3, Vector3, Vector3, Vector3],
  localNormal: Vector3,
  center: Vector3,
  matrix: Matrix3,
): PlanarFace {
  const corners = localCorners.map((corner) =>
    transform(corner, center, matrix),
  ) as unknown as [Vector3, Vector3, Vector3, Vector3];
  const normal = normalizeDirection(rotate(localNormal, matrix));
  const faceBounds = boundsOf(corners);
  return {
    kind: "planar-face",
    face,
    plane: { point: corners[0], normal },
    normal,
    corners,
    bounds: faceBounds,
    maximumY: faceBounds.maximum.y,
    approximationKind: "exact-native-primitive",
  };
}

function worldHalfExtents(size: Vector3, matrix: Matrix3): Vector3 {
  const half = [size.x / 2, size.y / 2, size.z / 2] as const;
  const extent = (row: readonly [number, number, number]): number =>
    normalizeCoordinate(
      Math.abs(row[0]) * half[0] +
        Math.abs(row[1]) * half[1] +
        Math.abs(row[2]) * half[2],
    );
  return {
    x: extent(matrix[0]),
    y: extent(matrix[1]),
    z: extent(matrix[2]),
  };
}

function surfaces(
  shape: GeometryObjectInput["shape"],
  center: Vector3,
  size: Vector3,
  matrix: Matrix3,
): SurfaceDescriptor {
  const hx = size.x / 2;
  const hy = size.y / 2;
  const hz = size.z / 2;
  if (shape === "Block") {
    return {
      ...planarFace(
        "local-positive-y",
        [
          { x: -hx, y: hy, z: -hz },
          { x: hx, y: hy, z: -hz },
          { x: hx, y: hy, z: hz },
          { x: -hx, y: hy, z: hz },
        ],
        { x: 0, y: 1, z: 0 },
        center,
        matrix,
      ),
      shape,
      face: "local-positive-y",
    };
  }
  if (shape === "Ball") {
    const radius = normalizeCoordinate(hx);
    const topPoint = vector({
      x: center.x,
      y: center.y + radius,
      z: center.z,
    });
    return {
      kind: "spherical-surface",
      shape,
      center,
      radius,
      topPoint,
      maximumY: topPoint.y,
      approximationKind: "exact-native-primitive",
    };
  }
  if (shape === "Cylinder") {
    const axis = normalizeDirection(rotate({ x: 1, y: 0, z: 0 }, matrix));
    const radius = normalizeCoordinate(hy);
    const positiveCenter = transform({ x: hx, y: 0, z: 0 }, center, matrix);
    const negativeCenter = transform({ x: -hx, y: 0, z: 0 }, center, matrix);
    const candidate =
      Math.abs(axis.y) >= 1 - GEOMETRY_NUMERIC_POLICY.measurementToleranceStuds
        ? axis.y >= 0
          ? "positive-endcap"
          : "negative-endcap"
        : "curved-side";
    const maximumY = normalizeCoordinate(
      center.y +
        Math.abs(axis.y) * hx +
        radius * Math.sqrt(Math.max(0, 1 - axis.y * axis.y)),
    );
    return {
      kind: "cylinder-surfaces",
      shape,
      axisDirection: axis,
      radius,
      positiveEndcap: {
        kind: "circular-endcap",
        center: positiveCenter,
        normal: axis,
        radius,
      },
      negativeEndcap: {
        kind: "circular-endcap",
        center: negativeCenter,
        normal: negate(axis),
        radius,
      },
      curvedSide: {
        kind: "cylindrical-curved-side",
        axisStart: negativeCenter,
        axisEnd: positiveCenter,
        radius,
      },
      upwardFacingCandidate: candidate,
      maximumY,
      approximationKind: "exact-native-primitive",
    };
  }

  // Contract convention: the WedgePart slope rises toward local +Z.
  const slope = planarFace(
    "local-slope-rising-positive-z",
    [
      { x: -hx, y: -hy, z: -hz },
      { x: -hx, y: hy, z: hz },
      { x: hx, y: hy, z: hz },
      { x: hx, y: -hy, z: -hz },
    ],
    normalizeDirection({ x: 0, y: hz, z: -hy }),
    center,
    matrix,
  ) as PlanarFace & { face: "local-slope-rising-positive-z" };
  const bottom = planarFace(
    "local-negative-y",
    [
      { x: -hx, y: -hy, z: -hz },
      { x: hx, y: -hy, z: -hz },
      { x: hx, y: -hy, z: hz },
      { x: -hx, y: -hy, z: hz },
    ],
    { x: 0, y: -1, z: 0 },
    center,
    matrix,
  ) as PlanarFace & { face: "local-negative-y" };
  const back = planarFace(
    "local-positive-z",
    [
      { x: -hx, y: -hy, z: hz },
      { x: hx, y: -hy, z: hz },
      { x: hx, y: hy, z: hz },
      { x: -hx, y: hy, z: hz },
    ],
    { x: 0, y: 0, z: 1 },
    center,
    matrix,
  ) as PlanarFace & { face: "local-positive-z" };
  return {
    kind: "wedge-surfaces",
    shape,
    slopedFace: slope,
    nonSlopedFaces: [bottom, back],
    faceOrientation: "rises-toward-local-positive-z",
    maximumY: Math.max(slope.maximumY, bottom.maximumY, back.maximumY),
    approximationKind: "exact-native-primitive",
  };
}

export function normalizeGeometryObject(
  input: unknown,
): NormalizedGeometryObject {
  const value = parseGeometryObjectInput(input);
  const center = vector(value.transform.position);
  const rotationDegrees = {
    x: normalizeAngle(value.transform.rotationDegrees.x),
    y: normalizeAngle(value.transform.rotationDegrees.y),
    z: normalizeAngle(value.transform.rotationDegrees.z),
  };
  const size = vector(value.size);
  const matrix = rotationMatrix(rotationDegrees);
  const extents = worldHalfExtents(size, matrix);
  const axisAlignedBounds = {
    minimum: vector({
      x: center.x - extents.x,
      y: center.y - extents.y,
      z: center.z - extents.z,
    }),
    maximum: vector({
      x: center.x + extents.x,
      y: center.y + extents.y,
      z: center.z + extents.z,
    }),
  };
  const collision = {
    ...value.collision,
    authority: value.authority,
    gameplayOwnership: value.gameplayOwnership,
    promotionStatus: value.promotionStatus,
  };
  const invariantViolationCandidates: GeometryInvariantViolationCandidate[] =
    [];
  if (value.authority === "decorative" && value.collision.canCollide) {
    invariantViolationCandidates.push("decorative-collision-enabled");
  }
  if (value.authority === "decorative" && value.collision.canTouch) {
    invariantViolationCandidates.push("decorative-touch-enabled");
  }
  return {
    schemaVersion: "0.1",
    objectId: value.objectId,
    shape: value.shape,
    center,
    rotationDegrees,
    size,
    orientedBounds: {
      center,
      halfExtents: vector({ x: size.x / 2, y: size.y / 2, z: size.z / 2 }),
      rotationMatrix: [
        matrix[0].map(normalizeCoordinate) as [number, number, number],
        matrix[1].map(normalizeCoordinate) as [number, number, number],
        matrix[2].map(normalizeCoordinate) as [number, number, number],
      ],
    },
    axisAlignedBounds,
    topSurface: surfaces(value.shape, center, size, matrix),
    units: "studs",
    collisionAuthority: value.authority,
    collision,
    invariantViolationCandidates,
    gameplayAuthoritative:
      value.authority === "native-gameplay" &&
      value.gameplayOwnership === "native-part" &&
      value.promotionStatus === "not-applicable",
    ...(value.safeRouteRef === undefined
      ? {}
      : { safeRouteRef: structuredClone(value.safeRouteRef) }),
  };
}

export function normalizeGeometryObjects(
  inputs: readonly unknown[],
): ReadonlyMap<string, NormalizedGeometryObject> {
  if (inputs.length > 100_000) {
    throw new Error("geometry object budget exceeds 100000");
  }
  const normalized = inputs
    .map(normalizeGeometryObject)
    .sort((left, right) => left.objectId.localeCompare(right.objectId));
  const result = new Map<string, NormalizedGeometryObject>();
  for (const object of normalized) {
    if (result.has(object.objectId)) {
      throw new Error(`duplicate geometry object ID: ${object.objectId}`);
    }
    result.set(object.objectId, object);
  }
  return result;
}

function axisGap(
  leftMinimum: number,
  leftMaximum: number,
  rightMinimum: number,
  rightMaximum: number,
): number {
  return normalizeMeasurement(
    Math.max(0, rightMinimum - leftMaximum, leftMinimum - rightMaximum),
  );
}

function measurement(
  value: number,
  method: ConservativeMeasurement["method"],
  approximationKind: ConservativeMeasurement["approximationKind"],
  limitation: string,
): ConservativeMeasurement {
  return {
    value: normalizeMeasurement(value),
    method,
    approximationKind,
    toleranceStuds: GEOMETRY_NUMERIC_POLICY.measurementToleranceStuds,
    limitations: [limitation],
    applicability: "broad-phase-only",
  };
}

export function normalizeTransitionInput(
  input: unknown,
  objects: ReadonlyMap<string, NormalizedGeometryObject>,
): NormalizedTransitionInput {
  const value: TransitionInput = parseTransitionInput(input);
  const source = objects.get(value.fromObjectId);
  if (source === undefined) {
    throw new Error(`transition source ${value.fromObjectId} is missing`);
  }
  const destination = objects.get(value.toObjectId);
  if (destination === undefined) {
    throw new Error(`transition destination ${value.toObjectId} is missing`);
  }
  if (!source.gameplayAuthoritative || !destination.gameplayAuthoritative) {
    throw new Error(
      "decorative or unknown geometry cannot be a gameplay transition endpoint",
    );
  }
  if (
    source.safeRouteRef === undefined ||
    destination.safeRouteRef === undefined
  ) {
    throw new Error("transition endpoints require safeRouteRef metadata");
  }
  if (
    source.safeRouteRef.routeId !== value.routeId ||
    destination.safeRouteRef.routeId !== value.routeId ||
    source.safeRouteRef.globalIndex !== value.fromGlobalIndex ||
    destination.safeRouteRef.globalIndex !== value.toGlobalIndex
  ) {
    throw new Error(
      "transition identity is inconsistent with safeRouteRef metadata",
    );
  }
  if (value.toGlobalIndex !== value.fromGlobalIndex + 1) {
    throw new Error(
      "safe-route transitions must connect adjacent forward indexes",
    );
  }

  const xGap = axisGap(
    source.axisAlignedBounds.minimum.x,
    source.axisAlignedBounds.maximum.x,
    destination.axisAlignedBounds.minimum.x,
    destination.axisAlignedBounds.maximum.x,
  );
  const zGap = axisGap(
    source.axisAlignedBounds.minimum.z,
    source.axisAlignedBounds.maximum.z,
    destination.axisAlignedBounds.minimum.z,
    destination.axisAlignedBounds.maximum.z,
  );
  const surfaceDelta = normalizeMeasurement(
    destination.topSurface.maximumY - source.topSurface.maximumY,
  );
  return {
    schemaVersion: "0.1",
    transitionId: value.transitionId,
    routeId: value.routeId,
    fromObjectId: value.fromObjectId,
    toObjectId: value.toObjectId,
    fromGlobalIndex: value.fromGlobalIndex,
    toGlobalIndex: value.toGlobalIndex,
    controllerProfileRef: value.controllerProfileRef,
    horizontalSeparation: measurement(
      Math.hypot(xGap, zGap),
      "world-aabb-horizontal-separation",
      "conservative-lower-bound",
      "World AABB overlap does not prove native primitive surface contact.",
    ),
    verticalRise: measurement(
      Math.max(0, surfaceDelta),
      "surface-envelope-height-delta",
      "conservative-bounds-delta",
      "Surface envelope maxima are not a character landing or feasibility test.",
    ),
    downwardDrop: measurement(
      Math.max(0, -surfaceDelta),
      "surface-envelope-height-delta",
      "conservative-bounds-delta",
      "Surface envelope maxima are not a character landing or feasibility test.",
    ),
    sourceSurface: source.topSurface,
    destinationSurface: destination.topSurface,
    units: "studs",
  };
}

export function normalizeTransitionInputs(
  inputs: readonly unknown[],
  objects: ReadonlyMap<string, NormalizedGeometryObject>,
): NormalizedTransitionInput[] {
  if (inputs.length > 100_000) {
    throw new Error("transition budget exceeds 100000");
  }
  const normalized = inputs
    .map((input) => normalizeTransitionInput(input, objects))
    .sort(
      (left, right) =>
        left.fromGlobalIndex - right.fromGlobalIndex ||
        left.toGlobalIndex - right.toGlobalIndex ||
        left.transitionId.localeCompare(right.transitionId),
    );
  const ids = new Set<string>();
  const tuples = new Set<string>();
  for (const transition of normalized) {
    if (ids.has(transition.transitionId)) {
      throw new Error(`duplicate transition ID: ${transition.transitionId}`);
    }
    ids.add(transition.transitionId);
    const tuple = [
      transition.routeId,
      transition.fromObjectId,
      transition.toObjectId,
      transition.fromGlobalIndex,
      transition.toGlobalIndex,
    ].join("/");
    if (tuples.has(tuple)) {
      throw new Error(`duplicate transition tuple: ${tuple}`);
    }
    tuples.add(tuple);
  }
  return normalized;
}

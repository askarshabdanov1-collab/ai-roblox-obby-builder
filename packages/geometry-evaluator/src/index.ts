import { normalizeNumber } from "@obby/canonical-json";
import {
  parseGeometryObjectInput,
  parseTransitionInput,
  type GeometryObjectInput,
  type TransitionInput,
  type Vector3,
} from "@obby/obby-evaluator-contracts";

export type AxisAlignedBounds = {
  minimum: Vector3;
  maximum: Vector3;
};

export type OrientedBounds = {
  center: Vector3;
  halfExtents: Vector3;
  rotationMatrix: Matrix3;
};

export type TopSurfaceSummary = {
  shape: GeometryObjectInput["shape"];
  maximumY: number;
  supportKind: "planar" | "curved" | "sloped";
  approximation: "exact-native-primitive" | "conservative-bounds";
};

export type NormalizedGeometryObject = {
  schemaVersion: "0.1";
  objectId: string;
  shape: GeometryObjectInput["shape"];
  center: Vector3;
  rotationDegrees: Vector3;
  size: Vector3;
  orientedBounds: OrientedBounds;
  axisAlignedBounds: AxisAlignedBounds;
  topSurface: TopSurfaceSummary;
  units: "studs";
  collisionAuthority: GeometryObjectInput["authority"];
  gameplayAuthoritative: boolean;
  safeRouteRef?: GeometryObjectInput["safeRouteRef"];
};

export type NormalizedTransitionInput = {
  schemaVersion: "0.1";
  transitionId: string;
  fromObjectId: string;
  toObjectId: string;
  fromGlobalIndex: number;
  toGlobalIndex: number;
  controllerProfileRef: string;
  horizontalGap: number;
  verticalRise: number;
  downwardDrop: number;
  sourceSurface: TopSurfaceSummary;
  destinationSurface: TopSurfaceSummary;
  units: "studs";
};

export type Matrix3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

const normalize = (value: number): number => normalizeNumber(value, 12);

function normalizeAngle(value: number): number {
  const angle = ((((value + 180) % 360) + 360) % 360) - 180;
  return normalize(angle);
}

function normalizedVector(value: Vector3): Vector3 {
  return {
    x: normalize(value.x),
    y: normalize(value.y),
    z: normalize(value.z),
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

function worldHalfExtents(size: Vector3, matrix: Matrix3): Vector3 {
  const half = [size.x / 2, size.y / 2, size.z / 2] as const;
  const extent = (row: readonly [number, number, number]): number =>
    normalize(
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

function topSurface(
  shape: GeometryObjectInput["shape"],
  maximumY: number,
): TopSurfaceSummary {
  if (shape === "Ball") {
    return {
      shape,
      maximumY,
      supportKind: "curved",
      approximation: "conservative-bounds",
    };
  }
  if (shape === "Wedge") {
    return {
      shape,
      maximumY,
      supportKind: "sloped",
      approximation: "conservative-bounds",
    };
  }
  return {
    shape,
    maximumY,
    supportKind: "planar",
    approximation:
      shape === "Block" ? "exact-native-primitive" : "conservative-bounds",
  };
}

export function normalizeGeometryObject(
  input: unknown,
): NormalizedGeometryObject {
  const value = parseGeometryObjectInput(input);
  const center = normalizedVector(value.transform.position);
  const rotationDegrees = {
    x: normalizeAngle(value.transform.rotationDegrees.x),
    y: normalizeAngle(value.transform.rotationDegrees.y),
    z: normalizeAngle(value.transform.rotationDegrees.z),
  };
  const size = normalizedVector(value.size);
  const matrix = rotationMatrix(rotationDegrees);
  const extents = worldHalfExtents(size, matrix);
  const minimum = {
    x: normalize(center.x - extents.x),
    y: normalize(center.y - extents.y),
    z: normalize(center.z - extents.z),
  };
  const maximum = {
    x: normalize(center.x + extents.x),
    y: normalize(center.y + extents.y),
    z: normalize(center.z + extents.z),
  };
  return {
    schemaVersion: "0.1",
    objectId: value.objectId,
    shape: value.shape,
    center,
    rotationDegrees,
    size,
    orientedBounds: {
      center,
      halfExtents: {
        x: normalize(size.x / 2),
        y: normalize(size.y / 2),
        z: normalize(size.z / 2),
      },
      rotationMatrix: [
        matrix[0].map(normalize) as [number, number, number],
        matrix[1].map(normalize) as [number, number, number],
        matrix[2].map(normalize) as [number, number, number],
      ],
    },
    axisAlignedBounds: { minimum, maximum },
    topSurface: topSurface(value.shape, maximum.y),
    units: "studs",
    collisionAuthority: value.authority,
    gameplayAuthoritative: value.authority === "native-gameplay",
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
    .sort((left, right) =>
      left.objectId < right.objectId
        ? -1
        : left.objectId > right.objectId
          ? 1
          : 0,
    );
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
  return normalize(
    Math.max(0, rightMinimum - leftMaximum, leftMinimum - rightMaximum),
  );
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
      "decorative geometry cannot be a gameplay transition endpoint",
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
  const surfaceDelta = normalize(
    destination.topSurface.maximumY - source.topSurface.maximumY,
  );

  return {
    schemaVersion: "0.1",
    transitionId: value.transitionId,
    fromObjectId: value.fromObjectId,
    toObjectId: value.toObjectId,
    fromGlobalIndex: value.fromGlobalIndex,
    toGlobalIndex: value.toGlobalIndex,
    controllerProfileRef: value.controllerProfileRef,
    horizontalGap: normalize(Math.hypot(xGap, zGap)),
    verticalRise: normalize(Math.max(0, surfaceDelta)),
    downwardDrop: normalize(Math.max(0, -surfaceDelta)),
    sourceSurface: source.topSurface,
    destinationSurface: destination.topSurface,
    units: "studs",
  };
}

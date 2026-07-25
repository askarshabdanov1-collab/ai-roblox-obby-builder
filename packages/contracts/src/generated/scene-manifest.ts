/* Generated from the matching JSON Schema. Do not edit. */

export type KebabId = string;
export type Sha256 = string;
export type BoundedNumber = number;
export type PascalId = string;
export type HexColor = string;

export interface SceneManifest {
  schemaVersion: "0.2";
  generatorVersion: string;
  sceneId: KebabId;
  sourceSpecId: KebabId;
  sourceSpecHash: Sha256;
  seed: number;
  manifestHash: Sha256;
  coordinateSystem: {
    units: "studs";
    handedness: "right-handed";
    upAxis: "+Y";
    forwardAxis: "-Z";
    rotationUnit: "degrees";
    rotationOrder: "XYZ";
  };
  worldBounds: {
    minimum: Vector3;
    maximum: Vector3;
  };
  navigation: {
    coarseReachability: CoarseReachability;
    characterPlacement: CharacterPlacement;
    /**
     * @minItems 1
     * @maxItems 20
     */
    stages: [NavigationStage, ...NavigationStage[]];
    /**
     * @minItems 1
     * @maxItems 500
     */
    safeRouteObjectIds: [PascalId, ...PascalId[]];
    /**
     * @minItems 1
     * @maxItems 500
     */
    routeEntries: [RouteEntry, ...RouteEntry[]];
  };
  layers: {
    gameplay: {
      /**
       * @minItems 3
       * @maxItems 501
       */
      objects: [GameplayObject, GameplayObject, GameplayObject, ...GameplayObject[]];
    };
    decorative: {
      /**
       * @maxItems 1000
       */
      objects: DecorativeObject[];
    };
  };
}
export interface Vector3 {
  x: BoundedNumber;
  y: BoundedNumber;
  z: BoundedNumber;
}
export interface CoarseReachability {
  model: "axis-aligned-surfaces-v1";
  avatarRig: "R15-default";
  walkSpeed: number;
  jumpPower: number;
  maxHorizontalGap: number;
  maxVerticalRise: number;
  maxDownwardDrop: number;
}
export interface CharacterPlacement {
  strategy: "humanoid-root-part-cframe-v1";
  orientationPolicy: "face-next-safe-route-object" | "explicit-yaw";
  verticalOffset: number;
}
export interface NavigationStage {
  id: KebabId;
  order: number;
  /**
   * @minItems 1
   * @maxItems 500
   */
  safeRouteObjectIds: [PascalId, ...PascalId[]];
}
export interface RouteEntry {
  objectId: PascalId;
  routeOrder: number;
  stageId: KebabId;
  stageRouteOrder: number;
}
export interface GameplayObject {
  id: PascalId;
  order: number;
  role: "spawn" | "platform" | "checkpoint" | "kill" | "finish";
  className: "Part" | "SpawnLocation" | "WedgePart";
  shape: "Block" | "Ball" | "Cylinder" | "Wedge";
  transform: Transform;
  size: PositiveSize;
  color: HexColor;
  colorRole: "primary" | "secondary" | "reward" | "hazard";
  material: "SmoothPlastic" | "Plastic" | "Metal" | "Neon" | "Concrete" | "Wood";
  physics: Physics;
  behavior: GameplayBehavior;
}
export interface Transform {
  position: Vector3;
  rotation: Rotation3;
}
export interface Rotation3 {
  x: number;
  y: number;
  z: number;
}
export interface PositiveSize {
  x: number;
  y: number;
  z: number;
}
export interface Physics {
  anchored: true;
  canCollide: boolean;
  canTouch: boolean;
  canQuery: boolean;
}
export interface GameplayBehavior {
  kind: "spawn" | "platform" | "checkpoint" | "kill" | "finish";
  checkpointOrder?: number;
  killMode?: "set-health-zero";
}
export interface DecorativeObject {
  id: PascalId;
  order: number;
  role: "decoration";
  className: "Part" | "WedgePart";
  shape: "Block" | "Ball" | "Cylinder" | "Wedge";
  transform: Transform;
  size: PositiveSize;
  color: HexColor;
  material: "SmoothPlastic" | "Plastic" | "Metal" | "Neon" | "Concrete" | "Wood";
  physics: {
    anchored: true;
    canCollide: false;
    canTouch: false;
    canQuery: boolean;
  };
  behavior: {
    kind: "decoration";
  };
}

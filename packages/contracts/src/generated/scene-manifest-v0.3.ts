/* Generated from the matching JSON Schema. Do not edit. */

export type Id = string;
export type Hash = string;
export type SourceId = string;
export type BoundedNumber = number;
export type PascalId = string;
export type HexColor = string;
export type GameplayBehavior =
  | {
      kind: "none";
    }
  | {
      kind: "checkpoint";
      checkpointOrder: number;
    }
  | {
      kind: "kill";
      killMode: "touch";
    }
  | {
      kind: "finish";
    };

export interface SceneManifestV03 {
  schemaVersion: "0.3";
  generatorVersion: "0.3.0";
  projectionVersion: "g1c-layout-projection-v1";
  sceneId: Id;
  sourceSpecId: Id;
  sourcePlaceSpecHash: Hash;
  seed: number;
  seedIdentity: Hash;
  manifestHash: Hash;
  provenance: Provenance;
  coordinateSystem: CoordinateSystem;
  worldBounds: Bounds;
  navigation: Navigation;
  layers: {
    gameplay: {
      /**
       * @minItems 7
       * @maxItems 501
       */
      objects: [
        GameplayObject,
        GameplayObject,
        GameplayObject,
        GameplayObject,
        GameplayObject,
        GameplayObject,
        GameplayObject,
        ...GameplayObject[]
      ];
    };
    decorative: {
      /**
       * @maxItems 256
       */
      objects: DecorativeObject[];
    };
  };
  /**
   * @minItems 5
   * @maxItems 128
   */
  decorativeZones: [
    DecorativeZone,
    DecorativeZone,
    DecorativeZone,
    DecorativeZone,
    DecorativeZone,
    ...DecorativeZone[]
  ];
  /**
   * @maxItems 64
   */
  limitations: MessageRecord[];
  /**
   * @maxItems 64
   */
  findings: MessageRecord[];
}
export interface Provenance {
  generationBundleHash: Hash;
  obbySpecId: SourceId;
  obbySpecHash: Hash;
  generatorConfigurationHash: Hash;
  mechanicCatalogHash: Hash;
  layoutBundleHash: Hash;
  layoutSpecId: Id;
  layoutSpecHash: Hash;
  layoutConfigurationHash: Hash;
  /**
   * @minItems 1
   * @maxItems 64
   */
  mechanicLayoutDefinitionHashes: [Hash, ...Hash[]];
}
export interface CoordinateSystem {
  units: "studs";
  handedness: "right-handed";
  upAxis: "+Y";
  forwardAxis: "-Z";
  rotationUnit: "degrees";
  rotationOrder: "XYZ";
}
export interface Bounds {
  minimum: Vector3;
  maximum: Vector3;
}
export interface Vector3 {
  x: BoundedNumber;
  y: BoundedNumber;
  z: BoundedNumber;
}
export interface Navigation {
  routeId: Id;
  sourceRouteId: Id;
  characterPlacement: CharacterPlacement;
  spawnObjectId: "Spawn";
  finishObjectId: "Finish";
  /**
   * @minItems 0
   * @maxItems 49
   */
  checkpointObjectIds: PascalId[];
  /**
   * @minItems 6
   * @maxItems 500
   */
  safeRouteObjectIds: [PascalId, PascalId, PascalId, PascalId, PascalId, PascalId, ...PascalId[]];
  /**
   * @minItems 6
   * @maxItems 500
   */
  routeEntries: [RouteEntry, RouteEntry, RouteEntry, RouteEntry, RouteEntry, RouteEntry, ...RouteEntry[]];
  /**
   * @minItems 5
   * @maxItems 50
   */
  stages: [NavigationStage, NavigationStage, NavigationStage, NavigationStage, NavigationStage, ...NavigationStage[]];
  reachability: Reachability;
}
export interface CharacterPlacement {
  strategy: "humanoid-root-part-cframe-v1";
  orientationPolicy: "face-next-safe-route-object" | "explicit-yaw";
  verticalOffset: number;
}
export interface RouteEntry {
  globalOrder: number;
  objectId: PascalId;
  stageId: Id;
  stageOrder: number;
}
export interface NavigationStage {
  stageId: Id;
  sourceStageId: SourceId;
  order: number;
  /**
   * @minItems 1
   * @maxItems 501
   */
  safeRouteObjectIds: [PascalId, ...PascalId[]];
  checkpointObjectId?: PascalId;
}
export interface Reachability {
  modelId: "e1-coarse-surface-transition-v1";
  methodId: "coarse-transition-classifier";
  methodVersion: "2.0.0";
  controllerProfileRef: {
    profileId: SourceId;
    profileVersion: string;
    controllerProfileHash: Hash;
  };
  overallOutcome: "feasible-under-model";
  /**
   * @minItems 6
   * @maxItems 500
   */
  requiredTransitions: [
    TransitionEvidence,
    TransitionEvidence,
    TransitionEvidence,
    TransitionEvidence,
    TransitionEvidence,
    TransitionEvidence,
    ...TransitionEvidence[]
  ];
}
export interface TransitionEvidence {
  transitionId: Id;
  fromObjectId: PascalId;
  toObjectId: PascalId;
  fromGlobalOrder: number;
  toGlobalOrder: number;
  outcome: "feasible-under-model";
  normalizedInputHash: Hash;
  horizontalSeparation: Measurement;
  verticalRise: Measurement;
  downwardDrop: Measurement;
  landingRegion: LandingRegion;
  sourceSurfaceKind: string;
  destinationSurfaceKind: string;
  /**
   * @minItems 1
   * @maxItems 64
   */
  limitations: [string, ...string[]];
}
export interface Measurement {
  status: "available";
  value: number;
  method: "surface-envelope-height-delta" | "world-aabb-horizontal-separation";
  approximationKind: "conservative-bounds-delta" | "conservative-lower-bound";
  toleranceStuds: number;
  /**
   * @maxItems 32
   */
  limitations: string[];
  applicability: "broad-phase-only";
}
export interface LandingRegion {
  status: "available";
  method: "exact-planar-intrinsic-edge-spans-v1";
  approximationKind: "exact-native-primitive";
  spanAStuds: number;
  spanBStuds: number;
  toleranceStuds: number;
  /**
   * @maxItems 32
   */
  limitations: string[];
}
export interface GameplayObject {
  id: PascalId;
  order: number;
  sourceReferences: SourceReferences;
  role: "spawn" | "platform" | "checkpoint" | "kill" | "finish";
  authority: "native-gameplay";
  className: "Part";
  shape: "Block" | "Ball" | "Cylinder" | "Wedge";
  transform: Transform;
  size: PositiveSize;
  collision: Collision;
  appearance: Appearance;
  geometry: GeometrySummary;
  behavior: GameplayBehavior;
}
export interface SourceReferences {
  sourceStageId?: SourceId;
  sourceMechanicIntentId?: SourceId;
  sourceCheckpointId?: SourceId;
  sourceHazardId?: SourceId;
  sourceFinishId?: SourceId;
  /**
   * @maxItems 128
   */
  sourceAssetIntentIds: SourceId[];
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
export interface Collision {
  anchored: true;
  canCollide: boolean;
  canTouch: boolean;
  canQuery: true;
}
export interface Appearance {
  color: HexColor;
  colorRole: "primary" | "secondary" | "reward" | "hazard";
  material: "SmoothPlastic" | "Neon";
}
export interface GeometrySummary {
  methodId: "geometry-evaluator-v0.1";
  normalizedGeometryHash: Hash;
  axisAlignedBounds: Bounds;
  topSurfaceMaximumY: BoundedNumber;
  surfaceKind: "planar-face" | "wedge-slope" | "curved-surface" | "circular-endcap";
}
export interface DecorativeObject {
  id: PascalId;
  zoneId: Id;
  className: "Part";
  shape: "Block" | "Ball" | "Cylinder" | "Wedge";
  transform: Transform;
  size: PositiveSize;
  collision: {
    anchored: true;
    canCollide: false;
    canTouch: false;
    canQuery: false;
  };
  appearance: Appearance;
}
export interface DecorativeZone {
  zoneId: Id;
  sourceStageId: SourceId;
  sourceVisualStyleIntentId: SourceId;
  /**
   * @minItems 1
   * @maxItems 128
   */
  sourceAssetIntentIds: [SourceId, ...SourceId[]];
  bounds: Bounds;
  collisionPolicy: "non-colliding-only";
  nativePartFallback: true;
}
export interface MessageRecord {
  code: Id;
  severity: "information" | "warning";
  message: string;
  /**
   * @maxItems 128
   */
  relatedSourceIds: SourceId[];
}

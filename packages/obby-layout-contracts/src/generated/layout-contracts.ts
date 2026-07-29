/* Generated from layout-contracts.schema.json. Do not edit. */

export type G1LayoutContracts =
  LayoutConfiguration | MechanicLayoutDefinition | LayoutSpec | LayoutBundle;
export type Id = string;
export type Hash = `sha256:${string}`;
export type PascalId = string;

export interface LayoutConfiguration {
  schemaVersion: "0.1";
  configurationId: Id;
  configurationVersion: "g1a-layout-contract-v1";
  layoutAlgorithm: {
    algorithmId: "g1-layout-v1";
    routePackingStrategy: "bounded-serpentine-grid-v1";
    routePackingVersion: "1";
    derivedIdStrategy: "source-ordinal-pascal-v1";
  };
  numericPolicy: {
    units: "studs";
    coordinatePrecisionDecimalPlaces: 6;
    measurementToleranceStuds: number;
  };
  /**
   * @minItems 6
   * @maxItems 64
   */
  numericParameters: [
    NumericParameter,
    NumericParameter,
    NumericParameter,
    NumericParameter,
    NumericParameter,
    NumericParameter,
    ...NumericParameter[],
  ];
  reachabilityPolicy: {
    requiredTransitionOutcome: "feasible-under-model";
    indeterminatePolicy: "block";
    controllerProfileRef: {
      profileId: Id;
      profileVersion: string;
      controllerProfileHash: Hash;
    };
  };
  limits: {
    maxStages: 50;
    maxGameplayObjects: 501;
    maxDecorativeZones: 128;
    maxWorldExtent: 2048;
    maxPartSize: 256;
    maxOutputBytes: 4194304;
    maxWorkUnits: number;
  };
  configurationHash: Hash;
}
export interface NumericParameter {
  parameterId: Id;
  unit: "studs" | "degrees" | "count" | "ratio";
  minimum: number;
  maximum: number;
  value: number;
}
export interface MechanicLayoutDefinition {
  schemaVersion: "0.1";
  mechanicLayoutDefinitionId: Id;
  definitionVersion: string;
  sourceMechanic: {
    mechanicId: Id;
    mechanicVersion: "1";
    mechanicDefinitionHash: Hash;
  };
  capability: "g1-static-supported";
  layoutAlgorithmId: "g1-layout-v1";
  routeObjectBudget: {
    minimum: number;
    maximum: number;
  };
  /**
   * @minItems 1
   * @maxItems 4
   */
  supportedShapes: [
    "Block" | "Ball" | "Cylinder" | "Wedge",
    ...("Block" | "Ball" | "Cylinder" | "Wedge")[],
  ];
  /**
   * @minItems 1
   * @maxItems 5
   */
  difficultyProfiles: [
    DifficultyParameterProfile,
    ...DifficultyParameterProfile[],
  ];
  mechanicLayoutDefinitionHash: Hash;
}
export interface DifficultyParameterProfile {
  difficultyLevel: number;
  /**
   * @minItems 1
   * @maxItems 32
   */
  parameters: [NumericParameter, ...NumericParameter[]];
}
export interface LayoutSpec {
  schemaVersion: "0.1";
  layoutSpecId: Id;
  layoutVersion: "g1-layout-v1";
  source: {
    generationBundleHash: Hash;
    obbySpecId: Id;
    obbySpecHash: Hash;
    generatorConfigurationHash: Hash;
    mechanicCatalogHash: Hash;
  };
  layoutConfigurationHash: Hash;
  /**
   * @minItems 1
   * @maxItems 64
   */
  mechanicLayoutDefinitionHashes: [Hash, ...Hash[]];
  layoutSeedIdentity: Hash;
  coordinateSystem: {
    units: "studs";
    handedness: "right-handed";
    upAxis: "+Y";
    forwardAxis: "-Z";
    rotationUnit: "degrees";
    rotationOrder: "XYZ";
  };
  characterPlacement: {
    strategy: "humanoid-root-part-cframe-v1";
    orientationPolicy: "face-next-safe-route-object" | "explicit-yaw";
    verticalOffset: number;
  };
  worldBounds: {
    minimum: Vector3;
    maximum: Vector3;
  };
  /**
   * @minItems 5
   * @maxItems 50
   */
  stages: [
    LayoutStage,
    LayoutStage,
    LayoutStage,
    LayoutStage,
    LayoutStage,
    ...LayoutStage[],
  ];
  route: {
    routeLayoutId: Id;
    sourceRouteId: Id;
    /**
     * @minItems 6
     * @maxItems 500
     */
    orderedObjectIds: [
      PascalId,
      PascalId,
      PascalId,
      PascalId,
      PascalId,
      PascalId,
      ...PascalId[],
    ];
  };
  reachability: ReachabilityAssessment;
  /**
   * @minItems 7
   * @maxItems 501
   */
  objects: [
    LayoutObject,
    LayoutObject,
    LayoutObject,
    LayoutObject,
    LayoutObject,
    LayoutObject,
    LayoutObject,
    ...LayoutObject[],
  ];
  /**
   * @maxItems 128
   */
  decorativeZones: DecorativeZone[];
  /**
   * @maxItems 64
   */
  limitations: LayoutLimitation[];
  /**
   * @maxItems 64
   */
  findings: LayoutFinding[];
  layoutSpecHash: Hash;
}
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}
export interface LayoutStage {
  stageLayoutId: Id;
  sourceStageId: Id;
  sourceRouteNodeId: Id;
  ordinal: number;
  sourceMechanicIntentId: Id;
  mechanicLayoutDefinitionHash: Hash;
  /**
   * @minItems 1
   * @maxItems 20
   */
  routeObjectIds: [PascalId, ...PascalId[]];
  checkpointObjectId?: PascalId;
  /**
   * @maxItems 20
   */
  hazardObjectIds: PascalId[];
  /**
   * @maxItems 128
   */
  decorativeZoneIds: Id[];
}
export interface ReachabilityAssessment {
  modelId: "e1-coarse-surface-transition-v1";
  methodId: "coarse-transition-classifier";
  methodVersion: "2.0.0";
  controllerProfileRef: {
    profileId: Id;
    profileVersion: string;
    controllerProfileHash: Hash;
  };
  overallOutcome: "feasible-under-model";
  /**
   * @minItems 6
   * @maxItems 500
   */
  requiredTransitions: [
    ReachabilityTransition,
    ReachabilityTransition,
    ReachabilityTransition,
    ReachabilityTransition,
    ReachabilityTransition,
    ReachabilityTransition,
    ...ReachabilityTransition[],
  ];
}
export interface ReachabilityTransition {
  transitionLayoutId: Id;
  fromObjectId: PascalId;
  toObjectId: PascalId;
  fromGlobalOrder: number;
  toGlobalOrder: number;
  outcome: "feasible-under-model";
  normalizedInputHash: Hash;
}
export interface LayoutObject {
  objectId: PascalId;
  sourceReferences: SourceReferences;
  role: "spawn" | "platform" | "checkpoint" | "kill" | "finish";
  authority: "native-gameplay";
  shape: "Block" | "Ball" | "Cylinder" | "Wedge";
  transform: Transform;
  size: PositiveSize;
  collision: {
    anchored: true;
    canCollide: boolean;
    canTouch: boolean;
    canQuery: true;
  };
  routePlacement?: {
    globalOrder: number;
    stageOrder: number;
  };
}
export interface SourceReferences {
  sourceStageId?: Id;
  sourceMechanicIntentId?: Id;
  sourceCheckpointId?: Id;
  sourceHazardId?: Id;
  sourceFinishId?: Id;
  /**
   * @maxItems 128
   */
  sourceAssetIntentIds: Id[];
}
export interface Transform {
  position: Vector3;
  rotationDegrees: Rotation3;
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
export interface DecorativeZone {
  zoneId: Id;
  sourceStageId?: Id;
  sourceVisualStyleIntentId: Id;
  /**
   * @minItems 1
   * @maxItems 128
   */
  sourceAssetIntentIds: [Id, ...Id[]];
  bounds: {
    minimum: Vector3;
    maximum: Vector3;
  };
  collisionPolicy: "non-colliding-only";
  nativePartFallback: true;
}
export interface LayoutLimitation {
  code:
    | "contract-only"
    | "unsupported-mechanic"
    | "reachability-indeterminate"
    | "world-packing-limit";
  message: string;
  /**
   * @maxItems 64
   */
  relatedSourceIds: Id[];
}
export interface LayoutFinding {
  code:
    | "native-fallback-selected"
    | "route-row-wrapped"
    | "model-relative-reachability";
  severity: "information" | "warning";
  message: string;
  /**
   * @maxItems 64
   */
  relatedSourceIds: Id[];
}
export interface LayoutBundle {
  schemaVersion: "0.1";
  layoutBundleId: Id;
  sourceGenerationBundleHash: Hash;
  layoutConfigurationRef: {
    configurationId: Id;
    configurationVersion: "g1a-layout-contract-v1";
    configurationHash: Hash;
  };
  /**
   * @minItems 1
   * @maxItems 64
   */
  mechanicLayoutDefinitionRefs: [
    {
      mechanicLayoutDefinitionId: Id;
      definitionVersion: string;
      mechanicLayoutDefinitionHash: Hash;
    },
    ...{
      mechanicLayoutDefinitionId: Id;
      definitionVersion: string;
      mechanicLayoutDefinitionHash: Hash;
    }[],
  ];
  layoutSpec: LayoutSpec;
  layoutBundleHash: Hash;
}

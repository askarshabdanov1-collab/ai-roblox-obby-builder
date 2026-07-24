/* Generated from the matching JSON Schema. Do not edit. */

export type KebabId = string;
export type BoundedNumber = number;
export type RotationNumber = number;
export type PascalId = string;
export type HexColor = string;

export interface PlaceSpec {
  schemaVersion: "0.2";
  specId: KebabId;
  seed: number;
  name: string;
  genre: "obby";
  provenance: {
    source: "user-description" | "repository-fixture";
    description: string;
    createdBy: "human" | "codex";
    containsSecrets: false;
  };
  movement: {
    walkSpeed: number;
    jumpPower: number;
    maxHorizontalGap: number;
    maxVerticalRise: number;
  };
  spawn: {
    transform: Transform;
    size: PositiveSize;
  };
  /**
   * @minItems 1
   * @maxItems 20
   */
  stages: [
    {
      id: KebabId;
      order: number;
      name: string;
      difficulty: number;
      /**
       * @minItems 1
       * @maxItems 500
       */
      routeObstacleIds: [PascalId, ...PascalId[]];
    },
    ...{
      id: KebabId;
      order: number;
      name: string;
      difficulty: number;
      /**
       * @minItems 1
       * @maxItems 500
       */
      routeObstacleIds: [PascalId, ...PascalId[]];
    }[]
  ];
  /**
   * @minItems 2
   * @maxItems 500
   */
  obstacles: [
    {
      id: PascalId;
      order: number;
      stageId: KebabId;
      role: "platform" | "checkpoint" | "kill" | "finish";
      shape: "Block" | "Ball" | "Cylinder" | "Wedge";
      transform: Transform;
      size: PositiveSize;
      colorSlot: "primary" | "secondary" | "reward" | "hazard";
      material: "SmoothPlastic" | "Plastic" | "Metal" | "Neon" | "Concrete" | "Wood";
    },
    {
      id: PascalId;
      order: number;
      stageId: KebabId;
      role: "platform" | "checkpoint" | "kill" | "finish";
      shape: "Block" | "Ball" | "Cylinder" | "Wedge";
      transform: Transform;
      size: PositiveSize;
      colorSlot: "primary" | "secondary" | "reward" | "hazard";
      material: "SmoothPlastic" | "Plastic" | "Metal" | "Neon" | "Concrete" | "Wood";
    },
    ...{
      id: PascalId;
      order: number;
      stageId: KebabId;
      role: "platform" | "checkpoint" | "kill" | "finish";
      shape: "Block" | "Ball" | "Cylinder" | "Wedge";
      transform: Transform;
      size: PositiveSize;
      colorSlot: "primary" | "secondary" | "reward" | "hazard";
      material: "SmoothPlastic" | "Plastic" | "Metal" | "Neon" | "Concrete" | "Wood";
    }[]
  ];
  checkpointPlan: {
    mode: "ordered";
    /**
     * @minItems 1
     * @maxItems 100
     */
    checkpointObstacleIds: [PascalId, ...PascalId[]];
  };
  finishCriteria: {
    type: "touch-finish";
    finishObstacleId: PascalId;
  };
  difficultyProgression: {
    start: number;
    end: number;
    curve: "flat" | "linear" | "stepped";
  };
  budgets: {
    maxStages: number;
    maxGameplayObjects: number;
    maxDecorativeObjects: number;
    maxWorldExtent: number;
    maxPartSize: number;
  };
  visualBrief: {
    summary: string;
    /**
     * @minItems 2
     * @maxItems 4
     */
    primaryColors: [HexColor, HexColor, ...HexColor[]];
    rewardColor: HexColor;
    hazardColor: HexColor;
    shapeLanguage: string;
    /**
     * @minItems 1
     * @maxItems 6
     */
    materials: [
      "SmoothPlastic" | "Plastic" | "Metal" | "Neon" | "Concrete" | "Wood",
      ...("SmoothPlastic" | "Plastic" | "Metal" | "Neon" | "Concrete" | "Wood")[]
    ];
  };
}
export interface Transform {
  position: Vector3;
  rotation: Rotation3;
}
export interface Vector3 {
  x: BoundedNumber;
  y: BoundedNumber;
  z: BoundedNumber;
}
export interface Rotation3 {
  x: RotationNumber;
  y: RotationNumber;
  z: RotationNumber;
}
export interface PositiveSize {
  x: number;
  y: number;
  z: number;
}

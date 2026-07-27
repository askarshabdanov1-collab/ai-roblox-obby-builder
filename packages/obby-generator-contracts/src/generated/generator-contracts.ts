/* Generated from generator-contracts.schema.json. Do not edit. */

export type GeneratorContract =
  | GenerationRequest
  | NormalizedGenerationRequest
  | GeneratorConfiguration
  | MechanicDefinition
  | MechanicCatalog
  | StageSpec
  | RouteNodeSpec
  | RouteTransitionSpec
  | RouteSpec
  | CheckpointSpec
  | HazardSpec
  | FinishSpec
  | DifficultyBand
  | DifficultyPlan
  | MechanicIntent
  | VisualStyleIntent
  | AssetIntent
  | ProgressionIntent
  | RetentionIntent
  | GenerationLimitation
  | GenerationFinding
  | ObbySpec
  | GenerationBundle;
export type Id = string;
export type Hash = `sha256:${string}`;
/**
 * @maxItems 64
 */
export type StringSet = string[];

export interface GenerationRequest {
  schemaVersion: "0.1";
  requestId: Id;
  generationRequestHash?: Hash;
  workingName: string;
  genre: "obby";
  theme?: "classic" | "sky" | "space" | "lava" | "jungle";
  targetAudience?: "all-ages" | "general" | "experienced";
  targetSessionDurationMinutes?: number;
  stageCount?: number;
  difficulty?: "easy" | "medium" | "hard";
  checkpointFrequency?: number;
  supportedMechanicPreferences?: StringSet;
  excludedMechanics?: StringSet;
  /**
   * @maxItems 16
   */
  visualStylePreferences?: (
    "animated-decor" | "bright" | "high-readability" | "minimal" | "saturated"
  )[];
  assetPolicy?:
    | "native-parts-only"
    | "approved-local-assets"
    | "external-assets-allowed-later";
  /**
   * @maxItems 16
   */
  accessibilityConstraints?: (
    | "color-independent-cues"
    | "high-readability"
    | "reduced-motion"
    | "motion-required"
  )[];
  seed: number;
  brief?: string;
}
export interface NormalizedGenerationRequest {
  schemaVersion: "0.1";
  normalizedRequestId: Id;
  generationRequestHash: Hash;
  workingName: string;
  genre: "obby";
  theme: "classic" | "sky" | "space" | "lava" | "jungle";
  targetAudience: "all-ages" | "general" | "experienced";
  targetSessionDurationMinutes: number;
  stageCount: number;
  difficulty: "easy" | "medium" | "hard";
  checkpointFrequency: number;
  supportedMechanicPreferences: StringSet;
  excludedMechanics: StringSet;
  /**
   * @maxItems 16
   */
  visualStylePreferences: (
    "animated-decor" | "bright" | "high-readability" | "minimal" | "saturated"
  )[];
  assetPolicy:
    | "native-parts-only"
    | "approved-local-assets"
    | "external-assets-allowed-later";
  /**
   * @maxItems 16
   */
  accessibilityConstraints: (
    | "color-independent-cues"
    | "high-readability"
    | "reduced-motion"
    | "motion-required"
  )[];
  seed: number;
  brief?: string;
  normalizedRequestHash: Hash;
}
export interface GeneratorConfiguration {
  schemaVersion: "0.1";
  configurationId: Id;
  generatorVersion: "g0-reference-v1";
  prngAlgorithm: "mulberry32-v1";
  allowDeferredMechanics: boolean;
  difficultyDeltaLimit: number;
  limits: GeneratorLimits;
  configurationHash: Hash;
}
export interface GeneratorLimits {
  maxRequestBytes: 65536;
  maxConfigurationBytes: 65536;
  maxCatalogBytes: 524288;
  maxStageCount: 50;
  maxRouteNodes: 52;
  maxTransitions: 51;
  maxCheckpoints: 49;
  maxHazards: 50;
  maxMechanicDefinitions: 64;
  maxFindings: 64;
  maxLimitations: 64;
  maxAssetIntents: 128;
  maxOutputBytes: 4194304;
  maxOutputPathLength: 240;
  maxWorkUnits: 25000;
}
export interface MechanicDefinition {
  schemaVersion: "0.1";
  mechanicId: Id;
  mechanicVersion: "1";
  label: string;
  capability: "g1-static-supported" | "future-runtime-supported" | "deferred";
  minimumDifficulty: number;
  maximumDifficulty: number;
  requiredCapabilities: StringSet;
  forbiddenAdjacentMechanicIds: StringSet;
  accessibilityImplications: StringSet;
  repetitionLimit: number;
  selectionWeight: number;
  mechanicDefinitionHash: Hash;
}
export interface MechanicCatalog {
  schemaVersion: "0.1";
  catalogId: Id;
  catalogVersion: "g0-v1";
  /**
   * @maxItems 64
   */
  mechanics: MechanicDefinition[];
  catalogHash: Hash;
}
export interface StageSpec {
  schemaVersion: "0.1";
  stageId: Id;
  ordinal: number;
  role:
    | "onboarding"
    | "practice"
    | "escalation"
    | "variation"
    | "challenge"
    | "recovery"
    | "climax"
    | "finish-approach";
  mechanicIntentIds: StringSet;
  difficultyBandId: Id;
  estimatedCompletionSeconds: {
    minimum: number;
    maximum: number;
  };
  failureReset: "stage-start" | "last-checkpoint";
  hazardIds: StringSet;
  checkpointId?: Id;
  assetIntentIds: StringSet;
  visualStyleIntentId: Id;
  stageHash: Hash;
}
export interface RouteNodeSpec {
  schemaVersion: "0.1";
  routeNodeId: Id;
  kind: "start" | "stage" | "checkpoint" | "finish";
  stageId?: Id;
  required: true;
  routeNodeHash: Hash;
}
export interface RouteTransitionSpec {
  schemaVersion: "0.1";
  routeTransitionId: Id;
  fromNodeId: Id;
  toNodeId: Id;
  intent: "required-safe-progression";
  required: true;
  routeTransitionHash: Hash;
}
export interface RouteSpec {
  schemaVersion: "0.1";
  routeId: Id;
  startNodeId: Id;
  finishNodeId: Id;
  /**
   * @maxItems 52
   */
  orderedNodeIds: Id[];
  /**
   * @maxItems 52
   */
  nodes: RouteNodeSpec[];
  /**
   * @maxItems 51
   */
  transitions: RouteTransitionSpec[];
  routeHash: Hash;
}
export interface CheckpointSpec {
  schemaVersion: "0.1";
  checkpointId: Id;
  stageId: Id;
  routeNodeId: Id;
  routeOrder: number;
  respawnIntent: "center-safe-platform";
  checkpointHash: Hash;
}
export interface HazardSpec {
  schemaVersion: "0.1";
  hazardId: Id;
  kind:
    | "kill-floor"
    | "kill-part"
    | "fall-void"
    | "timed-contact-intent"
    | "moving-obstacle-intent";
  stageId: Id;
  mechanicId: Id;
  gameplayAuthority: "native-gameplay";
  failureReset: "last-checkpoint";
  severity: "low" | "medium" | "high";
  visualStyleIntentId: Id;
  hazardHash: Hash;
}
export interface FinishSpec {
  schemaVersion: "0.1";
  finishId: Id;
  routeNodeId: Id;
  afterStageId: Id;
  readability: "high";
  finishHash: Hash;
}
export interface DifficultyBand {
  schemaVersion: "0.1";
  difficultyBandId: Id;
  stageId: Id;
  ordinal: number;
  band: "tutorial" | "easy" | "medium" | "hard" | "climax" | "recovery";
  intentLevel: number;
  difficultyBandHash: Hash;
}
export interface DifficultyPlan {
  schemaVersion: "0.1";
  difficultyPlanId: Id;
  targetDifficulty: "easy" | "medium" | "hard";
  maximumLocalDelta: number;
  empiricalStatus: "design-intent-not-validated";
  /**
   * @maxItems 50
   */
  bands: DifficultyBand[];
  difficultyPlanHash: Hash;
}
export interface MechanicIntent {
  schemaVersion: "0.1";
  mechanicIntentId: Id;
  stageId: Id;
  mechanicId: Id;
  use: "introduce" | "practice" | "intensify" | "combine";
  mechanicIntentHash: Hash;
}
export interface VisualStyleIntent {
  schemaVersion: "0.1";
  visualStyleIntentId: Id;
  themeFamily: "classic" | "sky" | "space" | "lava" | "jungle";
  paletteIntent: string;
  materialFamily: "native-roblox-materials";
  lightingMoodIntent: "bright" | "dramatic" | "calm";
  shapeLanguage: "blocky-readable";
  density: "low" | "medium" | "high";
  readabilityPriority: "high";
  landmarkCadenceStages: number;
  decorativeMotionIntent: "none" | "deferred";
  uiTone: "clear-encouraging";
  styleTags: StringSet;
  visualStyleIntentHash: Hash;
}
export interface AssetIntent {
  schemaVersion: "0.1";
  assetIntentId: Id;
  semanticRole:
    "gameplay-route" | "checkpoint" | "hazard" | "finish" | "decoration";
  scope: "global" | "stage";
  stageId?: Id;
  authority: "gameplay-authoritative" | "decorative";
  preferredSourcePolicy:
    | "native-parts-only"
    | "approved-local-assets"
    | "external-assets-allowed-later";
  nativePartFallback: true;
  collisionPolicy: "native-parts-colliding" | "non-colliding";
  scaleIntent: "readable-player-scale";
  styleTags: StringSet;
  prohibitedContentTags: StringSet;
  requiredAuditStatus: "not-required-native" | "required-before-use";
  assetIntentHash: Hash;
}
export interface ProgressionIntent {
  schemaVersion: "0.1";
  progressionIntentId: Id;
  onboardingClarity: "high";
  earlySuccess: "prioritized";
  visibleProgress: "stage-and-checkpoint";
  finishReadability: "high";
  progressionIntentHash: Hash;
}
export interface RetentionIntent {
  schemaVersion: "0.1";
  retentionIntentId: Id;
  status: "design-intent-not-prediction";
  checkpointCadence: number;
  mechanicNoveltyCadence: number;
  recoveryPacing: "after-peaks";
  landmarkCadence: number;
  climaxTiming: "late";
  replayVariationAllowance: "seeded-only";
  retentionIntentHash: Hash;
}
export interface GenerationLimitation {
  schemaVersion: "0.1";
  limitationId: Id;
  code:
    | "abstract-plan-only"
    | "no-runtime-evidence"
    | "retention-not-predicted"
    | "deferred-mechanic";
  message: string;
  relatedIds: StringSet;
  limitationHash: Hash;
}
export interface GenerationFinding {
  schemaVersion: "0.1";
  findingId: Id;
  code: "limited-mechanic-variety" | "deferred-capability-planned";
  severity: "information" | "warning";
  message: string;
  relatedIds: StringSet;
  findingHash: Hash;
}
export interface ObbySpec {
  schemaVersion: "0.1";
  obbySpecId: Id;
  normalizedRequestHash: Hash;
  configurationHash: Hash;
  catalogHash: Hash;
  generatorVersion: "g0-reference-v1";
  prngAlgorithm: "mulberry32-v1";
  seed: number;
  seedIdentity: Hash;
  game: {
    title: string;
    genre: "obby";
    targetAudience: "all-ages" | "general" | "experienced";
    targetSessionDurationMinutes: number;
  };
  /**
   * @maxItems 50
   */
  stages: StageSpec[];
  /**
   * @maxItems 50
   */
  mechanicIntents: MechanicIntent[];
  route: RouteSpec;
  /**
   * @maxItems 49
   */
  checkpoints: CheckpointSpec[];
  /**
   * @maxItems 50
   */
  hazards: HazardSpec[];
  finish: FinishSpec;
  difficultyPlan: DifficultyPlan;
  /**
   * @maxItems 16
   */
  visualStyleIntents: VisualStyleIntent[];
  /**
   * @maxItems 128
   */
  assetIntents: AssetIntent[];
  progressionIntent: ProgressionIntent;
  retentionIntent: RetentionIntent;
  /**
   * @maxItems 64
   */
  limitations: GenerationLimitation[];
  /**
   * @maxItems 64
   */
  findings: GenerationFinding[];
  obbySpecHash: Hash;
}
export interface GenerationBundle {
  schemaVersion: "0.1";
  generationBundleId: Id;
  generationRequestHash: Hash;
  normalizedRequest: NormalizedGenerationRequest;
  configurationHash: Hash;
  catalogHash: Hash;
  obbySpec: ObbySpec;
  limitations: GenerationLimitation[];
  findings: GenerationFinding[];
  generationBundleHash: Hash;
}

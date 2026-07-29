export type { PlaceSpec } from "./generated/place-spec.js";
export type {
  DecorativeObject,
  GameplayBehavior,
  GameplayObject,
  Physics,
  SceneManifest,
} from "./generated/scene-manifest.js";
export {
  assertValidPlaceSpec,
  assertValidSceneManifest,
  computeManifestHash,
  ContractValidationError,
  MANIFEST_HASH_PLACEHOLDER,
  placeSpecSchema,
  sceneManifestSchema,
  semanticPlaceSpecIssues,
  semanticSceneManifestIssues,
  validatePlaceSpec,
  validateSceneManifest,
} from "./validation.js";
export type { ContractIssue, ValidationResult } from "./validation.js";
export type {
  PlaceSpecV03,
  GameplayObject as PlaceSpecV03GameplayObject,
  Reachability as PlaceSpecV03Reachability,
  TransitionEvidence as PlaceSpecV03TransitionEvidence,
} from "./generated/place-spec-v0.3.js";
export type {
  SceneManifestV03,
  GameplayBehavior as GameplayBehaviorV03,
  GameplayObject as SceneManifestV03GameplayObject,
} from "./generated/scene-manifest-v0.3.js";
export {
  assertValidPlaceSpecV03,
  assertValidSceneManifestV03,
  computePlaceSpecV03Hash,
  computeSceneManifestV03Hash,
  PLACE_SPEC_V03_HASH_PLACEHOLDER,
  placeSpecV03Preimage,
  placeSpecV03Schema,
  SCENE_MANIFEST_V03_HASH_PLACEHOLDER,
  sceneManifestV03Preimage,
  sceneManifestV03Schema,
  semanticPlaceSpecV03Issues,
  semanticSceneManifestV03Issues,
  validatePlaceSpecV03,
  validateSceneManifestV03,
} from "./validation-v0.3.js";
export type {
  PlaceSpecV03Preimage,
  SceneManifestV03Preimage,
} from "./validation-v0.3.js";

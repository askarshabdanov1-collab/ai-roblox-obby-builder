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

import { sha256, snapshotEvaluatorInput } from "@obby/canonical-json";
import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";

import placeSpecV03Schema from "../schemas/place-spec-v0.3.schema.json" with { type: "json" };
import sceneManifestV03Schema from "../schemas/scene-manifest-v0.3.schema.json" with { type: "json" };
import type { PlaceSpecV03 } from "./generated/place-spec-v0.3.js";
import type { SceneManifestV03 } from "./generated/scene-manifest-v0.3.js";
import {
  ContractValidationError,
  type ContractIssue,
  type ValidationResult,
} from "./validation.js";

export const PLACE_SPEC_V03_HASH_PLACEHOLDER = `sha256:${"0".repeat(64)}`;
export const SCENE_MANIFEST_V03_HASH_PLACEHOLDER = `sha256:${"0".repeat(64)}`;

const ajv = new Ajv2020({
  allErrors: true,
  allowUnionTypes: false,
  strict: true,
  strictNumbers: true,
  validateFormats: false,
});
const placeValidator = ajv.compile<PlaceSpecV03>(placeSpecV03Schema);
const manifestValidator = ajv.compile<SceneManifestV03>(sceneManifestV03Schema);

function structuralIssues(
  errors: ErrorObject[] | null | undefined,
): ContractIssue[] {
  return (errors ?? []).map((error) => ({
    kind: "structural",
    code: error.keyword,
    path: error.instancePath || "/",
    message: error.message ?? "schema validation failed",
  }));
}

function semantic(code: string, path: string, message: string): ContractIssue {
  return { kind: "semantic", code, path, message };
}

function snapshot(input: unknown): unknown {
  return snapshotEvaluatorInput(input, {
    maxArrayLength: 4_096,
    maxCanonicalBytes: 4 * 1024 * 1024,
    maxDepth: 64,
    maxObjectProperties: 4_096,
    maxTotalNodes: 100_000,
  });
}

function validateStructure<T>(
  validator: ValidateFunction<T>,
  input: unknown,
): ValidationResult<T> {
  let value: unknown;
  try {
    value = snapshot(input);
  } catch {
    return {
      ok: false,
      issues: [
        semantic(
          "snapshot",
          "/",
          "input must be bounded immutable-compatible plain data",
        ),
      ],
    };
  }
  if (validator(value)) return { ok: true, value, issues: [] };
  return { ok: false, issues: structuralIssues(validator.errors) };
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function contiguous(values: readonly number[], start: number): boolean {
  return values.every((value, index) => value === start + index);
}

export type PlaceSpecV03Preimage = Omit<PlaceSpecV03, "placeSpecHash">;
export type SceneManifestV03Preimage = Omit<SceneManifestV03, "manifestHash">;

export function placeSpecV03Preimage(
  value: PlaceSpecV03 | PlaceSpecV03Preimage,
): PlaceSpecV03Preimage {
  const { placeSpecHash: _excluded, ...preimage } = value as PlaceSpecV03;
  return preimage;
}

export function sceneManifestV03Preimage(
  value: SceneManifestV03 | SceneManifestV03Preimage,
): SceneManifestV03Preimage {
  const { manifestHash: _excluded, ...preimage } = value as SceneManifestV03;
  return preimage;
}

export function computePlaceSpecV03Hash(
  value: PlaceSpecV03 | PlaceSpecV03Preimage,
): `sha256:${string}` {
  return sha256({
    domain: "g1c-place-spec-v0.3",
    preimage: placeSpecV03Preimage(value),
  });
}

export function computeSceneManifestV03Hash(
  value: SceneManifestV03 | SceneManifestV03Preimage,
): `sha256:${string}` {
  return sha256({
    domain: "g1c-scene-manifest-v0.3",
    preimage: sceneManifestV03Preimage(value),
  });
}

export function semanticPlaceSpecV03Issues(
  spec: PlaceSpecV03,
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const objects = new Map(spec.objects.map((object) => [object.id, object]));
  const objectIds = spec.objects.map((object) => object.id);
  if (!unique(objectIds))
    issues.push(
      semantic("duplicate-id", "/objects", "object IDs must be unique"),
    );
  if (
    !contiguous(
      spec.objects.map((object) => object.order),
      0,
    )
  )
    issues.push(
      semantic(
        "order",
        "/objects",
        "object order must be contiguous from zero",
      ),
    );

  const spawn = spec.objects.filter((object) => object.role === "spawn");
  const finish = spec.objects.filter((object) => object.role === "finish");
  if (spawn.length !== 1 || spawn[0]?.id !== "Spawn" || spawn[0].order !== 0)
    issues.push(
      semantic("spawn", "/objects", "Spawn must be the sole order-zero spawn"),
    );
  if (finish.length !== 1 || finish[0]?.id !== "Finish")
    issues.push(
      semantic("finish", "/objects", "Finish must be the sole finish"),
    );

  const routeIds = spec.route.orderedObjectIds;
  if (!unique(routeIds))
    issues.push(
      semantic("route", "/route/orderedObjectIds", "route IDs must be unique"),
    );
  for (const [index, id] of routeIds.entries()) {
    const object = objects.get(id);
    if (!object)
      issues.push(
        semantic(
          "reference",
          `/route/orderedObjectIds/${index}`,
          "route object does not exist",
        ),
      );
    else if (object.role === "spawn" || object.role === "kill")
      issues.push(
        semantic(
          "route-role",
          `/route/orderedObjectIds/${index}`,
          "spawn and hazards cannot be route endpoints",
        ),
      );
  }
  if (routeIds.at(-1) !== "Finish")
    issues.push(
      semantic(
        "finish-order",
        "/route/orderedObjectIds",
        "Finish must be the final route object",
      ),
    );

  const routedGameplay = spec.objects
    .filter(
      (object) =>
        object.role === "platform" ||
        object.role === "checkpoint" ||
        object.role === "finish",
    )
    .map((object) => object.id);
  if (
    routeIds.length !== routedGameplay.length ||
    routeIds.some((id, index) => id !== routedGameplay[index])
  )
    issues.push(
      semantic(
        "route-order",
        "/route/orderedObjectIds",
        "route must exactly follow gameplay object order",
      ),
    );

  const checkpoints = spec.objects
    .filter((object) => object.role === "checkpoint")
    .map((object) => object.id);
  if (
    checkpoints.length !== spec.checkpointPlan.checkpointObjectIds.length ||
    checkpoints.some(
      (id, index) => id !== spec.checkpointPlan.checkpointObjectIds[index],
    )
  )
    issues.push(
      semantic(
        "checkpoint-order",
        "/checkpointPlan/checkpointObjectIds",
        "checkpoint plan must exactly follow object order",
      ),
    );

  const stageRoute = spec.stages.flatMap((stage) => stage.routeObjectIds);
  if (
    stageRoute.length + 1 !== routeIds.length ||
    stageRoute.some((id, index) => id !== routeIds[index])
  )
    issues.push(
      semantic(
        "stage-route",
        "/stages",
        "stage routes must concatenate to the global route before Finish",
      ),
    );
  if (
    !contiguous(
      spec.stages.map((stage) => stage.order),
      1,
    )
  )
    issues.push(
      semantic(
        "stage-order",
        "/stages",
        "stage order must be contiguous from one",
      ),
    );

  const zoneIds = new Set(spec.decorativeZones.map((zone) => zone.zoneId));
  for (const [stageIndex, stage] of spec.stages.entries()) {
    for (const id of [...stage.routeObjectIds, ...stage.hazardObjectIds]) {
      if (!objects.has(id))
        issues.push(
          semantic(
            "reference",
            `/stages/${stageIndex}`,
            `unknown object reference ${id}`,
          ),
        );
    }
    if (
      stage.checkpointObjectId !== undefined &&
      !objects.has(stage.checkpointObjectId)
    )
      issues.push(
        semantic(
          "reference",
          `/stages/${stageIndex}/checkpointObjectId`,
          "unknown checkpoint object",
        ),
      );
    for (const zoneId of stage.decorativeZoneIds)
      if (!zoneIds.has(zoneId))
        issues.push(
          semantic(
            "reference",
            `/stages/${stageIndex}/decorativeZoneIds`,
            `unknown decorative zone ${zoneId}`,
          ),
        );
  }

  const expectedPath = ["Spawn", ...routeIds];
  const transitions = spec.reachability.requiredTransitions;
  if (transitions.length !== routeIds.length)
    issues.push(
      semantic(
        "reachability-count",
        "/reachability/requiredTransitions",
        "every Spawn-to-Finish edge requires evidence",
      ),
    );
  for (const [index, transition] of transitions.entries()) {
    if (
      transition.fromObjectId !== expectedPath[index] ||
      transition.toObjectId !== expectedPath[index + 1] ||
      transition.fromGlobalOrder !== index ||
      transition.toGlobalOrder !== index + 1
    )
      issues.push(
        semantic(
          "reachability-adjacency",
          `/reachability/requiredTransitions/${index}`,
          "transition must match adjacent route objects and order",
        ),
      );
  }

  for (const [index, object] of spec.objects.entries()) {
    const bounds = object.geometry.axisAlignedBounds;
    if (
      bounds.minimum.x < spec.worldBounds.minimum.x ||
      bounds.minimum.y < spec.worldBounds.minimum.y ||
      bounds.minimum.z < spec.worldBounds.minimum.z ||
      bounds.maximum.x > spec.worldBounds.maximum.x ||
      bounds.maximum.y > spec.worldBounds.maximum.y ||
      bounds.maximum.z > spec.worldBounds.maximum.z
    )
      issues.push(
        semantic(
          "world-bounds",
          `/objects/${index}/geometry/axisAlignedBounds`,
          "object geometry must remain within world bounds",
        ),
      );
  }
  if (computePlaceSpecV03Hash(spec) !== spec.placeSpecHash)
    issues.push(
      semantic(
        "hash-mismatch",
        "/placeSpecHash",
        "placeSpecHash does not match its self-excluding preimage",
      ),
    );
  return issues;
}

export function validatePlaceSpecV03(
  input: unknown,
): ValidationResult<PlaceSpecV03> {
  const structural = validateStructure(placeValidator, input);
  if (!structural.ok) return structural;
  const issues = semanticPlaceSpecV03Issues(structural.value);
  return issues.length === 0
    ? { ok: true, value: structural.value, issues: [] }
    : { ok: false, issues };
}

export function assertValidPlaceSpecV03(input: unknown): PlaceSpecV03 {
  const result = validatePlaceSpecV03(input);
  if (!result.ok)
    throw new ContractValidationError("PlaceSpecV03", result.issues);
  return result.value;
}

export function semanticSceneManifestV03Issues(
  manifest: SceneManifestV03,
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const objects = manifest.layers.gameplay.objects;
  const byId = new Map(objects.map((object) => [object.id, object]));
  if (!unique(objects.map((object) => object.id)))
    issues.push(
      semantic(
        "duplicate-id",
        "/layers/gameplay/objects",
        "gameplay object IDs must be unique",
      ),
    );
  if (
    !contiguous(
      objects.map((object) => object.order),
      0,
    )
  )
    issues.push(
      semantic(
        "order",
        "/layers/gameplay/objects",
        "gameplay order must be contiguous from zero",
      ),
    );
  if (objects[0]?.id !== "Spawn" || objects[0].role !== "spawn")
    issues.push(
      semantic(
        "spawn",
        "/layers/gameplay/objects/0",
        "Spawn must be the first gameplay object",
      ),
    );
  if (manifest.navigation.safeRouteObjectIds.at(-1) !== "Finish")
    issues.push(
      semantic(
        "finish-order",
        "/navigation/safeRouteObjectIds",
        "Finish must be the final route object",
      ),
    );
  for (const [index, id] of manifest.navigation.safeRouteObjectIds.entries()) {
    const object = byId.get(id);
    if (!object || object.role === "spawn" || object.role === "kill")
      issues.push(
        semantic(
          "route-role",
          `/navigation/safeRouteObjectIds/${index}`,
          "route endpoint must exist and be safe gameplay",
        ),
      );
  }
  const entries = manifest.navigation.routeEntries;
  if (
    entries.length !== manifest.navigation.safeRouteObjectIds.length ||
    entries.some(
      (entry, index) =>
        entry.globalOrder !== index + 1 ||
        entry.objectId !== manifest.navigation.safeRouteObjectIds[index],
    )
  )
    issues.push(
      semantic(
        "route-entry",
        "/navigation/routeEntries",
        "route entries must exactly index the safe route",
      ),
    );
  const expectedPath = [
    manifest.navigation.spawnObjectId,
    ...manifest.navigation.safeRouteObjectIds,
  ];
  const transitions = manifest.navigation.reachability.requiredTransitions;
  if (transitions.length !== manifest.navigation.safeRouteObjectIds.length)
    issues.push(
      semantic(
        "reachability-count",
        "/navigation/reachability/requiredTransitions",
        "every route edge requires evidence",
      ),
    );
  for (const [index, transition] of transitions.entries())
    if (
      transition.fromObjectId !== expectedPath[index] ||
      transition.toObjectId !== expectedPath[index + 1] ||
      transition.fromGlobalOrder !== index ||
      transition.toGlobalOrder !== index + 1
    )
      issues.push(
        semantic(
          "reachability-adjacency",
          `/navigation/reachability/requiredTransitions/${index}`,
          "transition must match adjacent route objects and order",
        ),
      );
  for (const [index, object] of manifest.layers.decorative.objects.entries()) {
    if (
      object.collision.canCollide ||
      object.collision.canTouch ||
      object.collision.canQuery
    )
      issues.push(
        semantic(
          "decorative-collision",
          `/layers/decorative/objects/${index}/collision`,
          "decorative objects must remain non-colliding",
        ),
      );
    if (manifest.navigation.safeRouteObjectIds.includes(object.id))
      issues.push(
        semantic(
          "decorative-route",
          `/layers/decorative/objects/${index}/id`,
          "decorative objects cannot be route endpoints",
        ),
      );
  }
  if (computeSceneManifestV03Hash(manifest) !== manifest.manifestHash)
    issues.push(
      semantic(
        "hash-mismatch",
        "/manifestHash",
        "manifestHash does not match its self-excluding preimage",
      ),
    );
  return issues;
}

export function validateSceneManifestV03(
  input: unknown,
): ValidationResult<SceneManifestV03> {
  const structural = validateStructure(manifestValidator, input);
  if (!structural.ok) return structural;
  const issues = semanticSceneManifestV03Issues(structural.value);
  return issues.length === 0
    ? { ok: true, value: structural.value, issues: [] }
    : { ok: false, issues };
}

export function assertValidSceneManifestV03(input: unknown): SceneManifestV03 {
  const result = validateSceneManifestV03(input);
  if (!result.ok)
    throw new ContractValidationError("SceneManifestV03", result.issues);
  return result.value;
}

export { placeSpecV03Schema, sceneManifestV03Schema };

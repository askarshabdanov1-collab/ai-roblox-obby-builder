import { sha256 } from "@obby/canonical-json";
import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";

import placeSpecSchema from "../schemas/place-spec.schema.json" with { type: "json" };
import sceneManifestSchema from "../schemas/scene-manifest.schema.json" with { type: "json" };
import type { PlaceSpec } from "./generated/place-spec.js";
import type {
  GameplayObject,
  SceneManifest,
} from "./generated/scene-manifest.js";

export type ContractIssue = {
  kind: "semantic" | "structural";
  code: string;
  path: string;
  message: string;
};

export type ValidationResult<T> =
  { ok: true; value: T; issues: [] } | { ok: false; issues: ContractIssue[] };

export const MANIFEST_HASH_PLACEHOLDER = `sha256:${"0".repeat(64)}`;

const ajv = new Ajv2020({
  allErrors: true,
  allowUnionTypes: false,
  strict: true,
  strictNumbers: true,
  validateFormats: false,
});

const placeSpecValidator = ajv.compile<PlaceSpec>(placeSpecSchema);
const sceneManifestValidator = ajv.compile<SceneManifest>(sceneManifestSchema);

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

function issue(code: string, path: string, message: string): ContractIssue {
  return { kind: "semantic", code, path, message };
}

function validateStructure<T>(
  validator: ValidateFunction<T>,
  input: unknown,
): ValidationResult<T> {
  if (validator(input)) return { ok: true, value: input, issues: [] };
  return { ok: false, issues: structuralIssues(validator.errors) };
}

function duplicates(
  values: readonly (number | string)[],
): Set<number | string> {
  const seen = new Set<number | string>();
  const duplicateValues = new Set<number | string>();
  for (const value of values) {
    if (seen.has(value)) duplicateValues.add(value);
    seen.add(value);
  }
  return duplicateValues;
}

function expectContiguous(values: readonly number[], start: number): boolean {
  return [...values]
    .sort((left, right) => left - right)
    .every((value, index) => value === start + index);
}

type Positioned = {
  transform: { position: { x: number; y: number; z: number } };
  size: { x: number; y: number; z: number };
};

function horizontalSurfaceGap(from: Positioned, to: Positioned): number {
  const xGap = Math.max(
    0,
    Math.abs(to.transform.position.x - from.transform.position.x) -
      (from.size.x + to.size.x) / 2,
  );
  const zGap = Math.max(
    0,
    Math.abs(to.transform.position.z - from.transform.position.z) -
      (from.size.z + to.size.z) / 2,
  );
  return Math.hypot(xGap, zGap);
}

function verticalSurfaceRise(from: Positioned, to: Positioned): number {
  const fromTop = from.transform.position.y + from.size.y / 2;
  const toBottom = to.transform.position.y - to.size.y / 2;
  return Math.max(0, toBottom - fromTop);
}

export function semanticPlaceSpecIssues(spec: PlaceSpec): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const stageIds = new Set(spec.stages.map((stage) => stage.id));
  const obstacleById = new Map(
    spec.obstacles.map((obstacle) => [obstacle.id, obstacle]),
  );

  for (const duplicate of duplicates(spec.stages.map((stage) => stage.id))) {
    issues.push(
      issue(
        "duplicate-stage-id",
        "/stages",
        `stage id ${String(duplicate)} is duplicated`,
      ),
    );
  }
  for (const duplicate of duplicates(spec.stages.map((stage) => stage.order))) {
    issues.push(
      issue(
        "duplicate-stage-order",
        "/stages",
        `stage order ${String(duplicate)} is duplicated`,
      ),
    );
  }
  if (
    !expectContiguous(
      spec.stages.map((stage) => stage.order),
      1,
    )
  ) {
    issues.push(
      issue(
        "stage-order",
        "/stages",
        "stage order must be contiguous and start at 1",
      ),
    );
  }
  if (spec.stages.length > spec.budgets.maxStages) {
    issues.push(
      issue("stage-budget", "/stages", "stage count exceeds budgets.maxStages"),
    );
  }

  for (const duplicate of duplicates(
    spec.obstacles.map((obstacle) => obstacle.id),
  )) {
    issues.push(
      issue(
        "duplicate-obstacle-id",
        "/obstacles",
        `obstacle id ${String(duplicate)} is duplicated`,
      ),
    );
  }
  for (const duplicate of duplicates(
    spec.obstacles.map((obstacle) => obstacle.order),
  )) {
    issues.push(
      issue(
        "duplicate-obstacle-order",
        "/obstacles",
        `obstacle order ${String(duplicate)} is duplicated`,
      ),
    );
  }
  if (
    !expectContiguous(
      spec.obstacles.map((obstacle) => obstacle.order),
      1,
    )
  ) {
    issues.push(
      issue(
        "obstacle-order",
        "/obstacles",
        "obstacle order must be contiguous and start at 1",
      ),
    );
  }
  if (spec.obstacles.length + 1 > spec.budgets.maxGameplayObjects) {
    issues.push(
      issue(
        "gameplay-object-budget",
        "/obstacles",
        "spawn plus obstacles exceed budgets.maxGameplayObjects",
      ),
    );
  }

  for (const [index, obstacle] of spec.obstacles.entries()) {
    if (!stageIds.has(obstacle.stageId)) {
      issues.push(
        issue(
          "unknown-stage",
          `/obstacles/${index}/stageId`,
          `unknown stage id ${obstacle.stageId}`,
        ),
      );
    }
    if (
      Math.max(obstacle.size.x, obstacle.size.y, obstacle.size.z) >
      spec.budgets.maxPartSize
    ) {
      issues.push(
        issue(
          "part-size-budget",
          `/obstacles/${index}/size`,
          "part exceeds budgets.maxPartSize",
        ),
      );
    }
    const extent =
      Math.max(
        Math.abs(obstacle.transform.position.x),
        Math.abs(obstacle.transform.position.y),
        Math.abs(obstacle.transform.position.z),
      ) +
      Math.hypot(obstacle.size.x, obstacle.size.y, obstacle.size.z) / 2;
    if (extent > spec.budgets.maxWorldExtent) {
      issues.push(
        issue(
          "world-extent-budget",
          `/obstacles/${index}/transform`,
          "part exceeds budgets.maxWorldExtent",
        ),
      );
    }
  }

  const routeIds: string[] = [];
  for (const stage of [...spec.stages].sort(
    (left, right) => left.order - right.order,
  )) {
    for (const obstacleId of stage.routeObstacleIds) {
      routeIds.push(obstacleId);
      const obstacle = obstacleById.get(obstacleId);
      if (obstacle === undefined) {
        issues.push(
          issue(
            "unknown-route-obstacle",
            "/stages",
            `route references unknown obstacle ${obstacleId}`,
          ),
        );
      } else if (obstacle.stageId !== stage.id) {
        issues.push(
          issue(
            "route-stage-mismatch",
            "/stages",
            `${obstacleId} belongs to ${obstacle.stageId}, not ${stage.id}`,
          ),
        );
      } else if (obstacle.role === "kill") {
        issues.push(
          issue(
            "hazard-on-route",
            "/stages",
            `${obstacleId} cannot be part of the safe route`,
          ),
        );
      }
    }
  }
  for (const duplicate of duplicates(routeIds)) {
    issues.push(
      issue(
        "duplicate-route-obstacle",
        "/stages",
        `${String(duplicate)} appears twice in the route`,
      ),
    );
  }

  const safeObstacleIds = spec.obstacles
    .filter((obstacle) => obstacle.role !== "kill")
    .map((obstacle) => obstacle.id);
  for (const obstacleId of safeObstacleIds) {
    if (!routeIds.includes(obstacleId)) {
      issues.push(
        issue(
          "unrouted-obstacle",
          "/stages",
          `${obstacleId} is not present in the ordered route`,
        ),
      );
    }
  }

  const finishes = spec.obstacles.filter(
    (obstacle) => obstacle.role === "finish",
  );
  if (finishes.length !== 1) {
    issues.push(
      issue(
        "finish-count",
        "/obstacles",
        "exactly one finish obstacle is required",
      ),
    );
  } else if (finishes[0]?.id !== spec.finishCriteria.finishObstacleId) {
    issues.push(
      issue(
        "finish-reference",
        "/finishCriteria/finishObstacleId",
        "finish criteria must reference the finish",
      ),
    );
  }
  if (routeIds.at(-1) !== spec.finishCriteria.finishObstacleId) {
    issues.push(
      issue(
        "finish-route-order",
        "/stages",
        "the finish must be the last safe-route obstacle",
      ),
    );
  }

  const checkpointIds = spec.obstacles
    .filter((obstacle) => obstacle.role === "checkpoint")
    .sort((left, right) => left.order - right.order)
    .map((obstacle) => obstacle.id);
  if (
    checkpointIds.length !== spec.checkpointPlan.checkpointObstacleIds.length ||
    checkpointIds.some(
      (id, index) => spec.checkpointPlan.checkpointObstacleIds[index] !== id,
    )
  ) {
    issues.push(
      issue(
        "checkpoint-plan",
        "/checkpointPlan/checkpointObstacleIds",
        "checkpoint plan must list every checkpoint in obstacle order",
      ),
    );
  }

  const orderedStages = [...spec.stages].sort(
    (left, right) => left.order - right.order,
  );
  if (orderedStages[0]?.difficulty !== spec.difficultyProgression.start) {
    issues.push(
      issue(
        "difficulty-start",
        "/difficultyProgression/start",
        "must match the first stage",
      ),
    );
  }
  if (orderedStages.at(-1)?.difficulty !== spec.difficultyProgression.end) {
    issues.push(
      issue(
        "difficulty-end",
        "/difficultyProgression/end",
        "must match the last stage",
      ),
    );
  }
  if (
    spec.difficultyProgression.curve !== "flat" &&
    orderedStages.some(
      (stage, index) =>
        index > 0 &&
        stage.difficulty < (orderedStages[index - 1]?.difficulty ?? 0),
    )
  ) {
    issues.push(
      issue(
        "difficulty-order",
        "/stages",
        "non-flat difficulty cannot decrease",
      ),
    );
  }

  const safeRoute = routeIds
    .map((id) => obstacleById.get(id))
    .filter(
      (obstacle): obstacle is NonNullable<typeof obstacle> =>
        obstacle !== undefined,
    );
  const routeWithSpawn: Positioned[] = [spec.spawn, ...safeRoute];
  for (let index = 1; index < routeWithSpawn.length; index += 1) {
    const from = routeWithSpawn[index - 1];
    const to = routeWithSpawn[index];
    if (from === undefined || to === undefined) continue;
    if (horizontalSurfaceGap(from, to) > spec.movement.maxHorizontalGap) {
      issues.push(
        issue(
          "unreachable-gap",
          "/stages",
          `route step ${index} exceeds maxHorizontalGap`,
        ),
      );
    }
    if (verticalSurfaceRise(from, to) > spec.movement.maxVerticalRise) {
      issues.push(
        issue(
          "unreachable-rise",
          "/stages",
          `route step ${index} exceeds maxVerticalRise`,
        ),
      );
    }
  }

  return issues;
}

function expectedClass(object: GameplayObject): GameplayObject["className"] {
  if (object.role === "spawn") return "SpawnLocation";
  return object.shape === "Wedge" ? "WedgePart" : "Part";
}

export function computeManifestHash(
  manifest: SceneManifest,
): `sha256:${string}` {
  return sha256({ ...manifest, manifestHash: MANIFEST_HASH_PLACEHOLDER });
}

export function semanticSceneManifestIssues(
  manifest: SceneManifest,
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const gameplay = manifest.layers.gameplay.objects;
  const decorative = manifest.layers.decorative.objects;
  const allObjects = [...gameplay, ...decorative];

  for (const duplicate of duplicates(allObjects.map((object) => object.id))) {
    issues.push(
      issue(
        "duplicate-object-id",
        "/layers",
        `object id ${String(duplicate)} is duplicated`,
      ),
    );
  }
  if (!gameplay.every((object, index) => object.order === index)) {
    issues.push(
      issue(
        "gameplay-order",
        "/layers/gameplay/objects",
        "array order and object order must match",
      ),
    );
  }
  if (!decorative.every((object, index) => object.order === index)) {
    issues.push(
      issue(
        "decorative-order",
        "/layers/decorative/objects",
        "array order and object order must match",
      ),
    );
  }

  const spawns = gameplay.filter((object) => object.role === "spawn");
  if (spawns.length !== 1 || spawns[0]?.order !== 0) {
    issues.push(
      issue(
        "spawn-count",
        "/layers/gameplay/objects",
        "exactly one order-0 spawn is required",
      ),
    );
  }
  if (gameplay.filter((object) => object.role === "finish").length !== 1) {
    issues.push(
      issue(
        "finish-count",
        "/layers/gameplay/objects",
        "exactly one finish is required",
      ),
    );
  }

  const checkpoints = gameplay.filter((object) => object.role === "checkpoint");
  const checkpointOrders = checkpoints.map(
    (object) => object.behavior.checkpointOrder ?? -1,
  );
  if (!expectContiguous(checkpointOrders, 1)) {
    issues.push(
      issue(
        "checkpoint-order",
        "/layers/gameplay/objects",
        "checkpoint order must be contiguous and start at 1",
      ),
    );
  }

  for (const [index, object] of gameplay.entries()) {
    const path = `/layers/gameplay/objects/${index}`;
    if (object.behavior.kind !== object.role) {
      issues.push(
        issue(
          "behavior-role",
          `${path}/behavior/kind`,
          "behavior kind must match role",
        ),
      );
    }
    if (object.className !== expectedClass(object)) {
      issues.push(
        issue(
          "class-shape",
          `${path}/className`,
          "className does not implement role and shape",
        ),
      );
    }
    const expectsTouch = ["checkpoint", "kill", "finish"].includes(object.role);
    if (object.physics.canTouch !== expectsTouch) {
      issues.push(
        issue(
          "touch-policy",
          `${path}/physics/canTouch`,
          "canTouch does not match gameplay role",
        ),
      );
    }
    if (!object.physics.canCollide) {
      issues.push(
        issue(
          "gameplay-collision",
          `${path}/physics/canCollide`,
          "gameplay objects must collide",
        ),
      );
    }
    if (
      object.role === "checkpoint" &&
      object.behavior.checkpointOrder === undefined
    ) {
      issues.push(
        issue(
          "checkpoint-behavior",
          `${path}/behavior`,
          "checkpointOrder is required",
        ),
      );
    }
    if (
      object.role !== "checkpoint" &&
      object.behavior.checkpointOrder !== undefined
    ) {
      issues.push(
        issue(
          "checkpoint-behavior",
          `${path}/behavior`,
          "checkpointOrder is checkpoint-only",
        ),
      );
    }
    if (object.role === "kill" && object.behavior.damage === undefined) {
      issues.push(
        issue("kill-behavior", `${path}/behavior`, "damage is required"),
      );
    }
    if (object.role !== "kill" && object.behavior.damage !== undefined) {
      issues.push(
        issue("kill-behavior", `${path}/behavior`, "damage is kill-only"),
      );
    }
  }

  for (const [index, object] of allObjects.entries()) {
    const radius = Math.hypot(object.size.x, object.size.y, object.size.z) / 2;
    for (const axis of ["x", "y", "z"] as const) {
      const position = object.transform.position[axis];
      if (
        position - radius < manifest.worldBounds.minimum[axis] - 0.000_001 ||
        position + radius > manifest.worldBounds.maximum[axis] + 0.000_001
      ) {
        issues.push(
          issue(
            "world-bounds",
            `/layers/${index}`,
            `${object.id} is outside worldBounds`,
          ),
        );
        break;
      }
    }
  }
  for (const axis of ["x", "y", "z"] as const) {
    if (
      manifest.worldBounds.minimum[axis] >= manifest.worldBounds.maximum[axis]
    ) {
      issues.push(
        issue(
          "world-bounds-order",
          `/worldBounds/${axis}`,
          "minimum must be less than maximum",
        ),
      );
    }
  }

  if (computeManifestHash(manifest) !== manifest.manifestHash) {
    issues.push(
      issue(
        "manifest-hash",
        "/manifestHash",
        "manifestHash does not match canonical content",
      ),
    );
  }
  return issues;
}

export function validatePlaceSpec(input: unknown): ValidationResult<PlaceSpec> {
  const structural = validateStructure(placeSpecValidator, input);
  if (!structural.ok) return structural;
  const issues = semanticPlaceSpecIssues(structural.value);
  return issues.length === 0
    ? { ok: true, value: structural.value, issues: [] }
    : { ok: false, issues };
}

export function validateSceneManifest(
  input: unknown,
): ValidationResult<SceneManifest> {
  const structural = validateStructure(sceneManifestValidator, input);
  if (!structural.ok) return structural;
  const issues = semanticSceneManifestIssues(structural.value);
  return issues.length === 0
    ? { ok: true, value: structural.value, issues: [] }
    : { ok: false, issues };
}

export function assertValidPlaceSpec(input: unknown): PlaceSpec {
  const result = validatePlaceSpec(input);
  if (!result.ok) throw new ContractValidationError("PlaceSpec", result.issues);
  return result.value;
}

export function assertValidSceneManifest(input: unknown): SceneManifest {
  const result = validateSceneManifest(input);
  if (!result.ok)
    throw new ContractValidationError("SceneManifest", result.issues);
  return result.value;
}

export class ContractValidationError extends Error {
  public constructor(
    contractName: string,
    public readonly issues: ContractIssue[],
  ) {
    super(
      `${contractName} validation failed:\n${issues.map((item) => `${item.path}: ${item.message}`).join("\n")}`,
    );
    this.name = "ContractValidationError";
  }
}

export { placeSpecSchema, sceneManifestSchema };

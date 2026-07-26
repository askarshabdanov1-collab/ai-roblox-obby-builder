import {
  computeManifestHash,
  validateSceneManifest,
  type GameplayObject,
  type SceneManifest,
} from "@obby/contracts";

import { RouteEvaluationError, WorkBudget } from "./limits.js";
import type {
  RouteEvaluationIssue,
  RouteEvaluationLimits,
  RouteGraph,
} from "./types.js";

function requiredGraphValue<T>(value: T | undefined, subject: string): T {
  if (value === undefined) {
    throw new RouteEvaluationError("resolved-route-invariant", [
      {
        code: "resolved-route-invariant",
        subject,
        message: "validated route declaration did not resolve",
      },
    ]);
  }
  return value;
}

function normalizedManifestSnapshot(manifest: SceneManifest): SceneManifest {
  const normalized = structuredClone(manifest);
  normalized.layers.gameplay.objects.sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
  normalized.layers.decorative.objects.sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
  normalized.navigation.stages.sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
  normalized.navigation.routeEntries.sort(
    (a, b) =>
      a.routeOrder - b.routeOrder || a.objectId.localeCompare(b.objectId),
  );
  return normalized;
}

function duplicates(values: readonly number[]): number[] {
  const seen = new Set<number>();
  const repeated = new Set<number>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].toSorted((a, b) => a - b);
}

function duplicateStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].toSorted();
}

function declarationIssues(manifest: SceneManifest): RouteEvaluationIssue[] {
  const issues: RouteEvaluationIssue[] = [];
  const gameplay = new Map(
    manifest.layers.gameplay.objects.map((object) => [object.id, object]),
  );
  const stageIds = new Set(manifest.navigation.stages.map((stage) => stage.id));
  for (const stageId of duplicateStrings(
    manifest.navigation.stages.map((stage) => stage.id),
  )) {
    issues.push({
      code: "duplicate-required-stage",
      subject: stageId,
      message: "required stage IDs must be unique",
    });
  }
  for (const stageIndex of duplicates(
    manifest.navigation.stages.map((stage) => stage.order),
  )) {
    issues.push({
      code: "duplicate-stage-index",
      subject: `stage-index:${stageIndex}`,
      message: "stage indexes must be unique",
    });
  }
  const orderedStageIndexes = manifest.navigation.stages
    .map((stage) => stage.order)
    .toSorted((a, b) => a - b);
  if (
    orderedStageIndexes.some((stageIndex, index) => stageIndex !== index + 1)
  ) {
    issues.push({
      code: "missing-required-stage",
      subject: "stages",
      message: "required stage indexes must be contiguous from one",
    });
  }
  for (const routeIndex of duplicates(
    manifest.navigation.routeEntries.map((entry) => entry.routeOrder),
  )) {
    issues.push({
      code: "duplicate-route-index",
      subject: `route-index:${routeIndex}`,
      message: "route indexes must be unique",
    });
  }
  for (const objectId of duplicateStrings(
    manifest.navigation.safeRouteObjectIds,
  )) {
    issues.push({
      code: "duplicate-route-target",
      subject: objectId,
      message: "required route object IDs must be unique",
    });
  }
  for (const objectId of manifest.navigation.safeRouteObjectIds.toSorted()) {
    const routeObject = gameplay.get(objectId);
    if (routeObject === undefined) {
      const decorative = manifest.layers.decorative.objects.some(
        (object) => object.id === objectId,
      );
      issues.push({
        code: decorative
          ? "decorative-route-endpoint"
          : "unknown-safe-route-object",
        subject: objectId,
        message: decorative
          ? "decorative geometry cannot be promoted to route authority"
          : "safe-route reference does not resolve to gameplay geometry",
      });
    } else if (routeObject.role === "kill" || routeObject.role === "spawn") {
      issues.push({
        code:
          routeObject.role === "kill"
            ? "hazard-route-endpoint"
            : "spawn-route-endpoint",
        subject: objectId,
        message: `${routeObject.role} geometry cannot be a safe-route object`,
      });
    }
  }
  const finishes = manifest.layers.gameplay.objects.filter(
    (object) => object.role === "finish",
  );
  if (finishes.length !== 1) {
    issues.push({
      code: finishes.length === 0 ? "missing-finish" : "duplicate-finish",
      subject: "finish",
      message: "exactly one gameplay-authoritative finish is required",
    });
  } else if (
    manifest.navigation.safeRouteObjectIds.at(-1) !== finishes[0]?.id
  ) {
    issues.push({
      code: "finish-before-checkpoint",
      subject: finishes[0]?.id ?? "finish",
      message: "the finish must follow every required checkpoint",
    });
  }
  const entries = manifest.navigation.routeEntries.toSorted(
    (a, b) =>
      a.routeOrder - b.routeOrder || a.objectId.localeCompare(b.objectId),
  );
  const checkpointStageIds = entries
    .filter((entry) => gameplay.get(entry.objectId)?.role === "checkpoint")
    .map((entry) => entry.stageId);
  for (const stageId of duplicateStrings(checkpointStageIds)) {
    issues.push({
      code: "duplicate-checkpoint-stage",
      subject: stageId,
      message: "a required stage may contain at most one checkpoint",
    });
  }
  const orderedCheckpoints = entries
    .map((entry) => ({ entry, object: gameplay.get(entry.objectId) }))
    .filter(
      (
        item,
      ): item is {
        entry: (typeof entries)[number];
        object: GameplayObject;
      } => item.object?.role === "checkpoint",
    )
    .toSorted(
      (left, right) =>
        (left.object.behavior.checkpointOrder ?? 0) -
        (right.object.behavior.checkpointOrder ?? 0),
    );
  if (
    orderedCheckpoints.some(
      (item, index) =>
        index > 0 &&
        item.entry.routeOrder <=
          (orderedCheckpoints[index - 1]?.entry.routeOrder ?? -1),
    )
  ) {
    issues.push({
      code: "checkpoint-backward-progression",
      subject: "checkpoints",
      message: "checkpoint order must move strictly forward through the route",
    });
  }
  if (entries.length !== manifest.navigation.safeRouteObjectIds.length) {
    issues.push({
      code: "disconnected-required-route",
      subject: "route-entries",
      message:
        "every required route object must have exactly one ordered entry",
    });
    if (entries.length < manifest.navigation.safeRouteObjectIds.length) {
      issues.push({
        code: "structural-softlock-candidate",
        subject: entries.at(-1)?.objectId ?? "spawn",
        message: "the required route declaration ends before the finish",
      });
    }
  }
  for (const [index, entry] of entries.entries()) {
    const expectedObjectId = manifest.navigation.safeRouteObjectIds[index];
    if (entry.routeOrder !== index + 1 || entry.objectId !== expectedObjectId) {
      issues.push({
        code: "reversed-required-transition",
        subject: entry.objectId,
        message: "required route entries must be strictly forward",
      });
    }
    const stage = manifest.navigation.stages.find(
      (candidate) => candidate.id === entry.stageId,
    );
    if (
      !stageIds.has(entry.stageId) ||
      stage?.safeRouteObjectIds[entry.stageRouteOrder - 1] !== entry.objectId
    ) {
      issues.push({
        code: "safe-route-ref-mismatch",
        subject: entry.objectId,
        message: "route entry stage metadata is inconsistent",
      });
    }
  }
  for (
    let index = 1;
    index < manifest.navigation.safeRouteObjectIds.length;
    index += 1
  ) {
    if (
      manifest.navigation.safeRouteObjectIds[index - 1] ===
      manifest.navigation.safeRouteObjectIds[index]
    ) {
      issues.push({
        code: "source-equals-destination",
        subject: manifest.navigation.safeRouteObjectIds[index] ?? "unknown",
        message: "a required transition cannot target its source",
      });
    }
  }
  return issues.toSorted((a, b) =>
    `${a.code}\u0000${a.subject}\u0000${a.message}`.localeCompare(
      `${b.code}\u0000${b.subject}\u0000${b.message}`,
    ),
  );
}

export function validateAndNormalizeManifest(input: unknown): SceneManifest {
  const rawValidation = validateSceneManifest(input);
  if (
    !rawValidation.ok &&
    rawValidation.issues.some((candidate) => candidate.kind === "structural") &&
    !rawValidation.issues.every(
      (candidate) =>
        candidate.kind === "structural" && candidate.code === "uniqueItems",
    )
  ) {
    throw new RouteEvaluationError(
      "invalid-scene-manifest",
      rawValidation.issues
        .map((candidate) => ({
          code: candidate.code,
          subject: candidate.path,
          message: candidate.message,
        }))
        .toSorted((left, right) =>
          `${left.code}\u0000${left.subject}\u0000${left.message}`.localeCompare(
            `${right.code}\u0000${right.subject}\u0000${right.message}`,
          ),
        ),
    );
  }
  const manifest = normalizedManifestSnapshot(input as SceneManifest);
  const issues = declarationIssues(manifest);
  if (issues.length > 0) {
    throw new RouteEvaluationError("invalid-route-declaration", issues);
  }
  const validation = validateSceneManifest(manifest);
  if (!validation.ok) {
    throw new RouteEvaluationError(
      "invalid-scene-manifest",
      validation.issues.map((issue) => ({
        code: issue.code,
        subject: issue.path,
        message: issue.message,
      })),
    );
  }
  if (computeManifestHash(manifest) !== manifest.manifestHash) {
    throw new RouteEvaluationError("manifest-hash-mismatch", [
      {
        code: "manifest-hash-mismatch",
        subject: "manifestHash",
        message:
          "normalized semantic manifest content does not match manifestHash",
      },
    ]);
  }
  return manifest;
}

export function buildRouteGraph(
  input: unknown,
  limits?: RouteEvaluationLimits,
  work = new WorkBudget(limits?.maxTraversalWork ?? 200_000),
): RouteGraph {
  const manifest = validateAndNormalizeManifest(input);
  const gameplay = new Map(
    manifest.layers.gameplay.objects.map((object) => [object.id, object]),
  );
  const spawn = requiredGraphValue(
    manifest.layers.gameplay.objects.find((object) => object.role === "spawn"),
    "spawn",
  );
  const finish = requiredGraphValue(
    manifest.layers.gameplay.objects.find((object) => object.role === "finish"),
    "finish",
  );
  const entries = manifest.navigation.routeEntries.toSorted(
    (a, b) => a.routeOrder - b.routeOrder,
  );
  const stageById = new Map(
    manifest.navigation.stages.map((stage) => [stage.id, stage]),
  );
  const firstStage = requiredGraphValue(
    manifest.navigation.stages[0],
    "stage:1",
  );
  const nodes = [
    {
      objectId: spawn.id,
      role: spawn.role,
      stageId: firstStage.id,
      stageIndex: firstStage.order,
      routeIndex: 0,
    },
    ...entries.map((entry) => {
      work.use();
      const object = requiredGraphValue(
        gameplay.get(entry.objectId),
        entry.objectId,
      );
      const stage = requiredGraphValue(
        stageById.get(entry.stageId),
        entry.stageId,
      );
      return {
        objectId: object.id,
        role: object.role,
        stageId: stage.id,
        stageIndex: stage.order,
        routeIndex: entry.routeOrder,
      };
    }),
  ];
  const edges = nodes.slice(1).map((node, index) => {
    work.use();
    const source = requiredGraphValue(nodes[index], `route-index:${index}`);
    return {
      transitionId: `route:${manifest.sceneId}/${source.objectId}/${node.objectId}/${source.routeIndex}/${node.routeIndex}`,
      fromObjectId: source.objectId,
      toObjectId: node.objectId,
      fromRouteIndex: source.routeIndex,
      toRouteIndex: node.routeIndex,
      required: true as const,
    };
  });
  return {
    schemaVersion: "0.1",
    routeId: manifest.sceneId,
    stages: manifest.navigation.stages.map((stage) => ({
      stageId: stage.id,
      stageIndex: stage.order,
      objectIds: [...stage.safeRouteObjectIds],
    })),
    nodes,
    edges,
    spawnObjectId: spawn.id,
    checkpointObjectIds: nodes
      .filter((node) => node.role === "checkpoint")
      .map((node) => node.objectId),
    finishObjectId: finish.id,
    hazardObjectIds: manifest.layers.gameplay.objects
      .filter((object) => object.role === "kill")
      .map((object) => object.id)
      .toSorted(),
    sideBranches: [],
  };
}

import {
  canonicalizeEvaluatorSnapshot,
  sha256Bytes,
  snapshotEvaluatorInput,
} from "@obby/canonical-json";
import type { GameplayObject, SceneManifest } from "@obby/contracts";
import {
  normalizeGeometryObjects,
  normalizeTransitionInputs,
  type AxisAlignedBounds,
  type NormalizedGeometryObject,
} from "@obby/geometry-evaluator";
import {
  assertValidEvidenceGraph,
  hashEvidenceContent,
  verifyControllerProfileIdentity,
  type ControllerProfile,
  type EvidenceRecordContract,
  type EvaluationSubject,
  type Finding,
} from "@obby/obby-evaluator-contracts";

import {
  classifyCoarseTransition,
  coarseSurfaceKind,
} from "./classification.js";
import { buildRouteGraph, validateAndNormalizeManifest } from "./graph.js";
import {
  rejectBudget,
  resolveRouteLimits,
  RouteEvaluationError,
  WorkBudget,
} from "./limits.js";
import type {
  RouteGraph,
  RoutePlayabilityEvaluation,
  RoutePlayabilityInput,
} from "./types.js";
import { detectStructuralSoftlockCandidates } from "./softlocks.js";

const PRODUCER = Object.freeze({
  component: "route-playability-evaluator" as const,
  version: "0.1.0" as const,
});

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function nestedArray(
  value: unknown,
  ...path: readonly string[]
): readonly unknown[] {
  let current = value;
  for (const segment of path) {
    current = recordValue(current)?.[segment];
  }
  return Array.isArray(current) ? current : [];
}

function requiredValue<T>(value: T | undefined, subject: string): T {
  if (value === undefined) {
    throw new RouteEvaluationError("resolved-graph-invariant", [
      {
        code: "resolved-graph-invariant",
        subject,
        message: "validated route data did not resolve during evaluation",
      },
    ]);
  }
  return value;
}

function requiredEvidenceId(record: EvidenceRecordContract): string {
  return requiredValue(record.evidenceId, record.kind);
}

function contentHash(domain: string, value: unknown): `sha256:${string}` {
  return sha256Bytes(
    canonicalizeEvaluatorSnapshot({
      canonicalizationAlgorithm: "obby-canonical-json-v1",
      domain,
      value: snapshotEvaluatorInput(value),
    }).canonicalBytes,
  );
}

function geometryInputs(manifest: SceneManifest, graph: RouteGraph) {
  const routeNode = new Map(graph.nodes.map((node) => [node.objectId, node]));
  const inputForGameplay = (object: GameplayObject) => {
    const node = routeNode.get(object.id);
    return {
      schemaVersion: "0.1" as const,
      objectId: object.id,
      shape: object.shape,
      authority: "native-gameplay" as const,
      collision: {
        canCollide: object.physics.canCollide,
        canTouch: object.physics.canTouch,
        canQuery: object.physics.canQuery,
      },
      gameplayOwnership: "native-part" as const,
      promotionStatus: "not-applicable" as const,
      transform: {
        position: structuredClone(object.transform.position),
        rotationDegrees: structuredClone(object.transform.rotation),
      },
      size: structuredClone(object.size),
      ...(node === undefined
        ? {}
        : {
            safeRouteRef: {
              routeId: graph.routeId,
              stageId: node.stageId,
              stageIndex: node.stageIndex,
              globalIndex: node.routeIndex,
            },
          }),
    };
  };
  return [
    ...manifest.layers.gameplay.objects.map(inputForGameplay),
    ...manifest.layers.decorative.objects.map((object) => ({
      schemaVersion: "0.1" as const,
      objectId: object.id,
      shape: object.shape,
      authority: "decorative" as const,
      collision: {
        canCollide: object.physics.canCollide,
        canTouch: object.physics.canTouch,
        canQuery: object.physics.canQuery,
      },
      gameplayOwnership: "none" as const,
      promotionStatus: "not-promoted" as const,
      transform: {
        position: structuredClone(object.transform.position),
        rotationDegrees: structuredClone(object.transform.rotation),
      },
      size: structuredClone(object.size),
    })),
  ];
}

function overlap(left: AxisAlignedBounds, right: AxisAlignedBounds): boolean {
  return (
    left.minimum.x <= right.maximum.x &&
    left.maximum.x >= right.minimum.x &&
    left.minimum.y <= right.maximum.y &&
    left.maximum.y >= right.minimum.y &&
    left.minimum.z <= right.maximum.z &&
    left.maximum.z >= right.minimum.z
  );
}

function horizontallyContains(
  outer: AxisAlignedBounds,
  inner: AxisAlignedBounds,
): boolean {
  return (
    outer.minimum.x <= inner.minimum.x &&
    outer.maximum.x >= inner.maximum.x &&
    outer.minimum.z <= inner.minimum.z &&
    outer.maximum.z >= inner.maximum.z
  );
}

function axisGap(
  leftMinimum: number,
  leftMaximum: number,
  rightMinimum: number,
  rightMaximum: number,
): number {
  return Math.max(0, rightMinimum - leftMaximum, leftMinimum - rightMaximum);
}

function directCandidateFits(
  source: NormalizedGeometryObject,
  destination: NormalizedGeometryObject,
  profile: ControllerProfile,
): boolean {
  if (!source.gameplayAuthoritative || !destination.gameplayAuthoritative) {
    return false;
  }
  if (
    !profile.supportedSurfaceKinds.includes(
      coarseSurfaceKind(source.topSurface),
    ) ||
    !profile.supportedSurfaceKinds.includes(
      coarseSurfaceKind(destination.topSurface),
    )
  ) {
    return false;
  }
  const x = axisGap(
    source.axisAlignedBounds.minimum.x,
    source.axisAlignedBounds.maximum.x,
    destination.axisAlignedBounds.minimum.x,
    destination.axisAlignedBounds.maximum.x,
  );
  const z = axisGap(
    source.axisAlignedBounds.minimum.z,
    source.axisAlignedBounds.maximum.z,
    destination.axisAlignedBounds.minimum.z,
    destination.axisAlignedBounds.maximum.z,
  );
  const delta = destination.topSurface.maximumY - source.topSurface.maximumY;
  const tolerance = profile.tolerancePolicy.comparisonToleranceStuds;
  return (
    Math.hypot(x, z) <= profile.maximumHorizontalGap.value + tolerance &&
    Math.max(0, delta) <= profile.maximumRise.value + tolerance &&
    Math.max(0, -delta) <= profile.maximumDownwardDrop.value + tolerance
  );
}

type EvidenceDraft = Omit<EvidenceRecordContract, "evidenceContentHash">;

type SkipCandidateKind =
  | "non-adjacent-route-edge"
  | "checkpoint-bypass"
  | "spawn-to-late-stage"
  | "checkpoint-to-finish"
  | "required-stage-skip";

function finishEvidence(draft: EvidenceDraft): EvidenceRecordContract {
  const provisional = {
    ...draft,
    evidenceContentHash: contentHash(
      "evidence-placeholder-v1",
      draft.evidenceId,
    ),
  };
  const record = {
    ...provisional,
    evidenceContentHash: hashEvidenceContent(provisional).hash,
  } as EvidenceRecordContract;
  return record;
}

function baseEvidence(
  evidenceId: string,
  kind: EvidenceRecordContract["kind"],
  manifestHash: string,
  subject: EvaluationSubject,
  parentEvidenceHashes: readonly string[],
  limitations: readonly string[],
) {
  return {
    schemaVersion: "0.1" as const,
    evidenceId,
    kind,
    manifestHash,
    subject,
    producer: PRODUCER,
    parentEvidenceHashes: [...parentEvidenceHashes].toSorted(),
    artifactHashes: [],
    quality: { completeness: "complete" as const, validityCodes: [] },
    limitations: [...limitations].toSorted(),
  };
}

function finding(
  ordinal: number,
  ruleId: string,
  title: string,
  summary: string,
  severity: Finding["severity"],
  sourceKind: Finding["sourceKind"],
  subjects: Finding["subjects"],
  evidenceIds: Finding["evidenceIds"],
  limitations: readonly string[],
  metricIds: readonly string[] = [],
): Finding {
  return {
    schemaVersion: "0.1",
    findingId: `finding.${ruleId}.${ordinal}`,
    ruleId,
    ruleVersion: "1.0.0",
    metricIds: [...metricIds].toSorted(),
    title,
    summary,
    severity,
    blocking: false,
    sourceKind,
    subjects,
    evidenceIds,
    limitations: [...limitations].toSorted(),
  };
}

export function evaluateRoutePlayability(
  input: RoutePlayabilityInput,
): RoutePlayabilityEvaluation {
  const limits = resolveRouteLimits(input.limits);
  const profile = verifyControllerProfileIdentity(input.controllerProfile);
  const work = new WorkBudget(limits.maxTraversalWork);
  if (limits.maxRoutes < 1) rejectBudget("maximum-routes", 1, limits.maxRoutes);
  const gameplayObjects = nestedArray(
    input.manifest,
    "layers",
    "gameplay",
    "objects",
  );
  const safeRouteObjectIds = nestedArray(
    input.manifest,
    "navigation",
    "safeRouteObjectIds",
  );
  const checkpointCount = gameplayObjects.filter(
    (object) => recordValue(object)?.role === "checkpoint",
  ).length;
  const hazardCount = gameplayObjects.filter(
    (object) => recordValue(object)?.role === "kill",
  ).length;
  const nodeCount = safeRouteObjectIds.length + 1;
  const transitionCount = safeRouteObjectIds.length;
  if (nodeCount > limits.maxNodes)
    rejectBudget("maximum-nodes", nodeCount, limits.maxNodes);
  if (transitionCount > limits.maxTransitions)
    rejectBudget("maximum-transitions", transitionCount, limits.maxTransitions);
  if (checkpointCount > limits.maxCheckpoints)
    rejectBudget("maximum-checkpoints", checkpointCount, limits.maxCheckpoints);
  if (hazardCount > limits.maxHazards)
    rejectBudget("maximum-hazards", hazardCount, limits.maxHazards);

  const manifest = validateAndNormalizeManifest(input.manifest);

  const routeGraph = buildRouteGraph(manifest, limits, work);
  const routeNodeById = new Map(
    routeGraph.nodes.map((node) => [node.objectId, node]),
  );
  const gameplayById = new Map(
    manifest.layers.gameplay.objects.map((object) => [object.id, object]),
  );
  const geometryById = normalizeGeometryObjects(
    geometryInputs(manifest, routeGraph),
  );
  const transitions = normalizeTransitionInputs(
    routeGraph.edges.map((edge) => ({
      schemaVersion: "0.1",
      transitionId: edge.transitionId,
      routeId: routeGraph.routeId,
      fromObjectId: edge.fromObjectId,
      toObjectId: edge.toObjectId,
      fromGlobalIndex: edge.fromRouteIndex,
      toGlobalIndex: edge.toRouteIndex,
      controllerProfileRef: profile.profileId,
    })),
    geometryById,
  );
  const transitionStates = transitions.map((transition) => {
    work.use();
    return classifyCoarseTransition(transition, profile);
  });

  const evidence: EvidenceRecordContract[] = [];
  const pushEvidence = (record: EvidenceRecordContract): void => {
    if (evidence.length + 1 > limits.maxEvidenceRecords) {
      rejectBudget(
        "maximum-evidence-records",
        evidence.length + 1,
        limits.maxEvidenceRecords,
      );
    }
    evidence.push(record);
  };
  const reproduction = (methodId: string, inputHashes: readonly string[]) => ({
    methodId,
    inputHashes: [...new Set(inputHashes)].toSorted(),
  });
  const normalizedGeometry = [...geometryById.values()].toSorted((a, b) =>
    a.objectId.localeCompare(b.objectId),
  );
  const geometryHash = contentHash(
    "normalized-scene-geometry-v1",
    normalizedGeometry,
  );
  const geometryRecord = finishEvidence({
    ...baseEvidence(
      "e1b:geometry:scene",
      "geometry-fact",
      manifest.manifestHash,
      { kind: "scene" },
      [],
      ["Geometry contains deterministic native-primitive normalization."],
    ),
    kind: "geometry-fact",
    payload: {
      kind: "geometry-fact",
      objectIds: normalizedGeometry.map((object) => object.objectId) as [
        string,
        ...string[],
      ],
      factKind: "normalized-object",
      geometryHash,
      reproduction: reproduction("normalize-scene-geometry-v1", [
        manifest.manifestHash,
      ]),
    },
  });
  pushEvidence(geometryRecord);
  const routeRecord = finishEvidence({
    ...baseEvidence(
      "e1b:route-graph",
      "route-graph",
      manifest.manifestHash,
      { kind: "scene" },
      [],
      ["Structural connectivity does not prove physical traversability."],
    ),
    kind: "route-graph",
    payload: {
      kind: "route-graph",
      routeId: routeGraph.routeId,
      stageIds: routeGraph.stages.map((stage) => stage.stageId) as [
        string,
        ...string[],
      ],
      orderedNodeIds: routeGraph.nodes.map((node) => node.objectId) as [
        string,
        string,
        ...string[],
      ],
      orderedTransitionIds: routeGraph.edges.map(
        (edge) => edge.transitionId,
      ) as [string, ...string[]],
      spawnObjectId: routeGraph.spawnObjectId,
      checkpointObjectIds: [...routeGraph.checkpointObjectIds],
      finishObjectId: routeGraph.finishObjectId,
      structuralState: "connected",
      reproduction: reproduction("declared-route-v1", [manifest.manifestHash]),
    },
  });
  pushEvidence(routeRecord);

  const transitionEvidence = transitions.map((transition, index) => {
    const source = requiredValue(
      geometryById.get(transition.fromObjectId),
      transition.fromObjectId,
    );
    const destination = requiredValue(
      geometryById.get(transition.toObjectId),
      transition.toObjectId,
    );
    const sourceGeometryHash = contentHash(
      "normalized-geometry-object-v1",
      source,
    );
    const destinationGeometryHash = contentHash(
      "normalized-geometry-object-v1",
      destination,
    );
    const record = finishEvidence({
      ...baseEvidence(
        `e1b:route-transition:${index}`,
        "route-transition",
        manifest.manifestHash,
        {
          kind: "transition",
          fromObjectId: transition.fromObjectId,
          toObjectId: transition.toObjectId,
          fromGlobalIndex: transition.fromGlobalIndex,
          toGlobalIndex: transition.toGlobalIndex,
        },
        [geometryRecord.evidenceContentHash, routeRecord.evidenceContentHash],
        [
          "AABB and surface-envelope facts are conservative broad-phase inputs.",
        ],
      ),
      kind: "route-transition",
      payload: {
        kind: "route-transition",
        transitionId: transition.transitionId,
        fromObjectId: transition.fromObjectId,
        toObjectId: transition.toObjectId,
        fromGlobalIndex: transition.fromGlobalIndex,
        toGlobalIndex: transition.toGlobalIndex,
        sourceGeometryHash,
        destinationGeometryHash,
        normalizationHash: contentHash("normalized-transition-v1", transition),
        reproduction: reproduction("normalize-route-transition-v1", [
          sourceGeometryHash,
          destinationGeometryHash,
          profile.controllerProfileHash,
        ]),
      },
    });
    pushEvidence(record);
    return record;
  });

  const coarseEvidence = transitionStates.map((result, index) => {
    const transitionRecord = requiredValue(
      transitionEvidence[index],
      result.transition.transitionId,
    );
    const transition = result.transition;
    const record = finishEvidence({
      ...baseEvidence(
        `e1b:coarse-transition:${index}`,
        "coarse-transition-state",
        manifest.manifestHash,
        transitionRecord.subject,
        [transitionRecord.evidenceContentHash],
        result.limitations,
      ),
      kind: "coarse-transition-state",
      payload: {
        kind: "coarse-transition-state",
        metricId: result.metricId,
        resultId: result.resultId,
        transitionId: transition.transitionId,
        fromObjectId: transition.fromObjectId,
        toObjectId: transition.toObjectId,
        controllerProfileId: profile.profileId,
        controllerProfileVersion: profile.profileVersion,
        controllerProfileHash: profile.controllerProfileHash,
        state: result.state,
        horizontalGapStuds: transition.horizontalSeparation.value,
        verticalRiseStuds: transition.verticalRise.value,
        downwardDropStuds: transition.downwardDrop.value,
        sourceSurfaceKind: coarseSurfaceKind(transition.sourceSurface),
        destinationSurfaceKind: coarseSurfaceKind(
          transition.destinationSurface,
        ),
        approximationMethod: transition.horizontalSeparation.method,
        geometryToleranceStuds: transition.horizontalSeparation.toleranceStuds,
        confidenceBasis: result.confidenceBasis,
        reproduction: reproduction("coarse-transition-v1", [
          transitionRecord.evidenceContentHash,
          profile.controllerProfileHash,
        ]),
      },
    });
    pushEvidence(record);
    return record;
  });

  const summaryRecord = finishEvidence({
    ...baseEvidence(
      "e1b:route-playability-summary",
      "route-playability-summary",
      manifest.manifestHash,
      { kind: "scene" },
      [
        routeRecord.evidenceContentHash,
        ...coarseEvidence.map((record) => record.evidenceContentHash),
      ],
      [
        "Clearance is indeterminate because Phase 0 has no overhead route-region metadata.",
        "Counts summarize model-relative states and are not scores.",
      ],
    ),
    kind: "route-playability-summary",
    payload: {
      kind: "route-playability-summary",
      routeId: routeGraph.routeId,
      transitionCount: transitionStates.length,
      feasibleUnderModelCount: transitionStates.filter(
        (result) => result.state === "feasible-under-model",
      ).length,
      coarseInfeasibleTransitionCount: transitionStates.filter(
        (result) => result.state === "infeasible-under-model",
      ).length,
      coarseIndeterminateTransitionCount: transitionStates.filter(
        (result) => result.state === "indeterminate",
      ).length,
      excessiveDropTransitionCount: transitions.filter(
        (transition) =>
          transition.downwardDrop.value >
          profile.maximumDownwardDrop.value +
            profile.tolerancePolicy.comparisonToleranceStuds,
      ).length,
      clearanceEstimateState: "indeterminate-no-overhead-route-metadata",
      reproduction: reproduction("route-playability-summary-v1", [
        routeRecord.evidenceContentHash,
        ...coarseEvidence.map((record) => record.evidenceContentHash),
        profile.controllerProfileHash,
      ]),
    },
  });
  pushEvidence(summaryRecord);

  for (const checkpointId of routeGraph.checkpointObjectIds) {
    work.use();
    const node = requiredValue(routeNodeById.get(checkpointId), checkpointId);
    const object = requiredValue(gameplayById.get(checkpointId), checkpointId);
    const checkpointOrder = requiredValue(
      object.behavior.checkpointOrder,
      checkpointId,
    );
    pushEvidence(
      finishEvidence({
        ...baseEvidence(
          `e1b:checkpoint:${object.behavior.checkpointOrder}`,
          "checkpoint-topology",
          manifest.manifestHash,
          { kind: "object", objectId: checkpointId },
          [routeRecord.evidenceContentHash],
          ["Runtime per-player isolation is not evaluated in E1b."],
        ),
        kind: "checkpoint-topology",
        payload: {
          kind: "checkpoint-topology",
          checkpointObjectId: checkpointId,
          routeId: routeGraph.routeId,
          stageId: node.stageId,
          stageIndex: node.stageIndex,
          routeIndex: node.routeIndex,
          checkpointOrder,
          spawnReachable: true,
          finishReachableAfterCheckpoint:
            node.routeIndex < routeGraph.nodes.length - 1,
          gameplayAuthoritative:
            geometryById.get(checkpointId)?.gameplayAuthoritative === true,
          progressionDirection: "forward",
          progressionStateScope: "per-player",
          runtimeIsolationState: "not-evaluated",
          reproduction: reproduction("checkpoint-topology-v1", [
            routeRecord.evidenceContentHash,
          ]),
        },
      }),
    );
  }

  const coarsePathState = transitionStates.some(
    (result) => result.state === "infeasible-under-model",
  )
    ? "contains-infeasible-under-model"
    : transitionStates.some((result) => result.state === "indeterminate")
      ? "indeterminate"
      : "feasible-under-model";
  const finishNode = requiredValue(
    routeNodeById.get(routeGraph.finishObjectId),
    routeGraph.finishObjectId,
  );
  const finishRecord = finishEvidence({
    ...baseEvidence(
      "e1b:finish",
      "finish-topology",
      manifest.manifestHash,
      { kind: "scene" },
      [
        routeRecord.evidenceContentHash,
        ...coarseEvidence.map((record) => record.evidenceContentHash),
      ],
      ["Coarse path state is model-relative and is not a final approval."],
    ),
    kind: "finish-topology",
    payload: {
      kind: "finish-topology",
      finishObjectId: routeGraph.finishObjectId,
      routeId: routeGraph.routeId,
      routeIndex: finishNode.routeIndex,
      requiredFinishCount: 1,
      onRequiredRoute: true,
      afterAllCheckpoints: routeGraph.checkpointObjectIds.every((id) => {
        const node = requiredValue(
          routeGraph.nodes.find((candidate) => candidate.objectId === id),
          id,
        );
        return node.routeIndex < finishNode.routeIndex;
      }),
      structurallyReachable: true,
      coarsePathState,
      gameplayAuthoritative:
        geometryById.get(routeGraph.finishObjectId)?.gameplayAuthoritative ===
        true,
      reproduction: reproduction("finish-topology-v1", [
        routeRecord.evidenceContentHash,
        ...coarseEvidence.map((record) => record.evidenceContentHash),
      ]),
    },
  });
  pushEvidence(finishRecord);

  const hazardRecords: EvidenceRecordContract[] = [];
  const routeGeometry = routeGraph.nodes.map((node) =>
    requiredValue(geometryById.get(node.objectId), node.objectId),
  );
  for (const hazardId of routeGraph.hazardObjectIds) {
    const hazard = requiredValue(geometryById.get(hazardId), hazardId);
    for (const node of routeGraph.nodes) {
      work.use();
      const routeObject = requiredValue(
        geometryById.get(node.objectId),
        node.objectId,
      );
      if (!overlap(hazard.axisAlignedBounds, routeObject.axisAlignedBounds))
        continue;
      const consumesLandingSurface =
        horizontallyContains(
          hazard.axisAlignedBounds,
          routeObject.axisAlignedBounds,
        ) &&
        hazard.axisAlignedBounds.minimum.y <= routeObject.topSurface.maximumY &&
        hazard.axisAlignedBounds.maximum.y >= routeObject.topSurface.maximumY;
      const record = finishEvidence({
        ...baseEvidence(
          `e1b:hazard:${hazardId}:${node.routeIndex}:${
            consumesLandingSurface ? "consumption" : "overlap"
          }`,
          "hazard-relationship",
          manifest.manifestHash,
          { kind: "scene" },
          [geometryRecord.evidenceContentHash, routeRecord.evidenceContentHash],
          [
            "World AABB overlap is a conservative candidate, not confirmed native-shape collision.",
          ],
        ),
        kind: "hazard-relationship",
        payload: {
          kind: "hazard-relationship",
          hazardObjectId: hazardId,
          routeObjectId: node.objectId,
          relationship: consumesLandingSurface
            ? "landing-surface-fully-consumed"
            : "landing-surface-overlap",
          assessment: "candidate",
          geometryMethod: "world-aabb-broad-phase",
          hazardGameplayAuthoritative: hazard.gameplayAuthoritative,
          reproduction: reproduction("hazard-relationship-v1", [geometryHash]),
        },
      });
      pushEvidence(record);
      hazardRecords.push(record);
    }
    const consistentKillFloor =
      routeGeometry.every(
        (object) =>
          hazard.axisAlignedBounds.minimum.x <=
            object.axisAlignedBounds.minimum.x &&
          hazard.axisAlignedBounds.maximum.x >=
            object.axisAlignedBounds.maximum.x &&
          hazard.axisAlignedBounds.minimum.z <=
            object.axisAlignedBounds.minimum.z &&
          hazard.axisAlignedBounds.maximum.z >=
            object.axisAlignedBounds.maximum.z,
      ) &&
      hazard.axisAlignedBounds.maximum.y <
        Math.min(
          ...routeGeometry.map((object) => object.axisAlignedBounds.minimum.y),
        );
    const boundsRecord = finishEvidence({
      ...baseEvidence(
        `e1b:hazard:${hazardId}:bounds`,
        "hazard-relationship",
        manifest.manifestHash,
        { kind: "scene" },
        [geometryRecord.evidenceContentHash, routeRecord.evidenceContentHash],
        ["Static bounds do not evaluate dynamic hazard behavior."],
      ),
      kind: "hazard-relationship",
      payload: {
        kind: "hazard-relationship",
        hazardObjectId: hazardId,
        relationship: "kill-floor-bounds",
        assessment: consistentKillFloor ? "confirmed" : "not-detected",
        geometryMethod: "world-aabb-broad-phase",
        hazardGameplayAuthoritative: hazard.gameplayAuthoritative,
        reproduction: reproduction("hazard-relationship-v1", [geometryHash]),
      },
    });
    pushEvidence(boundsRecord);
    hazardRecords.push(boundsRecord);

    const enclosureRecord = finishEvidence({
      ...baseEvidence(
        `e1b:hazard:${hazardId}:enclosure`,
        "hazard-relationship",
        manifest.manifestHash,
        { kind: "scene" },
        [geometryRecord.evidenceContentHash, routeRecord.evidenceContentHash],
        [
          "Phase 0 has no required exit-region metadata, so static enclosure is indeterminate.",
        ],
      ),
      kind: "hazard-relationship",
      payload: {
        kind: "hazard-relationship",
        hazardObjectId: hazardId,
        relationship: "structural-enclosure",
        assessment: "indeterminate",
        geometryMethod: "world-aabb-broad-phase",
        hazardGameplayAuthoritative: hazard.gameplayAuthoritative,
        reproduction: reproduction("hazard-relationship-v1", [geometryHash]),
      },
    });
    pushEvidence(enclosureRecord);
    hazardRecords.push(enclosureRecord);
  }

  const skipRecords: EvidenceRecordContract[] = [];
  for (let fromIndex = 0; fromIndex < routeGraph.nodes.length; fromIndex += 1) {
    const intermediateStageIndexes = new Set<number>();
    let bypassesCheckpoint = false;
    for (
      let toIndex = fromIndex + 2;
      toIndex < routeGraph.nodes.length;
      toIndex += 1
    ) {
      work.use();
      const newlyIntermediateNode = requiredValue(
        routeGraph.nodes[toIndex - 1],
        `route-index:${toIndex - 1}`,
      );
      intermediateStageIndexes.add(newlyIntermediateNode.stageIndex);
      bypassesCheckpoint ||= newlyIntermediateNode.role === "checkpoint";
      const sourceNode = requiredValue(
        routeGraph.nodes[fromIndex],
        `route-index:${fromIndex}`,
      );
      const destinationNode = requiredValue(
        routeGraph.nodes[toIndex],
        `route-index:${toIndex}`,
      );
      const source = requiredValue(
        geometryById.get(sourceNode.objectId),
        sourceNode.objectId,
      );
      const destination = requiredValue(
        geometryById.get(destinationNode.objectId),
        destinationNode.objectId,
      );
      if (!directCandidateFits(source, destination, profile)) continue;
      const skippedStageIndexes = [...intermediateStageIndexes]
        .filter(
          (stageIndex) =>
            stageIndex !== sourceNode.stageIndex &&
            stageIndex !== destinationNode.stageIndex,
        )
        .toSorted((a, b) => a - b);
      const candidateKinds = [
        "non-adjacent-route-edge" as const,
        ...(sourceNode.role === "spawn"
          ? (["spawn-to-late-stage"] as const)
          : []),
        ...(bypassesCheckpoint ? (["checkpoint-bypass"] as const) : []),
        ...(sourceNode.role === "checkpoint" &&
        destinationNode.role === "finish"
          ? (["checkpoint-to-finish"] as const)
          : []),
        ...(skippedStageIndexes.length > 0
          ? (["required-stage-skip"] as const)
          : []),
      ].toSorted() as [SkipCandidateKind, ...SkipCandidateKind[]];
      const record = finishEvidence({
        ...baseEvidence(
          `e1b:skip:${fromIndex}:${toIndex}`,
          "skip-candidate",
          manifest.manifestHash,
          { kind: "scene" },
          [geometryRecord.evidenceContentHash, routeRecord.evidenceContentHash],
          [
            "Broad-phase reach is only a conservative skip candidate; execution is not proven.",
          ],
        ),
        kind: "skip-candidate",
        payload: {
          kind: "skip-candidate",
          candidateId: `skip.${routeGraph.routeId}.${fromIndex}.${toIndex}`,
          fromObjectId: sourceNode.objectId,
          toObjectId: destinationNode.objectId,
          fromRouteIndex: sourceNode.routeIndex,
          toRouteIndex: destinationNode.routeIndex,
          candidateKinds,
          skippedStageIndexes,
          modelState: "candidate",
          geometryMethod: "world-aabb-broad-phase",
          reproduction: reproduction("skip-candidate-v1", [
            geometryHash,
            profile.controllerProfileHash,
          ]),
        },
      });
      pushEvidence(record);
      skipRecords.push(record);
    }
  }

  const softlockRecords = detectStructuralSoftlockCandidates(
    routeGraph,
    work,
  ).map((candidate) => {
    const record = finishEvidence({
      ...baseEvidence(
        `e1b:softlock:${candidate.candidateId}`,
        "softlock-candidate",
        manifest.manifestHash,
        { kind: "scene" },
        [routeRecord.evidenceContentHash],
        ["This is a structural candidate and is not runtime proof."],
      ),
      kind: "softlock-candidate",
      payload: {
        kind: "softlock-candidate",
        candidateId: candidate.candidateId,
        subjectObjectId: candidate.subjectObjectId,
        candidateKind: candidate.candidateKind,
        state: candidate.state,
        reproduction: reproduction("softlock-candidate-v1", [
          routeRecord.evidenceContentHash,
        ]),
      },
    });
    pushEvidence(record);
    return record;
  });

  const findings: Finding[] = [];
  for (const [index, result] of transitionStates.entries()) {
    if (result.state === "feasible-under-model") continue;
    const record = requiredValue(
      coarseEvidence[index],
      result.transition.transitionId,
    );
    findings.push(
      finding(
        findings.length,
        result.state === "indeterminate"
          ? "playability.coarse-transition-indeterminate"
          : "playability.coarse-transition-infeasible-under-model",
        result.state === "indeterminate"
          ? "Coarse transition is indeterminate"
          : "Coarse transition exceeds the selected model",
        result.state === "indeterminate"
          ? "The available deterministic surface model cannot classify this transition."
          : "The transition is infeasible-under-model for the selected provisional controller profile.",
        "warning",
        "heuristic",
        [record.subject],
        [requiredEvidenceId(record)],
        result.limitations,
        [result.metricId],
      ),
    );
  }
  for (const record of hazardRecords) {
    if (
      record.kind !== "hazard-relationship" ||
      record.payload.assessment !== "candidate"
    )
      continue;
    findings.push(
      finding(
        findings.length,
        record.payload.relationship === "landing-surface-fully-consumed"
          ? "hazard.landing-consumption-candidate"
          : "hazard.landing-overlap-candidate",
        record.payload.relationship === "landing-surface-fully-consumed"
          ? "Hazard landing-consumption candidate"
          : "Hazard overlap candidate",
        record.payload.relationship === "landing-surface-fully-consumed"
          ? "Conservative broad-phase bounds indicate that a hazard may fully consume a required landing surface."
          : "Conservative broad-phase bounds indicate a candidate hazard relationship with required route geometry.",
        "warning",
        "heuristic",
        [record.subject],
        [requiredEvidenceId(record)],
        record.limitations,
      ),
    );
  }
  for (const record of skipRecords) {
    if (record.kind !== "skip-candidate") continue;
    findings.push(
      finding(
        findings.length,
        "route.skip-candidate",
        "Required-route skip candidate",
        "A non-adjacent broad-phase edge is a route skip candidate; E1b does not claim it is executable.",
        "warning",
        "heuristic",
        [record.subject],
        [requiredEvidenceId(record)],
        record.limitations,
      ),
    );
  }
  for (const record of softlockRecords) {
    if (record.kind !== "softlock-candidate") continue;
    findings.push(
      finding(
        findings.length,
        "route.structural-softlock-candidate",
        "Structural softlock candidate",
        "A required gameplay node has no declared outgoing route path.",
        "error",
        "deterministic",
        [record.subject],
        [requiredEvidenceId(record)],
        record.limitations,
      ),
    );
  }
  if (checkpointCount > 0) {
    const checkpointEvidenceIds = evidence
      .filter((record) => record.kind === "checkpoint-topology")
      .map(requiredEvidenceId) as [string, ...string[]];
    findings.push(
      finding(
        findings.length,
        "checkpoint.runtime-isolation-missing",
        "Checkpoint runtime isolation is missing evidence",
        "E1b has zero runtime checkpoint/respawn observations, so isolation remains missing-evidence rather than pass.",
        "info",
        "deterministic",
        [{ kind: "scene" }],
        checkpointEvidenceIds,
        [
          "Multiplayer and replaced-scene isolation require future Studio evidence.",
        ],
      ),
    );
  }
  findings.sort((a, b) =>
    `${a.ruleId}\u0000${a.findingId}`.localeCompare(
      `${b.ruleId}\u0000${b.findingId}`,
    ),
  );
  assertValidEvidenceGraph(evidence);
  return {
    routeGraph,
    geometryById,
    transitions,
    transitionStates,
    evidence,
    findings,
  };
}

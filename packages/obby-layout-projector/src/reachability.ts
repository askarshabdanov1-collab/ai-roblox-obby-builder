import { sha256 } from "@obby/canonical-json";
import type {
  PlaceSpecV03GameplayObject,
  PlaceSpecV03Reachability,
} from "@obby/contracts";
import {
  normalizeGeometryObjects,
  normalizeTransitionInput,
  type ConservativeMeasurement,
  type NormalizedGeometryObject,
} from "@obby/geometry-evaluator";
import type { LayoutSpec } from "@obby/obby-layout-contracts";
import {
  classifyCoarseTransition,
  coarseSurfaceKind,
  landingRegionForSurface,
  type AvailableTransitionMeasurement,
  type CoarseTransitionInput,
  type CoarseTransitionResult,
} from "@obby/route-playability-evaluator";

import { LayoutProjectionError } from "./types.js";

type ControllerProfile = Parameters<typeof classifyCoarseTransition>[1];
type Classifier = (
  input: CoarseTransitionInput,
  profile: ControllerProfile,
) => CoarseTransitionResult;

const available = (
  measurement: ConservativeMeasurement,
): AvailableTransitionMeasurement => ({
  ...measurement,
  status: "available",
  evidenceHashes: [],
});

function geometryInput(
  object: LayoutSpec["objects"][number],
  routeId: string,
  globalIndexById: ReadonlyMap<string, number>,
  stageIndexBySourceId: ReadonlyMap<string, number>,
) {
  const globalIndex = globalIndexById.get(object.objectId);
  const sourceStageId = object.sourceReferences.sourceStageId;
  const stageIndex =
    sourceStageId === undefined
      ? undefined
      : stageIndexBySourceId.get(sourceStageId);
  return {
    schemaVersion: "0.1" as const,
    objectId: object.objectId,
    shape: object.shape,
    authority: object.authority,
    collision: {
      canCollide: object.collision.canCollide,
      canTouch: object.collision.canTouch,
      canQuery: object.collision.canQuery,
    },
    gameplayOwnership: "native-part" as const,
    promotionStatus: "not-applicable" as const,
    transform: object.transform,
    size: object.size,
    ...(globalIndex === undefined
      ? {}
      : {
          safeRouteRef: {
            routeId,
            ...(sourceStageId === undefined ? {} : { stageId: sourceStageId }),
            ...(stageIndex === undefined ? {} : { stageIndex }),
            globalIndex,
          },
        }),
  };
}

export function normalizeLayoutGeometry(
  layout: LayoutSpec,
): ReadonlyMap<string, NormalizedGeometryObject> {
  const route = ["Spawn", ...layout.route.orderedObjectIds];
  const globalIndexById = new Map(route.map((id, index) => [id, index]));
  const stageIndexBySourceId = new Map(
    layout.stages.map((stage, index) => [stage.sourceStageId, index]),
  );
  const normalized = normalizeGeometryObjects(
    layout.objects.map((object) =>
      geometryInput(
        object,
        layout.route.routeLayoutId,
        globalIndexById,
        stageIndexBySourceId,
      ),
    ),
  );
  return normalized;
}

export function geometrySummary(
  object: NormalizedGeometryObject,
): PlaceSpecV03GameplayObject["geometry"] {
  return {
    methodId: "geometry-evaluator-v0.1",
    normalizedGeometryHash: sha256({
      domain: "g1c-normalized-geometry-v1",
      normalizedGeometry: object,
    }),
    axisAlignedBounds: object.axisAlignedBounds,
    topSurfaceMaximumY: object.topSurface.maximumY,
    surfaceKind: coarseSurfaceKind(object.topSurface),
  };
}

export function buildReachabilityEvidence(
  layout: LayoutSpec,
  geometryById: ReadonlyMap<string, NormalizedGeometryObject>,
  controllerProfile: ControllerProfile,
  classifier: Classifier = classifyCoarseTransition,
): PlaceSpecV03Reachability {
  const route = ["Spawn", ...layout.route.orderedObjectIds];
  const requiredTransitions = layout.route.orderedObjectIds.map(
    (toObjectId, index) => {
      const fromObjectId = route[index];
      const source =
        fromObjectId === undefined ? undefined : geometryById.get(fromObjectId);
      const destination = geometryById.get(toObjectId);
      if (
        fromObjectId === undefined ||
        source === undefined ||
        destination === undefined
      )
        throw new LayoutProjectionError(
          "invalid-reference",
          `required transition ${index + 1} has an unresolved gameplay endpoint`,
        );
      const transitionId = `layout-transition-${String(index + 1).padStart(3, "0")}`;
      const normalized = normalizeTransitionInput(
        {
          schemaVersion: "0.1",
          transitionId: `route:${layout.route.routeLayoutId}/${fromObjectId}/${toObjectId}/${index}/${index + 1}`,
          routeId: layout.route.routeLayoutId,
          fromObjectId,
          toObjectId,
          fromGlobalIndex: index,
          toGlobalIndex: index + 1,
          controllerProfileRef: controllerProfile.profileId,
        },
        geometryById,
      );
      const classifierInput: CoarseTransitionInput = {
        ...normalized,
        horizontalSeparation: available(normalized.horizontalSeparation),
        verticalRise: available(normalized.verticalRise),
        downwardDrop: available(normalized.downwardDrop),
        landingRegion: landingRegionForSurface(normalized.destinationSurface),
      };
      const result = classifier(classifierInput, controllerProfile);
      if (result.state === "indeterminate")
        throw new LayoutProjectionError(
          "reachability-indeterminate",
          `${transitionId} is indeterminate under the configured coarse model`,
        );
      if (result.state === "infeasible-under-model")
        throw new LayoutProjectionError(
          "reachability-infeasible",
          `${transitionId} is infeasible under the configured coarse model`,
        );
      const sourceTransition = layout.reachability.requiredTransitions[index];
      if (
        sourceTransition === undefined ||
        sourceTransition.transitionLayoutId !== transitionId ||
        sourceTransition.normalizedInputHash !==
          result.reproduction.normalizedInputHash
      )
        throw new LayoutProjectionError(
          "stale-provenance",
          `${transitionId} does not match the authoritative G1b reachability evidence`,
        );
      const inputs = result.reproduction.normalizedInputs;
      if (
        inputs.horizontalSeparation.status !== "available" ||
        inputs.verticalRise.status !== "available" ||
        inputs.downwardDrop.status !== "available" ||
        inputs.landingRegion.status !== "available"
      )
        throw new LayoutProjectionError(
          "reachability-indeterminate",
          `${transitionId} lacks complete deterministic reachability evidence`,
        );
      const withoutHashes = <T extends { evidenceHashes: readonly string[] }>(
        measurement: T,
      ): Omit<T, "evidenceHashes"> => {
        const { evidenceHashes: _excluded, ...value } = measurement;
        return value;
      };
      return {
        transitionId,
        fromObjectId,
        toObjectId,
        fromGlobalOrder: index,
        toGlobalOrder: index + 1,
        outcome: "feasible-under-model" as const,
        normalizedInputHash: result.reproduction.normalizedInputHash,
        horizontalSeparation: withoutHashes(inputs.horizontalSeparation),
        verticalRise: withoutHashes(inputs.verticalRise),
        downwardDrop: withoutHashes(inputs.downwardDrop),
        landingRegion: inputs.landingRegion,
        sourceSurfaceKind: inputs.sourceSurfaceKind,
        destinationSurfaceKind: inputs.destinationSurfaceKind,
        limitations: result.limitations as [string, ...string[]],
      };
    },
  );
  return {
    modelId: "e1-coarse-surface-transition-v1",
    methodId: "coarse-transition-classifier",
    methodVersion: "2.0.0",
    controllerProfileRef: {
      profileId: controllerProfile.profileId,
      profileVersion: controllerProfile.profileVersion,
      controllerProfileHash: controllerProfile.controllerProfileHash,
    },
    overallOutcome: "feasible-under-model",
    requiredTransitions:
      requiredTransitions as PlaceSpecV03Reachability["requiredTransitions"],
  };
}

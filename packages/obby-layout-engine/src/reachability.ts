import {
  normalizeGeometryObjects,
  normalizeTransitionInput,
  type ConservativeMeasurement,
} from "@obby/geometry-evaluator";
import type { LayoutObject, LayoutSpec } from "@obby/obby-layout-contracts";
import {
  classifyCoarseTransition,
  type AvailableTransitionMeasurement,
  type CoarseTransitionInput,
} from "@obby/route-playability-evaluator";

import { LayoutEngineError } from "./types.js";

type ControllerProfile = Parameters<typeof classifyCoarseTransition>[1];

const available = (
  measurement: ConservativeMeasurement,
): AvailableTransitionMeasurement => ({
  ...measurement,
  status: "available",
  evidenceHashes: [],
});

export function assessRequiredRoute(
  routeId: string,
  orderedObjectIds: readonly string[],
  objects: readonly LayoutObject[],
  stages: readonly LayoutSpec["stages"][number][],
  controllerProfile: ControllerProfile,
): LayoutSpec["reachability"] {
  const byId = new Map(objects.map((object) => [object.objectId, object]));
  const stageIndexById = new Map(
    stages.map((stage, index) => [stage.sourceStageId, index]),
  );
  const routeWithSpawn = ["Spawn", ...orderedObjectIds];
  const globalIndex = new Map(routeWithSpawn.map((id, index) => [id, index]));
  const geometry = normalizeGeometryObjects(
    routeWithSpawn.map((objectId) => {
      const object = byId.get(objectId);
      if (object === undefined)
        throw new LayoutEngineError(
          "invariant",
          `required route object ${objectId} is missing`,
        );
      const sourceStageId = object.sourceReferences.sourceStageId;
      const stageIndex =
        sourceStageId === undefined
          ? undefined
          : stageIndexById.get(sourceStageId);
      const objectGlobalIndex = globalIndex.get(objectId);
      if (objectGlobalIndex === undefined)
        throw new LayoutEngineError(
          "invariant",
          `required route object ${objectId} has no global order`,
        );
      if (sourceStageId !== undefined && stageIndex === undefined)
        throw new LayoutEngineError(
          "invariant",
          `required route object ${objectId} has no source stage order`,
        );
      return {
        schemaVersion: "0.1",
        objectId: object.objectId,
        shape: object.shape,
        authority: object.authority,
        collision: {
          canCollide: object.collision.canCollide,
          canTouch: object.collision.canTouch,
          canQuery: object.collision.canQuery,
        },
        gameplayOwnership: "native-part",
        promotionStatus: "not-applicable",
        transform: object.transform,
        size: object.size,
        safeRouteRef: {
          routeId,
          ...(sourceStageId === undefined ? {} : { stageId: sourceStageId }),
          ...(stageIndex === undefined ? {} : { stageIndex }),
          globalIndex: objectGlobalIndex,
        },
      };
    }),
  );
  const requiredTransitions = orderedObjectIds.map((toObjectId, index) => {
    const fromObjectId = routeWithSpawn[index];
    if (fromObjectId === undefined)
      throw new LayoutEngineError(
        "invariant",
        `required route source is missing at ${index}`,
      );
    const transitionId = `layout-transition-${String(index + 1).padStart(3, "0")}`;
    const classifierTransitionId = `route:${routeId}/${fromObjectId}/${toObjectId}/${index}/${index + 1}`;
    const normalized = normalizeTransitionInput(
      {
        schemaVersion: "0.1",
        transitionId: classifierTransitionId,
        routeId,
        fromObjectId,
        toObjectId,
        fromGlobalIndex: index,
        toGlobalIndex: index + 1,
        controllerProfileRef: controllerProfile.profileId,
      },
      geometry,
    );
    const classifierInput: CoarseTransitionInput = {
      ...normalized,
      horizontalSeparation: available(normalized.horizontalSeparation),
      verticalRise: available(normalized.verticalRise),
      downwardDrop: available(normalized.downwardDrop),
    };
    const result = classifyCoarseTransition(classifierInput, controllerProfile);
    if (result.state === "indeterminate")
      throw new LayoutEngineError(
        "reachability-indeterminate",
        `${transitionId} is indeterminate under the configured model`,
      );
    if (result.state === "infeasible-under-model")
      throw new LayoutEngineError(
        "reachability-infeasible",
        `${transitionId} is infeasible under the configured model`,
      );
    return {
      transitionLayoutId: transitionId,
      fromObjectId,
      toObjectId,
      fromGlobalOrder: index,
      toGlobalOrder: index + 1,
      outcome: "feasible-under-model" as const,
      normalizedInputHash: result.reproduction.normalizedInputHash,
    };
  });
  return {
    modelId: "e1-coarse-surface-transition-v1",
    methodId: "coarse-transition-classifier",
    methodVersion: "2.0.0",
    controllerProfileRef: {
      profileId: controllerProfile.profileId,
      profileVersion: controllerProfile.profileVersion,
      controllerProfileHash:
        controllerProfile.controllerProfileHash as `sha256:${string}`,
    },
    overallOutcome: "feasible-under-model",
    requiredTransitions:
      requiredTransitions as LayoutSpec["reachability"]["requiredTransitions"],
  };
}

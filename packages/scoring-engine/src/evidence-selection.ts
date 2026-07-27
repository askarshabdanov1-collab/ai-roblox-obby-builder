import { compareUnicodeScalars } from "@obby/canonical-json";
import type {
  EvidenceKind,
  EvidenceRecordContract,
} from "@obby/obby-evaluator-contracts";

import { ScoringContractError } from "./types.js";

export type EvidenceSelection = {
  routeGraph: EvidenceRecordContract | undefined;
  summary: EvidenceRecordContract | undefined;
  geometry: EvidenceRecordContract | undefined;
  transitions: EvidenceRecordContract[];
  coarseTransitions: EvidenceRecordContract[];
  checkpoints: EvidenceRecordContract[];
  finishes: EvidenceRecordContract[];
  hazards: EvidenceRecordContract[];
  skips: EvidenceRecordContract[];
};

type ChargeWork = (units?: number) => void;

function sortingWorkUnits(length: number): number {
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new ScoringContractError(
      "invalid-work-size",
      "sorting work length must be a non-negative safe integer",
    );
  }
  const comparisonsPerItem = Math.ceil(Math.log2(Math.max(1, length)));
  if (
    comparisonsPerItem !== 0 &&
    length > Math.floor(Number.MAX_SAFE_INTEGER / comparisonsPerItem)
  ) {
    throw new ScoringContractError(
      "maximum-work-units",
      "sorting work exceeds the safe integer range",
    );
  }
  return length * comparisonsPerItem;
}

function recordsOfKind(
  evidence: readonly EvidenceRecordContract[],
  kind: EvidenceKind,
  charge: ChargeWork,
): EvidenceRecordContract[] {
  charge(evidence.length);
  return evidence.filter((record) => record.kind === kind);
}

function optionalSingleton(
  evidence: readonly EvidenceRecordContract[],
  kind: EvidenceKind,
  charge: ChargeWork,
): EvidenceRecordContract | undefined {
  const records = recordsOfKind(evidence, kind, charge);
  if (records.length > 1) {
    throw new ScoringContractError(
      "conflicting-evidence",
      `expected at most one ${kind} evidence record, received ${records.length}`,
    );
  }
  return records[0];
}

function sameSet(
  left: readonly string[],
  right: readonly string[],
  charge: ChargeWork,
): boolean {
  charge(left.length);
  const leftSet = new Set(left);
  charge(right.length);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size) return false;
  charge(rightSet.size);
  return [...rightSet].every((value) => leftSet.has(value));
}

function requireParents(
  record: EvidenceRecordContract,
  expected: readonly string[],
  charge: ChargeWork,
): void {
  if (!sameSet(record.parentEvidenceHashes, expected, charge)) {
    throw new ScoringContractError(
      "evidence-parent-closure",
      `${record.kind} ${record.evidenceContentHash} is outside the authoritative parent closure`,
    );
  }
}

function requireSceneSubject(record: EvidenceRecordContract): void {
  if (record.subject.kind !== "scene") {
    throw new ScoringContractError(
      "evidence-subject-mismatch",
      `${record.kind} ${record.evidenceContentHash} requires the scene subject`,
    );
  }
}

function requireKnownObject(
  objectIds: ReadonlySet<string>,
  objectId: string,
  context: string,
): void {
  if (!objectIds.has(objectId)) {
    throw new ScoringContractError(
      "unknown-evidence-object",
      `${context} references unknown manifest object ${objectId}`,
    );
  }
}

function uniqueSemanticRecords(
  records: readonly EvidenceRecordContract[],
  key: (record: EvidenceRecordContract) => string,
  context: string,
  charge: ChargeWork,
): EvidenceRecordContract[] {
  const seen = new Map<string, EvidenceRecordContract>();
  for (const record of records) {
    charge(2);
    const semanticKey = key(record);
    if (seen.has(semanticKey)) {
      throw new ScoringContractError(
        "conflicting-evidence-coverage",
        `${context} has conflicting coverage for ${semanticKey}`,
      );
    }
    seen.set(semanticKey, record);
  }
  charge(sortingWorkUnits(records.length));
  return [...records].toSorted((left, right) =>
    compareUnicodeScalars(left.evidenceContentHash, right.evidenceContentHash),
  );
}

export function selectAuthoritativeE1Evidence(
  evidence: readonly EvidenceRecordContract[],
  charge: ChargeWork = () => undefined,
): EvidenceSelection {
  const routeGraph = optionalSingleton(evidence, "route-graph", charge);
  const summary = optionalSingleton(
    evidence,
    "route-playability-summary",
    charge,
  );
  const geometry = optionalSingleton(evidence, "geometry-fact", charge);
  const suppliedTransitions = recordsOfKind(
    evidence,
    "route-transition",
    charge,
  );
  const suppliedCoarse = recordsOfKind(
    evidence,
    "coarse-transition-state",
    charge,
  );
  const suppliedCheckpoints = recordsOfKind(
    evidence,
    "checkpoint-topology",
    charge,
  );
  const suppliedFinishes = recordsOfKind(evidence, "finish-topology", charge);
  const suppliedHazards = recordsOfKind(
    evidence,
    "hazard-relationship",
    charge,
  );
  const suppliedSkips = recordsOfKind(evidence, "skip-candidate", charge);

  if (
    routeGraph?.payload.kind !== "route-graph" ||
    geometry?.payload.kind !== "geometry-fact"
  ) {
    return {
      routeGraph,
      summary,
      geometry,
      transitions: [],
      coarseTransitions: [],
      checkpoints: [],
      finishes: [],
      hazards: [],
      skips: [],
    };
  }

  requireSceneSubject(routeGraph);
  requireSceneSubject(geometry);
  const route = routeGraph.payload;
  const geometryPayload = geometry.payload;
  const objectIds = new Set(geometryPayload.objectIds);
  const routeIndexes = new Map(
    route.orderedNodeIds.map((objectId, index) => [objectId, index]),
  );
  charge(route.orderedNodeIds.length * 2);
  for (const objectId of route.orderedNodeIds) {
    requireKnownObject(objectIds, objectId, "required route");
  }

  const transitionById = new Map<string, EvidenceRecordContract>();
  const transitionByHash = new Map<string, EvidenceRecordContract>();
  for (const record of suppliedTransitions) {
    charge(3);
    if (record.payload.kind !== "route-transition") continue;
    const payload = record.payload;
    requireKnownObject(objectIds, payload.fromObjectId, "route transition");
    requireKnownObject(objectIds, payload.toObjectId, "route transition");
    if (
      record.subject.kind !== "transition" ||
      record.subject.fromObjectId !== payload.fromObjectId ||
      record.subject.toObjectId !== payload.toObjectId ||
      record.subject.fromGlobalIndex !== payload.fromGlobalIndex ||
      record.subject.toGlobalIndex !== payload.toGlobalIndex
    ) {
      throw new ScoringContractError(
        "transition-subject-mismatch",
        `transition ${payload.transitionId} has a mismatched subject`,
      );
    }
    requireParents(
      record,
      [routeGraph.evidenceContentHash, geometry.evidenceContentHash],
      charge,
    );
    if (
      transitionById.has(payload.transitionId) ||
      transitionByHash.has(record.evidenceContentHash)
    ) {
      throw new ScoringContractError(
        "conflicting-evidence-coverage",
        `route transition ${payload.transitionId} has duplicate identity coverage`,
      );
    }
    transitionById.set(payload.transitionId, record);
    transitionByHash.set(record.evidenceContentHash, record);
  }
  const transitions: EvidenceRecordContract[] = [];
  for (let index = 0; index < route.orderedTransitionIds.length; index += 1) {
    charge();
    const transitionId = route.orderedTransitionIds[index];
    if (transitionId === undefined) continue;
    const record = transitionById.get(transitionId);
    if (record?.payload.kind !== "route-transition") {
      continue;
    }
    const expectedFrom = route.orderedNodeIds[index];
    const expectedTo = route.orderedNodeIds[index + 1];
    if (
      record.payload.fromObjectId !== expectedFrom ||
      record.payload.toObjectId !== expectedTo ||
      record.payload.fromGlobalIndex !== index ||
      record.payload.toGlobalIndex !== index + 1
    ) {
      throw new ScoringContractError(
        "transition-route-mismatch",
        `required transition ${transitionId} does not match route position ${index}`,
      );
    }
    transitions.push(record);
  }

  const selectedTransitionHashes = new Set(
    transitions.map((record) => record.evidenceContentHash),
  );
  const coarseByTransition = new Map<string, EvidenceRecordContract>();
  for (const record of suppliedCoarse) {
    charge(2);
    if (record.payload.kind !== "coarse-transition-state") continue;
    requireKnownObject(
      objectIds,
      record.payload.fromObjectId,
      "coarse transition",
    );
    requireKnownObject(
      objectIds,
      record.payload.toObjectId,
      "coarse transition",
    );
    const parent = record.parentEvidenceHashes[0];
    if (record.parentEvidenceHashes.length !== 1 || parent === undefined) {
      throw new ScoringContractError(
        "evidence-parent-closure",
        `coarse transition ${record.payload.transitionId} requires one transition parent`,
      );
    }
    const transition = transitionByHash.get(parent);
    if (
      transition?.payload.kind !== "route-transition" ||
      transition.payload.transitionId !== record.payload.transitionId ||
      transition.subject.kind !== "transition" ||
      record.subject.kind !== "transition" ||
      JSON.stringify(transition.subject) !== JSON.stringify(record.subject)
    ) {
      throw new ScoringContractError(
        "coarse-transition-parent-mismatch",
        `coarse transition ${record.payload.transitionId} does not bind its transition subject`,
      );
    }
    if (selectedTransitionHashes.has(parent)) {
      if (coarseByTransition.has(record.payload.transitionId)) {
        throw new ScoringContractError(
          "conflicting-evidence-coverage",
          `required transition ${record.payload.transitionId} has conflicting coarse states`,
        );
      }
      coarseByTransition.set(record.payload.transitionId, record);
    }
  }
  const coarseTransitions: EvidenceRecordContract[] = [];
  for (const transition of transitions) {
    charge();
    if (transition.payload.kind !== "route-transition") continue;
    const record = coarseByTransition.get(transition.payload.transitionId);
    if (record !== undefined) coarseTransitions.push(record);
  }

  if (summary !== undefined) {
    if (summary.payload.kind !== "route-playability-summary") {
      throw new ScoringContractError(
        "evidence-kind-mismatch",
        "route playability summary payload has the wrong kind",
      );
    }
    requireSceneSubject(summary);
    if (summary.payload.routeId !== route.routeId) {
      throw new ScoringContractError(
        "route-subject-mismatch",
        "route playability summary references the wrong route",
      );
    }
    requireParents(
      summary,
      [
        routeGraph.evidenceContentHash,
        ...coarseTransitions.map((record) => record.evidenceContentHash),
      ],
      charge,
    );
  }

  const declaredCheckpointIds = new Set(route.checkpointObjectIds);
  charge(route.checkpointObjectIds.length);
  const checkpointById = new Map<string, EvidenceRecordContract>();
  for (const record of suppliedCheckpoints) {
    charge(3);
    if (record.payload.kind !== "checkpoint-topology") continue;
    requireKnownObject(
      objectIds,
      record.payload.checkpointObjectId,
      "checkpoint topology",
    );
    if (!declaredCheckpointIds.has(record.payload.checkpointObjectId)) {
      throw new ScoringContractError(
        "unexpected-checkpoint-evidence",
        `checkpoint ${record.payload.checkpointObjectId} is not declared by the required route`,
      );
    }
    if (checkpointById.has(record.payload.checkpointObjectId)) {
      throw new ScoringContractError(
        "conflicting-evidence-coverage",
        `checkpoint ${record.payload.checkpointObjectId} has duplicate topology records`,
      );
    }
    checkpointById.set(record.payload.checkpointObjectId, record);
  }
  const checkpoints: EvidenceRecordContract[] = [];
  for (let order = 0; order < route.checkpointObjectIds.length; order += 1) {
    charge(2);
    const checkpointId = route.checkpointObjectIds[order];
    if (checkpointId === undefined) continue;
    const routeIndex = routeIndexes.get(checkpointId);
    if (routeIndex === undefined) {
      throw new ScoringContractError(
        "checkpoint-route-mismatch",
        `checkpoint ${checkpointId} is absent from the required route`,
      );
    }
    const record = checkpointById.get(checkpointId);
    if (record?.payload.kind !== "checkpoint-topology") {
      continue;
    }
    if (
      record.subject.kind !== "object" ||
      record.subject.objectId !== checkpointId ||
      record.payload.routeId !== route.routeId ||
      record.payload.checkpointOrder !== order + 1 ||
      record.payload.routeIndex !== routeIndex
    ) {
      throw new ScoringContractError(
        "checkpoint-subject-mismatch",
        `checkpoint ${checkpointId} does not match required route coverage`,
      );
    }
    requireParents(record, [routeGraph.evidenceContentHash], charge);
    checkpoints.push(record);
  }

  const matchingFinishes: EvidenceRecordContract[] = [];
  for (const record of suppliedFinishes) {
    charge();
    if (
      record.payload.kind === "finish-topology" &&
      record.payload.finishObjectId === route.finishObjectId
    ) {
      matchingFinishes.push(record);
    }
  }
  if (matchingFinishes.length > 1 || suppliedFinishes.length > 1) {
    throw new ScoringContractError(
      "conflicting-evidence-coverage",
      `finish ${route.finishObjectId} has conflicting topology records`,
    );
  }
  const finish = matchingFinishes[0];
  if (finish?.payload.kind === "finish-topology") {
    const finishRouteIndex = routeIndexes.get(route.finishObjectId);
    if (finishRouteIndex === undefined) {
      throw new ScoringContractError(
        "finish-route-mismatch",
        `finish ${route.finishObjectId} is absent from the required route`,
      );
    }
    requireSceneSubject(finish);
    if (
      finish.payload.routeId !== route.routeId ||
      finish.payload.routeIndex !== finishRouteIndex
    ) {
      throw new ScoringContractError(
        "finish-subject-mismatch",
        `finish ${route.finishObjectId} does not match the required route`,
      );
    }
    requireParents(
      finish,
      [
        routeGraph.evidenceContentHash,
        ...coarseTransitions.map((record) => record.evidenceContentHash),
      ],
      charge,
    );
  }

  const validatedHazards = uniqueSemanticRecords(
    suppliedHazards.map((record) => {
      if (record.payload.kind !== "hazard-relationship") return record;
      requireSceneSubject(record);
      requireKnownObject(
        objectIds,
        record.payload.hazardObjectId,
        "hazard relationship",
      );
      if (record.payload.routeObjectId !== undefined) {
        requireKnownObject(
          objectIds,
          record.payload.routeObjectId,
          "hazard route relationship",
        );
      }
      requireParents(
        record,
        [routeGraph.evidenceContentHash, geometry.evidenceContentHash],
        charge,
      );
      return record;
    }),
    (record) =>
      record.payload.kind === "hazard-relationship"
        ? `${record.payload.hazardObjectId}:${record.payload.relationship}`
        : record.evidenceContentHash,
    "hazard evidence",
    charge,
  );
  const hazards = validatedHazards.filter((record) => {
    charge();
    if (record.payload.kind !== "hazard-relationship") return false;
    const payload = record.payload;
    const routeRelationship =
      payload.relationship === "landing-surface-fully-consumed" ||
      payload.relationship === "landing-surface-overlap";
    const routeIndex =
      payload.routeObjectId === undefined
        ? undefined
        : routeIndexes.get(payload.routeObjectId);
    if (routeRelationship && routeIndex === undefined) return false;
    const expectedSuffix =
      payload.relationship === "kill-floor-bounds"
        ? "bounds"
        : payload.relationship === "structural-enclosure"
          ? "enclosure"
          : payload.routeObjectId === undefined
            ? undefined
            : `${routeIndex}:${
                payload.relationship === "landing-surface-fully-consumed"
                  ? "consumption"
                  : payload.relationship === "landing-surface-overlap"
                    ? "overlap"
                    : "unsupported"
              }`;
    return (
      expectedSuffix !== undefined &&
      !expectedSuffix.endsWith(":unsupported") &&
      record.evidenceId ===
        `e1b:hazard:${payload.hazardObjectId}:${expectedSuffix}`
    );
  });

  const validatedSkips = uniqueSemanticRecords(
    suppliedSkips.map((record) => {
      if (record.payload.kind !== "skip-candidate") return record;
      requireSceneSubject(record);
      requireKnownObject(
        objectIds,
        record.payload.fromObjectId,
        "skip candidate",
      );
      requireKnownObject(
        objectIds,
        record.payload.toObjectId,
        "skip candidate",
      );
      if (
        routeIndexes.get(record.payload.fromObjectId) !==
          record.payload.fromRouteIndex ||
        routeIndexes.get(record.payload.toObjectId) !==
          record.payload.toRouteIndex
      ) {
        throw new ScoringContractError(
          "skip-route-mismatch",
          `skip candidate ${record.payload.candidateId} has the wrong route indexes`,
        );
      }
      requireParents(
        record,
        [routeGraph.evidenceContentHash, geometry.evidenceContentHash],
        charge,
      );
      return record;
    }),
    (record) =>
      record.payload.kind === "skip-candidate"
        ? `${record.payload.candidateId}:${record.payload.fromObjectId}:${record.payload.toObjectId}`
        : record.evidenceContentHash,
    "skip evidence",
    charge,
  );
  const skips = validatedSkips.filter((record) => {
    charge();
    return (
      record.payload.kind === "skip-candidate" &&
      record.evidenceId ===
        `e1b:skip:${record.payload.fromRouteIndex}:${record.payload.toRouteIndex}`
    );
  });

  charge(sortingWorkUnits(transitions.length));
  const sortedTransitions = transitions.toSorted((left, right) =>
    compareUnicodeScalars(left.evidenceContentHash, right.evidenceContentHash),
  );
  charge(sortingWorkUnits(coarseTransitions.length));
  const sortedCoarseTransitions = coarseTransitions.toSorted((left, right) =>
    compareUnicodeScalars(left.evidenceContentHash, right.evidenceContentHash),
  );

  return {
    routeGraph,
    summary,
    geometry,
    transitions: sortedTransitions,
    coarseTransitions: sortedCoarseTransitions,
    checkpoints,
    finishes: finish === undefined ? [] : [finish],
    hazards,
    skips,
  };
}

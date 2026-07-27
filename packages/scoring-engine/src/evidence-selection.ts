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

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    [...new Set(left)].toSorted(compareUnicodeScalars).join("\u0000") ===
    [...new Set(right)].toSorted(compareUnicodeScalars).join("\u0000")
  );
}

function requireParents(
  record: EvidenceRecordContract,
  expected: readonly string[],
): void {
  if (!sameSet(record.parentEvidenceHashes, expected)) {
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
): EvidenceRecordContract[] {
  const seen = new Map<string, EvidenceRecordContract>();
  for (const record of records) {
    const semanticKey = key(record);
    if (seen.has(semanticKey)) {
      throw new ScoringContractError(
        "conflicting-evidence-coverage",
        `${context} has conflicting coverage for ${semanticKey}`,
      );
    }
    seen.set(semanticKey, record);
  }
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
  for (const objectId of route.orderedNodeIds) {
    requireKnownObject(objectIds, objectId, "required route");
  }

  const transitionById = new Map<string, EvidenceRecordContract[]>();
  for (const record of suppliedTransitions) {
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
    requireParents(record, [
      routeGraph.evidenceContentHash,
      geometry.evidenceContentHash,
    ]);
    transitionById.set(payload.transitionId, [
      ...(transitionById.get(payload.transitionId) ?? []),
      record,
    ]);
  }
  const transitions: EvidenceRecordContract[] = [];
  for (let index = 0; index < route.orderedTransitionIds.length; index += 1) {
    const transitionId = route.orderedTransitionIds[index];
    if (transitionId === undefined) continue;
    const candidates = transitionById.get(transitionId) ?? [];
    if (candidates.length > 1) {
      throw new ScoringContractError(
        "conflicting-evidence-coverage",
        `required transition ${transitionId} has ${candidates.length} records`,
      );
    }
    const record = candidates[0];
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
  const coarseByTransition = new Map<string, EvidenceRecordContract[]>();
  for (const record of suppliedCoarse) {
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
    const transition = suppliedTransitions.find(
      (candidate) => candidate.evidenceContentHash === parent,
    );
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
      coarseByTransition.set(record.payload.transitionId, [
        ...(coarseByTransition.get(record.payload.transitionId) ?? []),
        record,
      ]);
    }
  }
  const coarseTransitions: EvidenceRecordContract[] = [];
  for (const transition of transitions) {
    if (transition.payload.kind !== "route-transition") continue;
    const candidates =
      coarseByTransition.get(transition.payload.transitionId) ?? [];
    if (candidates.length > 1) {
      throw new ScoringContractError(
        "conflicting-evidence-coverage",
        `required transition ${transition.payload.transitionId} has conflicting coarse states`,
      );
    }
    const record = candidates[0];
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
    requireParents(summary, [
      routeGraph.evidenceContentHash,
      ...coarseTransitions.map((record) => record.evidenceContentHash),
    ]);
  }

  const checkpoints: EvidenceRecordContract[] = [];
  for (let order = 0; order < route.checkpointObjectIds.length; order += 1) {
    const checkpointId = route.checkpointObjectIds[order];
    if (checkpointId === undefined) continue;
    const candidates = suppliedCheckpoints.filter(
      (record) =>
        record.payload.kind === "checkpoint-topology" &&
        record.payload.checkpointObjectId === checkpointId,
    );
    if (candidates.length > 1) {
      throw new ScoringContractError(
        "conflicting-evidence-coverage",
        `checkpoint ${checkpointId} has duplicate topology records`,
      );
    }
    const record = candidates[0];
    if (record?.payload.kind !== "checkpoint-topology") {
      continue;
    }
    if (
      record.subject.kind !== "object" ||
      record.subject.objectId !== checkpointId ||
      record.payload.routeId !== route.routeId ||
      record.payload.checkpointOrder !== order + 1 ||
      record.payload.routeIndex !== routeIndexes.get(checkpointId)
    ) {
      throw new ScoringContractError(
        "checkpoint-subject-mismatch",
        `checkpoint ${checkpointId} does not match required route coverage`,
      );
    }
    requireParents(record, [routeGraph.evidenceContentHash]);
    checkpoints.push(record);
  }
  for (const record of suppliedCheckpoints) {
    if (record.payload.kind !== "checkpoint-topology") continue;
    requireKnownObject(
      objectIds,
      record.payload.checkpointObjectId,
      "checkpoint topology",
    );
    if (
      !route.checkpointObjectIds.includes(record.payload.checkpointObjectId)
    ) {
      throw new ScoringContractError(
        "unexpected-checkpoint-evidence",
        `checkpoint ${record.payload.checkpointObjectId} is not declared by the required route`,
      );
    }
  }

  const matchingFinishes = suppliedFinishes.filter(
    (record) =>
      record.payload.kind === "finish-topology" &&
      record.payload.finishObjectId === route.finishObjectId,
  );
  if (matchingFinishes.length > 1 || suppliedFinishes.length > 1) {
    throw new ScoringContractError(
      "conflicting-evidence-coverage",
      `finish ${route.finishObjectId} has conflicting topology records`,
    );
  }
  const finish = matchingFinishes[0];
  if (finish?.payload.kind === "finish-topology") {
    requireSceneSubject(finish);
    if (
      finish.payload.routeId !== route.routeId ||
      finish.payload.routeIndex !== routeIndexes.get(route.finishObjectId)
    ) {
      throw new ScoringContractError(
        "finish-subject-mismatch",
        `finish ${route.finishObjectId} does not match the required route`,
      );
    }
    requireParents(finish, [
      routeGraph.evidenceContentHash,
      ...coarseTransitions.map((record) => record.evidenceContentHash),
    ]);
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
      requireParents(record, [
        routeGraph.evidenceContentHash,
        geometry.evidenceContentHash,
      ]);
      return record;
    }),
    (record) =>
      record.payload.kind === "hazard-relationship"
        ? `${record.payload.hazardObjectId}:${record.payload.relationship}`
        : record.evidenceContentHash,
    "hazard evidence",
  );
  const hazards = validatedHazards.filter((record) => {
    if (record.payload.kind !== "hazard-relationship") return false;
    const payload = record.payload;
    const expectedSuffix =
      payload.relationship === "kill-floor-bounds"
        ? "bounds"
        : payload.relationship === "structural-enclosure"
          ? "enclosure"
          : payload.routeObjectId === undefined
            ? undefined
            : `${routeIndexes.get(payload.routeObjectId)}:${
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
      requireParents(record, [
        routeGraph.evidenceContentHash,
        geometry.evidenceContentHash,
      ]);
      return record;
    }),
    (record) =>
      record.payload.kind === "skip-candidate"
        ? `${record.payload.candidateId}:${record.payload.fromObjectId}:${record.payload.toObjectId}`
        : record.evidenceContentHash,
    "skip evidence",
  );
  const skips = validatedSkips.filter(
    (record) =>
      record.payload.kind === "skip-candidate" &&
      record.evidenceId ===
        `e1b:skip:${record.payload.fromRouteIndex}:${record.payload.toRouteIndex}`,
  );

  return {
    routeGraph,
    summary,
    geometry,
    transitions: transitions.toSorted((left, right) =>
      compareUnicodeScalars(
        left.evidenceContentHash,
        right.evidenceContentHash,
      ),
    ),
    coarseTransitions: coarseTransitions.toSorted((left, right) =>
      compareUnicodeScalars(
        left.evidenceContentHash,
        right.evidenceContentHash,
      ),
    ),
    checkpoints,
    finishes: finish === undefined ? [] : [finish],
    hazards,
    skips,
  };
}

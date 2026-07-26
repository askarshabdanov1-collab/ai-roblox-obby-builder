import { describe, expect, it } from "vitest";

import {
  hashControllerProfile,
  hashEvidenceContent,
  parseControllerProfile,
  parseEvidenceRecord,
  parseGeometryObjectInput,
  parseTransitionInput,
  verifyControllerProfileIdentity,
} from "../src/index.js";
import { TEST_IDENTITIES } from "./fixtures.js";

const controllerProfile = () => {
  const profile: Record<string, unknown> = {
    schemaVersion: "0.1",
    profileId: "e1-r15-provisional",
    profileVersion: "1.0.0",
    modelId: "e1-coarse-surface-transition-v1",
    maximumHorizontalGap: {
      value: 6,
      unit: "studs",
      classification: "provisional",
    },
    maximumRise: {
      value: 5,
      unit: "studs",
      classification: "provisional",
    },
    maximumDownwardDrop: {
      value: 20,
      unit: "studs",
      classification: "provisional",
    },
    avatarDimensions: {
      width: 4,
      depth: 2,
      unit: "studs",
      classification: "provisional",
    },
    requiredLandingMargin: {
      value: 1,
      unit: "studs",
      classification: "calibration-required",
    },
    supportedSurfaceKinds: ["planar-face"],
    tolerancePolicy: {
      comparisonToleranceStuds: 1e-9,
      boundaryRule: "inclusive-with-tolerance",
      classification: "invariant",
    },
    limitations: [
      "A deterministic engineering model, not exact Roblox physics.",
    ],
    controllerProfileHash: TEST_IDENTITIES.geometryHash,
  };
  profile.controllerProfileHash = hashControllerProfile(profile).hash;
  return profile;
};

function evidence(kind: string, payload: Record<string, unknown>) {
  const record: Record<string, unknown> = {
    schemaVersion: "0.1",
    evidenceId: `e1b-${kind}`,
    kind,
    manifestHash: TEST_IDENTITIES.manifestHash,
    subject: { kind: "scene" },
    producer: {
      component: "route-playability-evaluator",
      version: "0.1.0",
    },
    payload,
    parentEvidenceHashes: [],
    artifactHashes: [],
    quality: { completeness: "complete", validityCodes: [] },
    limitations: [],
    evidenceContentHash: TEST_IDENTITIES.geometryHash,
  };
  record.evidenceContentHash = hashEvidenceContent(record).hash;
  return record;
}

describe("E1b evaluator contracts", () => {
  it("content-addresses a bounded deterministic controller profile", () => {
    const profile = controllerProfile();
    expect(parseControllerProfile(profile).controllerProfileHash).toBe(
      hashControllerProfile(profile).hash,
    );
    expect(
      new TextDecoder().decode(hashControllerProfile(profile).canonicalBytes),
    ).not.toContain('"height"');
    const changed = structuredClone(profile);
    (changed.maximumRise as Record<string, unknown>).value = 5.1;
    expect(hashControllerProfile(changed).hash).not.toBe(
      profile.controllerProfileHash,
    );
    const alternateOwnHash = {
      ...profile,
      controllerProfileHash: `sha256:${"f".repeat(64)}`,
    };
    expect(hashControllerProfile(alternateOwnHash).canonicalBytes).toEqual(
      hashControllerProfile(profile).canonicalBytes,
    );
  });

  it("rejects avatar height because E1b only content-addresses the supported landing footprint", () => {
    const profile = controllerProfile();
    profile.avatarDimensions = {
      ...(profile.avatarDimensions as Record<string, unknown>),
      height: 5,
    };
    expect(() => parseControllerProfile(profile)).toThrow(/avatarDimensions/);
  });

  it("rejects a stale controller profile hash after a semantic limit change", () => {
    const profile = controllerProfile();
    (profile.maximumRise as Record<string, unknown>).value = 5.1;
    expect(() => verifyControllerProfileIdentity(profile)).toThrow(
      /controllerProfileHash content hash mismatch/,
    );
  });

  it("accepts Phase 0 Pascal object IDs in geometry and transitions", () => {
    expect(
      parseGeometryObjectInput({
        schemaVersion: "0.1",
        objectId: "JumpPlatform01",
        shape: "Block",
        authority: "native-gameplay",
        collision: { canCollide: true, canTouch: false, canQuery: true },
        gameplayOwnership: "native-part",
        promotionStatus: "not-applicable",
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotationDegrees: { x: 0, y: 0, z: 0 },
        },
        size: { x: 10, y: 2, z: 10 },
        safeRouteRef: { routeId: "fixture-route", globalIndex: 1 },
      }).objectId,
    ).toBe("JumpPlatform01");
    expect(
      parseTransitionInput({
        schemaVersion: "0.1",
        transitionId: "route:fixture-route/Spawn/JumpPlatform01/0/1",
        routeId: "fixture-route",
        fromObjectId: "Spawn",
        toObjectId: "JumpPlatform01",
        fromGlobalIndex: 0,
        toGlobalIndex: 1,
        controllerProfileRef: "e1-r15-provisional",
      }).toObjectId,
    ).toBe("JumpPlatform01");
  });

  it.each([
    [
      "route-graph",
      {
        kind: "route-graph",
        routeId: "fixture-route",
        stageIds: ["stage-one"],
        orderedNodeIds: ["Spawn", "FinishPlatform"],
        orderedTransitionIds: ["route:fixture-route/Spawn/FinishPlatform/0/1"],
        spawnObjectId: "Spawn",
        checkpointObjectIds: [],
        finishObjectId: "FinishPlatform",
        structuralState: "connected",
        reproduction: { methodId: "declared-route-v1", inputHashes: [] },
      },
    ],
    [
      "coarse-transition-state",
      {
        kind: "coarse-transition-state",
        metricId: "playability.coarse-transition-state",
        resultId: "coarse.fixture-route.0.1",
        transitionId: "route:fixture-route/Spawn/FinishPlatform/0/1",
        fromObjectId: "Spawn",
        toObjectId: "FinishPlatform",
        controllerProfileId: "e1-r15-provisional",
        controllerProfileVersion: "1.0.0",
        controllerProfileHash: TEST_IDENTITIES.geometryHash,
        inputEvidenceHashes: [TEST_IDENTITIES.geometryHash],
        normalizedInputHash: TEST_IDENTITIES.manifestHash,
        state: "feasible-under-model",
        reasonCodes: [],
        horizontalGapStuds: 1,
        verticalRiseStuds: 0,
        downwardDropStuds: 0,
        landingRegion: {
          status: "available",
          method: "exact-planar-intrinsic-edge-spans-v1",
          approximationKind: "exact-native-primitive",
          spanAStuds: 8,
          spanBStuds: 12,
          toleranceStuds: 1e-9,
          limitations: ["Exact fixture landing region."],
        },
        sourceSurfaceKind: "planar-face",
        destinationSurfaceKind: "planar-face",
        approximationMethod: "world-aabb-horizontal-separation",
        geometryToleranceStuds: 1e-9,
        confidenceBasis: "deterministic-model-rule-bounded-inputs",
        reproduction: { methodId: "coarse-transition-v2", inputHashes: [] },
      },
    ],
    [
      "checkpoint-topology",
      {
        kind: "checkpoint-topology",
        checkpointObjectId: "Checkpoint01",
        routeId: "fixture-route",
        stageId: "stage-one",
        stageIndex: 1,
        routeIndex: 2,
        checkpointOrder: 1,
        spawnReachable: true,
        finishReachableAfterCheckpoint: true,
        gameplayAuthoritative: true,
        progressionDirection: "forward",
        progressionStateScope: "per-player",
        runtimeIsolationState: "not-evaluated",
        reproduction: { methodId: "checkpoint-topology-v1", inputHashes: [] },
      },
    ],
    [
      "route-playability-summary",
      {
        kind: "route-playability-summary",
        routeId: "fixture-route",
        transitionCount: 1,
        feasibleUnderModelCount: 1,
        coarseInfeasibleTransitionCount: 0,
        coarseIndeterminateTransitionCount: 0,
        excessiveDropTransitionCount: 0,
        clearanceEstimateState: "indeterminate-no-overhead-route-metadata",
        reproduction: {
          methodId: "route-playability-summary-v1",
          inputHashes: [],
        },
      },
    ],
    [
      "transition-evidence-conflict",
      {
        kind: "transition-evidence-conflict",
        transitionId: "route:fixture-route/Spawn/FinishPlatform/0/1",
        coarseEvidenceHash: TEST_IDENTITIES.geometryHash,
        runtimeEvidenceHash: TEST_IDENTITIES.manifestHash,
        conflictState: "runtime-success-vs-coarse-infeasible",
        reproduction: {
          methodId: "transition-evidence-conflict-v1",
          inputHashes: [],
        },
      },
    ],
    [
      "finish-topology",
      {
        kind: "finish-topology",
        finishObjectId: "FinishPlatform",
        routeId: "fixture-route",
        routeIndex: 2,
        requiredFinishCount: 1,
        onRequiredRoute: true,
        afterAllCheckpoints: true,
        structurallyReachable: true,
        coarsePathState: "feasible-under-model",
        gameplayAuthoritative: true,
        reproduction: { methodId: "finish-topology-v1", inputHashes: [] },
      },
    ],
    [
      "hazard-relationship",
      {
        kind: "hazard-relationship",
        hazardObjectId: "KillFloor",
        routeObjectId: "FinishPlatform",
        relationship: "landing-surface-overlap",
        assessment: "candidate",
        geometryMethod: "world-aabb-broad-phase",
        approximationKind: "conservative-bounds",
        geometryToleranceStuds: 1e-9,
        hazardGameplayAuthoritative: true,
        reproduction: { methodId: "hazard-relationship-v1", inputHashes: [] },
      },
    ],
    [
      "skip-candidate",
      {
        kind: "skip-candidate",
        candidateId: "skip.spawn.finish",
        fromObjectId: "Spawn",
        toObjectId: "FinishPlatform",
        fromRouteIndex: 0,
        toRouteIndex: 2,
        candidateKinds: ["non-adjacent-route-edge", "spawn-to-late-stage"],
        skippedStageIndexes: [1],
        modelState: "candidate",
        geometryMethod: "world-aabb-broad-phase",
        reproduction: { methodId: "skip-candidate-v1", inputHashes: [] },
      },
    ],
  ])("accepts the %s discriminated evidence payload", (kind, payload) => {
    expect(parseEvidenceRecord(evidence(kind, payload)).kind).toBe(kind);
  });

  it("canonicalizes skip candidate classifications and stage indexes as semantic sets", () => {
    const payload = {
      kind: "skip-candidate",
      candidateId: "skip.spawn.finish",
      fromObjectId: "Spawn",
      toObjectId: "FinishPlatform",
      fromRouteIndex: 0,
      toRouteIndex: 4,
      candidateKinds: [
        "spawn-to-late-stage",
        "checkpoint-bypass",
        "non-adjacent-route-edge",
      ],
      skippedStageIndexes: [3, 2],
      modelState: "candidate",
      geometryMethod: "world-aabb-broad-phase",
      reproduction: { methodId: "skip-candidate-v1", inputHashes: [] },
    };
    const reordered = {
      ...payload,
      candidateKinds: [...payload.candidateKinds].reverse(),
      skippedStageIndexes: [...payload.skippedStageIndexes].reverse(),
    };
    expect(
      hashEvidenceContent(evidence("skip-candidate", payload)).canonicalBytes,
    ).toEqual(
      hashEvidenceContent(evidence("skip-candidate", reordered)).canonicalBytes,
    );
  });
});

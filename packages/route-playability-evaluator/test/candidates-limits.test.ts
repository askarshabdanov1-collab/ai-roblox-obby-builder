import { describe, expect, it } from "vitest";

import {
  buildRouteGraph,
  createDefaultControllerProfile,
  detectStructuralSoftlockCandidates,
  evaluateRoutePlayability,
  RouteEvaluationError,
} from "../src/index.js";
import {
  manifestFixture,
  rehashManifest,
  requiredFixture,
} from "./fixtures.js";

describe("route candidates and deterministic limits", () => {
  it("does not emit non-adjacent skip candidates for the separated reference route", () => {
    const result = evaluateRoutePlayability({
      manifest: manifestFixture(),
      controllerProfile: createDefaultControllerProfile(),
    });
    expect(
      result.evidence.filter((record) => record.kind === "skip-candidate"),
    ).toHaveLength(0);
  });

  it("emits a direct spawn-to-late-stage skip candidate without claiming execution", () => {
    const manifest = manifestFixture();
    const finish = requiredFixture(
      manifest.layers.gameplay.objects.find(
        (object) => object.role === "finish",
      ),
      "finish",
    );
    finish.transform.position = { x: 0, y: 3, z: 8 };
    rehashManifest(manifest);
    const result = evaluateRoutePlayability({
      manifest,
      controllerProfile: createDefaultControllerProfile(),
    });
    const skip = result.evidence.find(
      (record) =>
        record.kind === "skip-candidate" &&
        record.payload.fromObjectId === "Spawn" &&
        record.payload.toObjectId === "FinishPlatform",
    );
    expect(skip?.kind).toBe("skip-candidate");
    if (skip?.kind !== "skip-candidate") {
      throw new Error("fixture spawn-to-finish candidate is missing");
    }
    expect(skip.payload.modelState).toBe("candidate");
    expect(skip.payload.candidateKinds).toEqual(
      expect.arrayContaining([
        "non-adjacent-route-edge",
        "spawn-to-late-stage",
        "checkpoint-bypass",
      ]),
    );
    expect(
      result.findings.find(
        (finding) => finding.ruleId === "route.skip-candidate",
      )?.summary,
    ).toContain("candidate");
  });

  it("labels a direct checkpoint-to-finish broad-phase candidate", () => {
    const manifest = manifestFixture();
    const checkpoint = requiredFixture(
      manifest.layers.gameplay.objects.find(
        (object) => object.role === "checkpoint",
      ),
      "checkpoint",
    );
    const finish = requiredFixture(
      manifest.layers.gameplay.objects.find(
        (object) => object.role === "finish",
      ),
      "finish",
    );
    finish.transform.position = {
      x: checkpoint.transform.position.x,
      y: checkpoint.transform.position.y,
      z: checkpoint.transform.position.z + 8,
    };
    rehashManifest(manifest);
    const result = evaluateRoutePlayability({
      manifest,
      controllerProfile: createDefaultControllerProfile(),
    });
    const skip = result.evidence.find(
      (record) =>
        record.kind === "skip-candidate" &&
        record.payload.fromObjectId === "Checkpoint01" &&
        record.payload.toObjectId === "FinishPlatform",
    );
    expect(skip?.kind).toBe("skip-candidate");
    if (skip?.kind !== "skip-candidate") {
      throw new Error("fixture checkpoint-to-finish candidate is missing");
    }
    expect(skip.payload.candidateKinds).toContain("checkpoint-to-finish");
  });

  it("labels an alternate edge that skips an entire required stage", () => {
    const manifest = manifestFixture();
    manifest.navigation.stages = [
      {
        id: "stage-one",
        order: 1,
        safeRouteObjectIds: ["JumpPlatform01"],
      },
      {
        id: "stage-two",
        order: 2,
        safeRouteObjectIds: ["Checkpoint01", "WedgeClimb01"],
      },
      {
        id: "stage-three",
        order: 3,
        safeRouteObjectIds: ["FinishPlatform"],
      },
    ];
    manifest.navigation.routeEntries =
      manifest.navigation.safeRouteObjectIds.map((objectId, index) => ({
        objectId,
        routeOrder: index + 1,
        stageId:
          index === 0 ? "stage-one" : index < 3 ? "stage-two" : "stage-three",
        stageRouteOrder: index === 0 || index === 3 ? 1 : index,
      })) as typeof manifest.navigation.routeEntries;
    const finish = requiredFixture(
      manifest.layers.gameplay.objects.find(
        (object) => object.role === "finish",
      ),
      "finish",
    );
    finish.transform.position = { x: 0, y: 3, z: 8 };
    rehashManifest(manifest);
    const result = evaluateRoutePlayability({
      manifest,
      controllerProfile: createDefaultControllerProfile(),
    });
    const skip = result.evidence.find(
      (record) =>
        record.kind === "skip-candidate" &&
        record.payload.fromObjectId === "Spawn" &&
        record.payload.toObjectId === "FinishPlatform",
    );
    expect(skip?.kind).toBe("skip-candidate");
    if (skip?.kind !== "skip-candidate") {
      throw new Error("fixture required-stage skip candidate is missing");
    }
    expect(skip.payload.candidateKinds).toContain("required-stage-skip");
    expect(skip.payload.skippedStageIndexes).toEqual([2]);
  });

  it("reports a required dead end as a structural softlock issue", () => {
    const manifest = manifestFixture();
    manifest.navigation.routeEntries.pop();
    rehashManifest(manifest);
    expect(() =>
      evaluateRoutePlayability({
        manifest,
        controllerProfile: createDefaultControllerProfile(),
      }),
    ).toThrow(RouteEvaluationError);
    try {
      evaluateRoutePlayability({
        manifest,
        controllerProfile: createDefaultControllerProfile(),
      });
    } catch (caught) {
      expect(
        (caught as RouteEvaluationError).issues.map((issue) => issue.code),
      ).toEqual(
        expect.arrayContaining([
          "disconnected-required-route",
          "structural-softlock-candidate",
        ]),
      );
    }
  });

  it("detects a checkpoint with no outgoing required path as a structural candidate", () => {
    const graph = buildRouteGraph(manifestFixture());
    const checkpoint = requiredFixture(
      graph.nodes.find((node) => node.role === "checkpoint"),
      "checkpoint node",
    );
    const truncated = {
      ...graph,
      edges: graph.edges.filter(
        (edge) => edge.fromObjectId !== checkpoint.objectId,
      ),
    };
    expect(detectStructuralSoftlockCandidates(truncated)).toContainEqual(
      expect.objectContaining({
        subjectObjectId: checkpoint.objectId,
        candidateKind: "checkpoint-without-outgoing-path",
        state: "structural-softlock-candidate",
      }),
    );
  });

  it.each([
    ["maxRoutes", 0, "maximum-routes"],
    ["maxNodes", 2, "maximum-nodes"],
    ["maxTransitions", 1, "maximum-transitions"],
    ["maxCheckpoints", 0, "maximum-checkpoints"],
    ["maxHazards", 0, "maximum-hazards"],
    ["maxEvidenceRecords", 1, "maximum-evidence-records"],
    ["maxTraversalWork", 1, "maximum-traversal-work"],
  ] as const)(
    "rejects the %s budget before unbounded work",
    (name, value, code) => {
      expect(() =>
        evaluateRoutePlayability({
          manifest: manifestFixture(),
          controllerProfile: createDefaultControllerProfile(),
          limits: { [name]: value },
        }),
      ).toThrow(expect.objectContaining({ code }));
    },
  );

  it.each([-1, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid deterministic limit %s with a typed error",
    (value) => {
      expect(() =>
        evaluateRoutePlayability({
          manifest: manifestFixture(),
          controllerProfile: createDefaultControllerProfile(),
          limits: { maxNodes: value },
        }),
      ).toThrow(expect.objectContaining({ code: "invalid-limit" }));
    },
  );

  it("rejects malformed evaluator input without incidental property failures", () => {
    expect(() =>
      evaluateRoutePlayability({
        manifest: { schemaVersion: "0.2" } as never,
        controllerProfile: createDefaultControllerProfile(),
      }),
    ).toThrow(
      expect.objectContaining({
        name: "RouteEvaluationError",
        code: "invalid-scene-manifest",
      }),
    );
  });

  it("never returns scoring, approval, or final-report fields", () => {
    const result = evaluateRoutePlayability({
      manifest: manifestFixture(),
      controllerProfile: createDefaultControllerProfile(),
    }) as unknown as Record<string, unknown>;
    expect(result).not.toHaveProperty("score");
    expect(result).not.toHaveProperty("approval");
    expect(result).not.toHaveProperty("report");
  });
});

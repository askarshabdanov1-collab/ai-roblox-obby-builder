import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import {
  assertValidEvidenceGraph,
  hashEvidenceContent,
  parseFinding,
} from "@obby/obby-evaluator-contracts";
import {
  createDefaultControllerProfile,
  evaluateRoutePlayability,
} from "../src/index.js";
import {
  manifestFixture,
  rehashManifest,
  shuffledManifestFixture,
  twoCheckpointManifest,
  requiredFixture,
} from "./fixtures.js";

describe("E1b evidence and findings", () => {
  it("emits integrity-valid content-addressed route evidence", () => {
    const result = evaluateRoutePlayability({
      manifest: manifestFixture(),
      controllerProfile: createDefaultControllerProfile(),
    });
    expect(assertValidEvidenceGraph(result.evidence)).toHaveLength(
      result.evidence.length,
    );
    expect(
      result.evidence.every(
        (record) =>
          hashEvidenceContent(record).hash === record.evidenceContentHash,
      ),
    ).toBe(true);
    expect(
      result.evidence.every((record) => {
        const hashed = hashEvidenceContent(record);
        const independentlyComputed = `sha256:${createHash("sha256")
          .update(hashed.canonicalBytes)
          .digest("hex")}`;
        return independentlyComputed === record.evidenceContentHash;
      }),
    ).toBe(true);
    expect(result.findings.map(parseFinding)).toEqual(result.findings);
    expect(
      new Set(result.evidence.map((record) => record.evidenceId)).size,
    ).toBe(result.evidence.length);
  });

  it("emits checkpoint and finish topology without claiming runtime isolation", () => {
    const result = evaluateRoutePlayability({
      manifest: twoCheckpointManifest(),
      controllerProfile: createDefaultControllerProfile(),
    });
    const checkpoints = result.evidence.filter(
      (record) => record.kind === "checkpoint-topology",
    );
    expect(checkpoints).toHaveLength(2);
    expect(
      checkpoints.map((record) => record.payload.runtimeIsolationState),
    ).toEqual(["not-evaluated", "not-evaluated"]);
    expect(
      checkpoints.map((record) => record.payload.progressionStateScope),
    ).toEqual(["per-player", "per-player"]);
    const finish = result.evidence.find(
      (record) => record.kind === "finish-topology",
    );
    expect(finish?.payload).toEqual(
      expect.objectContaining({
        structurallyReachable: true,
        afterAllCheckpoints: true,
      }),
    );
    expect(
      result.findings.some(
        (finding) => finding.ruleId === "checkpoint.runtime-isolation-missing",
      ),
    ).toBe(true);
  });

  it("summarizes coarse counts while leaving clearance explicitly indeterminate", () => {
    const result = evaluateRoutePlayability({
      manifest: manifestFixture(),
      controllerProfile: createDefaultControllerProfile(),
    });
    const summary = result.evidence.find(
      (record) => record.kind === "route-playability-summary",
    );
    expect(summary?.payload).toEqual(
      expect.objectContaining({
        transitionCount: result.transitionStates.length,
        coarseInfeasibleTransitionCount: result.transitionStates.filter(
          (item) => item.state === "infeasible-under-model",
        ).length,
        coarseIndeterminateTransitionCount: result.transitionStates.filter(
          (item) => item.state === "indeterminate",
        ).length,
        clearanceEstimateState: "indeterminate-no-overhead-route-metadata",
      }),
    );
  });

  it("labels AABB hazard overlap as a candidate rather than confirmed collision", () => {
    const manifest = manifestFixture();
    const hazard = requiredFixture(
      manifest.layers.gameplay.objects.find((object) => object.role === "kill"),
      "hazard",
    );
    const checkpoint = requiredFixture(
      manifest.layers.gameplay.objects.find(
        (object) => object.role === "checkpoint",
      ),
      "checkpoint",
    );
    hazard.transform.position = structuredClone(checkpoint.transform.position);
    hazard.size = structuredClone(checkpoint.size);
    hazard.size.x /= 2;
    rehashManifest(manifest);
    const result = evaluateRoutePlayability({
      manifest,
      controllerProfile: createDefaultControllerProfile(),
    });
    const relationship = result.evidence.find(
      (record) =>
        record.kind === "hazard-relationship" &&
        record.payload.routeObjectId === "Checkpoint01",
    );
    expect(relationship?.payload).toEqual(
      expect.objectContaining({
        assessment: "candidate",
        geometryMethod: "world-aabb-broad-phase",
      }),
    );
    expect(
      result.findings.find(
        (finding) => finding.ruleId === "hazard.landing-overlap-candidate",
      )?.blocking,
    ).toBe(false);
  });

  it("labels full landing-surface consumption as a broad-phase candidate", () => {
    const manifest = manifestFixture();
    const hazard = requiredFixture(
      manifest.layers.gameplay.objects.find((object) => object.role === "kill"),
      "hazard",
    );
    const checkpoint = requiredFixture(
      manifest.layers.gameplay.objects.find(
        (object) => object.role === "checkpoint",
      ),
      "checkpoint",
    );
    hazard.transform.position = structuredClone(checkpoint.transform.position);
    hazard.size = {
      x: checkpoint.size.x + 2,
      y: checkpoint.size.y + 2,
      z: checkpoint.size.z + 2,
    };
    rehashManifest(manifest);
    const result = evaluateRoutePlayability({
      manifest,
      controllerProfile: createDefaultControllerProfile(),
    });
    const relationship = result.evidence.find(
      (record) =>
        record.kind === "hazard-relationship" &&
        record.payload.routeObjectId === "Checkpoint01" &&
        record.payload.relationship === "landing-surface-fully-consumed",
    );
    expect(relationship?.payload).toEqual(
      expect.objectContaining({
        assessment: "candidate",
        geometryMethod: "world-aabb-broad-phase",
      }),
    );
  });

  it("records the reference KillFloor bounds and missing enclosure metadata separately", () => {
    const result = evaluateRoutePlayability({
      manifest: manifestFixture(),
      controllerProfile: createDefaultControllerProfile(),
    });
    const hazards = result.evidence.filter(
      (record) => record.kind === "hazard-relationship",
    );
    expect(
      hazards.map(
        (record) =>
          `${record.payload.relationship}:${record.payload.assessment}`,
      ),
    ).toEqual(
      expect.arrayContaining([
        "kill-floor-bounds:confirmed",
        "structural-enclosure:indeterminate",
      ]),
    );
  });

  it("recognizes consistent kill-floor bounds from semantics instead of object naming", () => {
    const manifest = manifestFixture();
    const hazard = requiredFixture(
      manifest.layers.gameplay.objects.find((object) => object.role === "kill"),
      "hazard",
    );
    hazard.id = "LavaPlane01";
    rehashManifest(manifest);
    const result = evaluateRoutePlayability({
      manifest,
      controllerProfile: createDefaultControllerProfile(),
    });
    const relationship = result.evidence.find(
      (record) =>
        record.kind === "hazard-relationship" &&
        record.payload.hazardObjectId === "LavaPlane01" &&
        record.payload.relationship === "kill-floor-bounds",
    );
    expect(relationship?.kind).toBe("hazard-relationship");
    if (relationship?.kind !== "hazard-relationship") {
      throw new Error("fixture kill-floor evidence is missing");
    }
    expect(relationship.payload.assessment).toBe("confirmed");
  });

  it("produces byte-equivalent semantic outputs for shuffled manifest arrays", () => {
    const profile = createDefaultControllerProfile();
    const ordered = evaluateRoutePlayability({
      manifest: manifestFixture(),
      controllerProfile: profile,
    });
    const shuffled = evaluateRoutePlayability({
      manifest: shuffledManifestFixture(),
      controllerProfile: profile,
    });
    expect(shuffled.routeGraph).toEqual(ordered.routeGraph);
    expect(shuffled.evidence).toEqual(ordered.evidence);
    expect(shuffled.findings).toEqual(ordered.findings);
  });

  it("repeats deterministic evidence and finding identities for the same seed and profile", () => {
    const input = {
      manifest: manifestFixture(),
      controllerProfile: createDefaultControllerProfile(),
    };
    const first = evaluateRoutePlayability(input);
    const second = evaluateRoutePlayability(input);
    expect(second.evidence).toEqual(first.evidence);
    expect(second.findings).toEqual(first.findings);
  });

  it("keeps every finding reference resolved to emitted evidence", () => {
    const result = evaluateRoutePlayability({
      manifest: twoCheckpointManifest(),
      controllerProfile: createDefaultControllerProfile(),
    });
    const evidenceIds = new Set(
      result.evidence.map((record) => record.evidenceId),
    );
    for (const finding of result.findings) {
      expect(finding.evidenceIds.length).toBeGreaterThan(0);
      expect(
        finding.evidenceIds.every((evidenceId) => evidenceIds.has(evidenceId)),
      ).toBe(true);
    }
  });
});

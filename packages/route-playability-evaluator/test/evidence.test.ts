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
        "kill-floor-bounds:candidate",
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
    expect(relationship.payload.assessment).toBe("candidate");
    expect(relationship.payload).toMatchObject({
      geometryMethod: "world-aabb-broad-phase",
      approximationKind: "conservative-bounds",
      geometryToleranceStuds: 1e-9,
    });
    expect(
      result.findings.some(
        (finding) => finding.ruleId === "hazard.kill-floor-bounds-candidate",
      ),
    ).toBe(true);
  });

  it("keeps rotated KillFloor AABB containment candidate-only", () => {
    const manifest = manifestFixture();
    const hazard = requiredFixture(
      manifest.layers.gameplay.objects.find((object) => object.role === "kill"),
      "hazard",
    );
    hazard.transform.rotation.y = 45;
    rehashManifest(manifest);
    const result = evaluateRoutePlayability({
      manifest,
      controllerProfile: createDefaultControllerProfile(),
    });
    const bounds = result.evidence.find(
      (record) =>
        record.kind === "hazard-relationship" &&
        record.payload.relationship === "kill-floor-bounds",
    );
    expect(bounds?.payload).toEqual(
      expect.objectContaining({
        assessment: "candidate",
        geometryMethod: "world-aabb-broad-phase",
      }),
    );
    expect(
      result.evidence.some(
        (record) =>
          record.kind === "hazard-relationship" &&
          record.payload.geometryMethod.includes("broad-phase") &&
          (record.payload.assessment as string) === "confirmed",
      ),
    ).toBe(false);
  });

  it.each([
    ["outside", { x: 35, y: -2, z: 60 }, { x: 10, y: 1, z: 10 }],
    ["partial", { x: 12, y: -2, z: 30 }, { x: 16, y: 1, z: 60 }],
  ] as const)(
    "does not detect %s KillFloor bounds as route containment",
    (_name, position, size) => {
      const manifest = manifestFixture();
      const hazard = requiredFixture(
        manifest.layers.gameplay.objects.find(
          (object) => object.role === "kill",
        ),
        "hazard",
      );
      hazard.transform.position = { ...position };
      hazard.size = { ...size };
      rehashManifest(manifest);
      const result = evaluateRoutePlayability({
        manifest,
        controllerProfile: createDefaultControllerProfile(),
      });
      const bounds = result.evidence.find(
        (record) =>
          record.kind === "hazard-relationship" &&
          record.payload.relationship === "kill-floor-bounds",
      );
      if (bounds?.kind !== "hazard-relationship") {
        throw new Error("fixture KillFloor bounds evidence is missing");
      }
      expect(bounds.payload.assessment).toBe("not-detected");
    },
  );

  it("deduplicates hazard relationships by deterministic evidence identity", () => {
    const result = evaluateRoutePlayability({
      manifest: manifestFixture(),
      controllerProfile: createDefaultControllerProfile(),
    });
    const relationships = result.evidence.filter(
      (record) => record.kind === "hazard-relationship",
    );
    const identities = relationships.map((record) => record.evidenceId);
    expect(new Set(identities).size).toBe(identities.length);
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

import { compareUnicodeScalars } from "@obby/canonical-json";
import { describe, expect, it } from "vitest";

import {
  buildRouteGraph,
  createDefaultControllerProfile,
  evaluateRoutePlayability,
  RouteEvaluationError,
} from "../src/index.js";
import {
  manifestFixture,
  rehashManifest,
  requiredFixture,
  shuffledManifestFixture,
  twoCheckpointManifest,
} from "./fixtures.js";

describe("declared route graph", () => {
  it("uses canonical Unicode-scalar ordering for semantic diagnostics", () => {
    const identities = ["я", "é", "e\u0301", "😀", "z", "a"];
    expect(identities.toSorted(compareUnicodeScalars)).toEqual([
      "a",
      "e\u0301",
      "z",
      "é",
      "я",
      "😀",
    ]);
  });
  it("connects spawn through every declared safe-route object to finish", () => {
    const graph = buildRouteGraph(manifestFixture());
    expect(graph.nodes.map((node) => node.objectId)).toEqual([
      "Spawn",
      "JumpPlatform01",
      "Checkpoint01",
      "WedgeClimb01",
      "FinishPlatform",
    ]);
    expect(graph.edges).toHaveLength(4);
    expect(graph.finishObjectId).toBe("FinishPlatform");
  });

  it("uses explicit route metadata rather than gameplay insertion order", () => {
    const ordered = buildRouteGraph(manifestFixture());
    const shuffled = buildRouteGraph(shuffledManifestFixture());
    expect(shuffled).toEqual(ordered);
  });

  it("orders multiple checkpoints by declared route and checkpoint order", () => {
    const graph = buildRouteGraph(twoCheckpointManifest());
    expect(graph.checkpointObjectIds).toEqual(["Checkpoint01", "Checkpoint02"]);
    expect(graph.nodes.filter((node) => node.role === "checkpoint")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ objectId: "Checkpoint01", routeIndex: 2 }),
        expect.objectContaining({ objectId: "Checkpoint02", routeIndex: 4 }),
      ]),
    );
  });

  it("preserves explicit ordered stages across one global route", () => {
    const manifest = manifestFixture();
    manifest.navigation.stages = [
      {
        id: "tower-entry",
        order: 1,
        safeRouteObjectIds: ["JumpPlatform01", "Checkpoint01"],
      },
      {
        id: "tower-finish",
        order: 2,
        safeRouteObjectIds: ["WedgeClimb01", "FinishPlatform"],
      },
    ];
    manifest.navigation.routeEntries =
      manifest.navigation.safeRouteObjectIds.map((objectId, index) => ({
        objectId,
        routeOrder: index + 1,
        stageId: index < 2 ? "tower-entry" : "tower-finish",
        stageRouteOrder: (index % 2) + 1,
      })) as typeof manifest.navigation.routeEntries;
    rehashManifest(manifest);
    expect(buildRouteGraph(manifest).stages).toEqual([
      expect.objectContaining({ stageId: "tower-entry", stageIndex: 1 }),
      expect.objectContaining({ stageId: "tower-finish", stageIndex: 2 }),
    ]);
  });

  it("rejects duplicate required stage indexes deterministically", () => {
    const manifest = twoCheckpointManifest();
    requiredFixture(manifest.navigation.stages[1], "second stage").order = 1;
    rehashManifest(manifest);
    try {
      buildRouteGraph(manifest);
      throw new Error("expected duplicate stage rejection");
    } catch (caught) {
      expect(caught).toBeInstanceOf(RouteEvaluationError);
      expect(
        (caught as RouteEvaluationError).issues.map((issue) => issue.code),
      ).toContain("duplicate-stage-index");
    }
  });

  it.each([
    ["decorative-route-endpoint", "decorative"],
    ["finish-before-checkpoint", "finish-before"],
    ["missing-finish", "missing-finish"],
  ])(
    "rejects %s without promoting or inferring route truth",
    (code, mutation) => {
      const manifest = manifestFixture();
      if (mutation === "decorative") {
        manifest.layers.decorative.objects.push({
          id: "DecorativeRoute",
          order: 0,
          role: "decoration",
          className: "Part",
          shape: "Block",
          transform: {
            position: { x: 0, y: 3, z: 8 },
            rotation: { x: 0, y: 0, z: 0 },
          },
          size: { x: 8, y: 1, z: 8 },
          color: "#FFFFFF",
          material: "SmoothPlastic",
          physics: {
            anchored: true,
            canCollide: false,
            canTouch: false,
            canQuery: true,
          },
          behavior: { kind: "decoration" },
        });
        manifest.navigation.safeRouteObjectIds[0] = "DecorativeRoute";
        requiredFixture(
          manifest.navigation.stages[0],
          "first stage",
        ).safeRouteObjectIds[0] = "DecorativeRoute";
        requiredFixture(
          manifest.navigation.routeEntries[0],
          "first route entry",
        ).objectId = "DecorativeRoute";
      } else if (mutation === "finish-before") {
        const route = manifest.navigation.safeRouteObjectIds;
        const second = requiredFixture(route[1], "second route object");
        const fourth = requiredFixture(route[3], "fourth route object");
        [route[1], route[3]] = [fourth, second];
        requiredFixture(
          manifest.navigation.stages[0],
          "first stage",
        ).safeRouteObjectIds = [...route];
        manifest.navigation.routeEntries = route.map((objectId, index) => ({
          objectId,
          routeOrder: index + 1,
          stageId: "tower-entry",
          stageRouteOrder: index + 1,
        })) as typeof manifest.navigation.routeEntries;
      } else {
        const finish = requiredFixture(
          manifest.layers.gameplay.objects.find(
            (object) => object.role === "finish",
          ),
          "finish",
        );
        finish.role = "platform";
        finish.behavior.kind = "platform";
        finish.physics.canTouch = false;
      }
      rehashManifest(manifest);
      try {
        buildRouteGraph(manifest);
        throw new Error("expected route rejection");
      } catch (caught) {
        expect(caught).toBeInstanceOf(RouteEvaluationError);
        expect(
          (caught as RouteEvaluationError).issues.map((issue) => issue.code),
        ).toContain(code);
      }
    },
  );

  it.each([
    ["unknown-safe-route-object", "MissingPlatform"],
    ["hazard-route-endpoint", "hazard"],
    ["duplicate-route-index", "duplicate"],
    ["reversed-required-transition", "reversed"],
    ["safe-route-ref-mismatch", "mismatch"],
    ["source-equals-destination", "self-transition"],
  ])("rejects %s deterministically", (expectedCode, mutation) => {
    const manifest = manifestFixture();
    if (mutation === "MissingPlatform") {
      manifest.navigation.safeRouteObjectIds[0] = "MissingPlatform";
      requiredFixture(
        manifest.navigation.stages[0],
        "first stage",
      ).safeRouteObjectIds[0] = "MissingPlatform";
      requiredFixture(
        manifest.navigation.routeEntries[0],
        "first route entry",
      ).objectId = "MissingPlatform";
    } else if (mutation === "hazard") {
      manifest.navigation.safeRouteObjectIds[0] = "KillFloor";
      requiredFixture(
        manifest.navigation.stages[0],
        "first stage",
      ).safeRouteObjectIds[0] = "KillFloor";
      requiredFixture(
        manifest.navigation.routeEntries[0],
        "first route entry",
      ).objectId = "KillFloor";
    } else if (mutation === "duplicate") {
      requiredFixture(
        manifest.navigation.routeEntries[1],
        "second route entry",
      ).routeOrder = 1;
    } else if (mutation === "reversed") {
      const first = requiredFixture(
        manifest.navigation.routeEntries[0],
        "first route entry",
      );
      const second = requiredFixture(
        manifest.navigation.routeEntries[1],
        "second route entry",
      );
      [first.routeOrder, second.routeOrder] = [
        second.routeOrder,
        first.routeOrder,
      ];
    } else if (mutation === "self-transition") {
      manifest.navigation.safeRouteObjectIds[1] = "JumpPlatform01";
      requiredFixture(
        manifest.navigation.stages[0],
        "first stage",
      ).safeRouteObjectIds[1] = "JumpPlatform01";
      requiredFixture(
        manifest.navigation.routeEntries[1],
        "second route entry",
      ).objectId = "JumpPlatform01";
    } else {
      requiredFixture(
        manifest.navigation.routeEntries[1],
        "second route entry",
      ).stageId = "unknown-stage";
    }
    rehashManifest(manifest);
    expect(() => buildRouteGraph(manifest)).toThrow(RouteEvaluationError);
    try {
      buildRouteGraph(manifest);
    } catch (caught) {
      expect(caught).toBeInstanceOf(RouteEvaluationError);
      expect(
        (caught as RouteEvaluationError).issues.map((issue) => issue.code),
      ).toContain(expectedCode);
    }
  });

  it("keeps the manifest immutable", () => {
    const manifest = manifestFixture();
    const before = structuredClone(manifest);
    evaluateRoutePlayability({
      manifest,
      controllerProfile: createDefaultControllerProfile(),
    });
    expect(manifest).toEqual(before);
  });

  it("rejects structurally malformed input with typed deterministic issues", () => {
    const malformed = { schemaVersion: "0.2" };
    try {
      buildRouteGraph(malformed);
      throw new Error("expected malformed manifest rejection");
    } catch (caught) {
      expect(caught).toBeInstanceOf(RouteEvaluationError);
      expect((caught as RouteEvaluationError).code).toBe(
        "invalid-scene-manifest",
      );
      expect((caught as RouteEvaluationError).issues.length).toBeGreaterThan(0);
    }
  });

  it("orders equivalent invalid declarations deterministically after input shuffling", () => {
    const invalid = manifestFixture();
    const first = requiredFixture(
      invalid.navigation.routeEntries[0],
      "first route entry",
    );
    const second = requiredFixture(
      invalid.navigation.routeEntries[1],
      "second route entry",
    );
    [first.routeOrder, second.routeOrder] = [
      second.routeOrder,
      first.routeOrder,
    ];
    second.stageId = "unknown-stage";
    rehashManifest(invalid);
    const shuffled = structuredClone(invalid);
    shuffled.layers.gameplay.objects.reverse();
    shuffled.navigation.stages.reverse();
    shuffled.navigation.routeEntries.reverse();
    rehashManifest(shuffled);
    const issues = (manifest: typeof invalid) => {
      try {
        buildRouteGraph(manifest);
        throw new Error("expected invalid declaration rejection");
      } catch (caught) {
        if (!(caught instanceof RouteEvaluationError)) throw caught;
        return caught.issues;
      }
    };
    expect(issues(shuffled)).toEqual(issues(invalid));
  });
});

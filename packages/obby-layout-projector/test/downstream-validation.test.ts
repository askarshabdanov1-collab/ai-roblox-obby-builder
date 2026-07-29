import {
  computePlaceSpecV03Hash,
  computeSceneManifestV03Hash,
  validatePlaceSpecV03,
  validateSceneManifestV03,
} from "@obby/contracts";
import { compilePlaceSpecV03 } from "@obby/obby-compiler";
import { describe, expect, it } from "vitest";

import { projectionFor } from "./helpers.js";

describe("0.3 downstream fail-closed validation", () => {
  it("excludes each result hash from its named preimage", () => {
    const place = projectionFor({ stageCount: 5 }).placeSpec;
    const placeHash = computePlaceSpecV03Hash(place);
    expect(
      computePlaceSpecV03Hash({
        ...place,
        placeSpecHash: `sha256:${"f".repeat(64)}`,
      }),
    ).toBe(placeHash);
    const manifest = compilePlaceSpecV03(place);
    const manifestHash = computeSceneManifestV03Hash(manifest);
    expect(
      computeSceneManifestV03Hash({
        ...manifest,
        manifestHash: `sha256:${"e".repeat(64)}`,
      }),
    ).toBe(manifestHash);
  });

  it("rejects a hazard route endpoint even with a fresh PlaceSpec hash", () => {
    const place = structuredClone(
      projectionFor({ stageCount: 15, difficulty: "hard" }).placeSpec,
    );
    const hazard = place.objects.find((object) => object.role === "kill");
    expect(hazard).toBeDefined();
    if (hazard === undefined) throw new Error("hazard fixture is missing");
    place.route.orderedObjectIds[0] = hazard.id;
    place.reachability.requiredTransitions[0].toObjectId = hazard.id;
    place.reachability.requiredTransitions[1].fromObjectId = hazard.id;
    place.placeSpecHash = computePlaceSpecV03Hash(place);
    const result = validatePlaceSpecV03(place);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues.some((issue) => issue.code === "route-role")).toBe(
        true,
      );
  });

  it("rejects a decorative route endpoint even with a fresh manifest hash", () => {
    const manifest = structuredClone(
      compilePlaceSpecV03(projectionFor({ stageCount: 5 }).placeSpec),
    );
    const template = manifest.layers.gameplay.objects[1];
    const zone = manifest.decorativeZones[0];
    manifest.layers.decorative.objects.push({
      id: "DecorativeRoute",
      zoneId: zone.zoneId,
      className: "Part",
      shape: "Block",
      transform: template.transform,
      size: template.size,
      collision: {
        anchored: true,
        canCollide: false,
        canTouch: false,
        canQuery: false,
      },
      appearance: template.appearance,
    });
    manifest.navigation.safeRouteObjectIds[0] = "DecorativeRoute";
    manifest.navigation.routeEntries[0].objectId = "DecorativeRoute";
    manifest.navigation.stages[0].safeRouteObjectIds[0] = "DecorativeRoute";
    manifest.navigation.reachability.requiredTransitions[0].toObjectId =
      "DecorativeRoute";
    manifest.navigation.reachability.requiredTransitions[1].fromObjectId =
      "DecorativeRoute";
    manifest.manifestHash = computeSceneManifestV03Hash(manifest);
    const result = validateSceneManifestV03(manifest);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(
        result.issues.some(
          (issue) =>
            issue.code === "route-role" || issue.code === "decorative-route",
        ),
      ).toBe(true);
  });
});

import { readFile } from "node:fs/promises";

import { canonicalStringify } from "@obby/canonical-json";
import { validatePlaceSpec, validateSceneManifest } from "@obby/contracts";
import { normalizeGeometryObject } from "@obby/geometry-evaluator";
import { compilePlaceSpec } from "@obby/obby-compiler";
import { parseGeometryObjectInput } from "@obby/obby-evaluator-contracts";
import { emitManifestModule } from "@obby/roblox-emitter";

const spec = JSON.parse(
  await readFile(
    new URL("../examples/vertical-slice/place-spec.json", import.meta.url),
    "utf8",
  ),
);
if (!validatePlaceSpec(spec).ok)
  throw new Error("built contracts rejected fixture");

const manifest = compilePlaceSpec(spec);
if (!validateSceneManifest(manifest).ok)
  throw new Error("built contracts rejected compiled manifest");
if (!canonicalStringify(manifest).includes('"navigation"'))
  throw new Error("built canonical-json omitted navigation");
if (!emitManifestModule(manifest).startsWith("-- This file is generated"))
  throw new Error("built Roblox emitter returned invalid output");
const geometryInput = {
  schemaVersion: "0.1",
  objectId: "smoke-platform",
  shape: "Block",
  authority: "native-gameplay",
  transform: {
    position: { x: 0, y: 1, z: 0 },
    rotationDegrees: { x: 0, y: 0, z: 0 },
  },
  size: { x: 8, y: 2, z: 8 },
};
parseGeometryObjectInput(geometryInput);
if (normalizeGeometryObject(geometryInput).topSurface.maximumY !== 2)
  throw new Error("built geometry evaluator returned invalid bounds");

console.log("plain Node imported all Phase 0 and Phase E1a packages");

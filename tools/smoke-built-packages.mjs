import { readFile } from "node:fs/promises";

import { canonicalStringify } from "@obby/canonical-json";
import { validatePlaceSpec, validateSceneManifest } from "@obby/contracts";
import { compilePlaceSpec } from "@obby/obby-compiler";
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

console.log(
  "plain Node imported canonical-json, contracts, obby-compiler, and roblox-emitter",
);

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { validatePlaceSpec, validateSceneManifest } from "./validate.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const cases = [
  ["place-spec.json", validatePlaceSpec],
  ["scene-manifest.json", validateSceneManifest],
];

for (const [file, validator] of cases) {
  const input = JSON.parse(await readFile(resolve(root, "examples", file), "utf8"));
  const result = validator(input);
  if (!result.ok) {
    console.error(`${file}: invalid`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`${file}: valid`);
  }
}

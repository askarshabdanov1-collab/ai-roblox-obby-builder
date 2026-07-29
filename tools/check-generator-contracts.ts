import { readFile } from "node:fs/promises";

import { Ajv2020 } from "ajv/dist/2020.js";

import {
  expectedGeneratorContractArtifacts,
  generatorSchemaPath,
} from "./generator-contract-content.js";

const schema = JSON.parse(
  await readFile(generatorSchemaPath, "utf8"),
) as object;
new Ajv2020({ allErrors: true, strict: true }).compile(schema);
for (const [path, expected] of Object.entries(
  await expectedGeneratorContractArtifacts(),
)) {
  const actual = await readFile(path, "utf8");
  if (actual !== expected)
    throw new Error(
      `${path} is stale; run npm run generator:contracts:generate`,
    );
}
console.log("generator contract schema and generated metadata are current");

import { readFile } from "node:fs/promises";

import { Ajv2020 } from "ajv/dist/2020.js";

import {
  evaluatorContractSchemaPath,
  expectedEvaluatorContractTypes,
} from "./evaluator-contract-generated-content.js";
import { expectedEvaluatorFixtures } from "./evaluator-fixture-content.js";

const schema = JSON.parse(
  await readFile(evaluatorContractSchemaPath, "utf8"),
) as object;
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictNumbers: true,
});
await ajv.validateSchema(schema, true);
ajv.compile(schema);

const expectedArtifacts = {
  ...(await expectedEvaluatorContractTypes()),
  ...expectedEvaluatorFixtures(),
};

for (const [path, expected] of Object.entries(expectedArtifacts)) {
  const actual = await readFile(path, "utf8").catch(() => "");
  if (actual !== expected) {
    throw new Error(
      `${path} is stale; run npm run evaluator:contracts:generate`,
    );
  }
}

console.log(
  `${evaluatorContractSchemaPath}: valid Draft 2020-12 schema and generated types are current`,
);

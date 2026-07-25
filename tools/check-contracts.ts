import { readFile } from "node:fs/promises";

import { Ajv2020 } from "ajv/dist/2020.js";

const schemaPaths = [
  "packages/contracts/schemas/place-spec.schema.json",
  "packages/contracts/schemas/scene-manifest.schema.json",
];
const ajv = new Ajv2020({ allErrors: true, strict: true, strictNumbers: true });

for (const path of schemaPaths) {
  const schema = JSON.parse(await readFile(path, "utf8")) as object;
  await ajv.validateSchema(schema, true);
  ajv.compile(schema);
  console.log(`${path}: valid Draft 2020-12 schema`);
}

import { readFile } from "node:fs/promises";

import { evaluatorCanonicalize, sha256Bytes } from "@obby/canonical-json";
import { compileFromFile } from "json-schema-to-typescript";
import { format } from "prettier";

export const generatorSchemaPath =
  "packages/obby-generator-contracts/schemas/generator-contracts.schema.json";
export const generatorSchemaMetadataPath =
  "packages/obby-generator-contracts/src/generated/schema-metadata.ts";
export const generatorSchemaTypesPath =
  "packages/obby-generator-contracts/src/generated/generator-contracts.ts";

export async function expectedGeneratorContractArtifacts(): Promise<
  Record<string, string>
> {
  const schema = JSON.parse(
    await readFile(generatorSchemaPath, "utf8"),
  ) as unknown;
  const canonical = evaluatorCanonicalize(schema);
  const source = `/* Generated from generator-contracts.schema.json. Do not edit. */\nexport const GENERATOR_CONTRACT_SCHEMA_HASH = ${JSON.stringify(sha256Bytes(canonical.canonicalBytes))} as const;\n`;
  const declarations = (
    await compileFromFile(generatorSchemaPath, {
      bannerComment:
        "/* Generated from generator-contracts.schema.json. Do not edit. */",
      additionalProperties: false,
      maxItems: -1,
    })
  ).replace(
    "export type Hash = string;",
    "export type Hash = `sha256:${string}`;",
  );
  return {
    [generatorSchemaMetadataPath]: await format(source, {
      parser: "typescript",
    }),
    [generatorSchemaTypesPath]: await format(declarations, {
      parser: "typescript",
    }),
  };
}

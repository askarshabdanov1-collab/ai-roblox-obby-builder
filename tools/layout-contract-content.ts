import { readFile } from "node:fs/promises";

import { evaluatorCanonicalize, sha256Bytes } from "@obby/canonical-json";
import { compileFromFile } from "json-schema-to-typescript";
import { format } from "prettier";

export const layoutSchemaPath =
  "packages/obby-layout-contracts/schemas/layout-contracts.schema.json";
export const layoutSchemaMetadataPath =
  "packages/obby-layout-contracts/src/generated/schema-metadata.ts";
export const layoutSchemaTypesPath =
  "packages/obby-layout-contracts/src/generated/layout-contracts.ts";

export async function expectedLayoutContractArtifacts(): Promise<
  Record<string, string>
> {
  const schema = JSON.parse(
    await readFile(layoutSchemaPath, "utf8"),
  ) as unknown;
  const canonical = evaluatorCanonicalize(schema);
  const source = `/* Generated from layout-contracts.schema.json. Do not edit. */\nexport const LAYOUT_CONTRACT_SCHEMA_HASH = ${JSON.stringify(sha256Bytes(canonical.canonicalBytes))} as const;\n`;
  const declarations = (
    await compileFromFile(layoutSchemaPath, {
      bannerComment:
        "/* Generated from layout-contracts.schema.json. Do not edit. */",
      additionalProperties: false,
      maxItems: -1,
    })
  ).replace(
    "export type Hash = string;",
    "export type Hash = `sha256:${string}`;",
  );
  return {
    [layoutSchemaMetadataPath]: await format(source, { parser: "typescript" }),
    [layoutSchemaTypesPath]: await format(declarations, {
      parser: "typescript",
    }),
  };
}

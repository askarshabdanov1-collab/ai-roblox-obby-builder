import { compileFromFile } from "json-schema-to-typescript";

export const evaluatorContractSchemaPath =
  "packages/obby-evaluator-contracts/schemas/evaluator-contracts.schema.json";
export const evaluatorContractTypePath =
  "packages/obby-evaluator-contracts/src/generated/evaluator-contracts.ts";

const typeOptions = {
  bannerComment:
    "/* Generated from evaluator-contracts.schema.json. Do not edit. */",
  maxItems: -1,
} as const;

export async function expectedEvaluatorContractTypes(): Promise<
  Record<string, string>
> {
  return {
    [evaluatorContractTypePath]: await compileFromFile(
      evaluatorContractSchemaPath,
      typeOptions,
    ),
  };
}

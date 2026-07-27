import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  EvaluatorCliError,
  evaluateFiles,
  runEvaluatorCli,
  type EvaluateFileInputs,
} from "../src/index.js";

const repository = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const generated = resolve(
  repository,
  "packages/scoring-engine/fixtures/generated/passing-structural-route",
);
const inputs = (output = "output"): EvaluateFileInputs => ({
  request: resolve(generated, "request.json"),
  plan: resolve(generated, "plan.json"),
  definitions: resolve(
    repository,
    "packages/obby-evaluator-contracts/fixtures/generated/e1-metric-definitions.json",
  ),
  catalog: resolve(
    repository,
    "packages/obby-evaluator-contracts/fixtures/generated/e1-metric-catalog.json",
  ),
  profile: resolve(
    repository,
    "packages/obby-evaluator-contracts/fixtures/generated/e1-scoring-profile.json",
  ),
  manifest: resolve(repository, "examples/vertical-slice/scene-manifest.json"),
  evidence: resolve(generated, "evidence-bundle.json"),
  availability: resolve(generated, "availability-records.json"),
  output,
});

const temporaryDirectories: string[] = [];
async function temporary(): Promise<string> {
  const path = await mkdtemp(resolve(tmpdir(), "obby-evaluator-cli-"));
  temporaryDirectories.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("atomic evaluator CLI", () => {
  it("publishes canonical JSON and deterministic Markdown as one report directory", async () => {
    const cwd = await temporary();
    const first = await evaluateFiles(inputs(), { cwd });
    const second = await evaluateFiles(inputs(), { cwd });
    expect(second).toEqual(first);
    expect(
      JSON.parse(
        await readFile(resolve(first.outputDirectory, "report.json"), "utf8"),
      ),
    ).toHaveProperty("reportPayloadHash", first.reportPayloadHash);
    expect(
      await readFile(resolve(first.outputDirectory, "report.md"), "utf8"),
    ).toContain("## Reproduction information");
  });

  it("removes temporary output after a pre-commit failure", async () => {
    const cwd = await temporary();
    await expect(
      evaluateFiles(inputs(), {
        cwd,
        beforeCommit: () => {
          throw new EvaluatorCliError("INJECTED_FAILURE", "test failure");
        },
      }),
    ).rejects.toThrow("test failure");
    expect(await readdir(resolve(cwd, "output"))).toEqual([]);
  });

  it("rejects path traversal and input/output size limit violations", async () => {
    const cwd = await temporary();
    await expect(
      evaluateFiles(inputs("../escape"), { cwd }),
    ).rejects.toMatchObject({
      code: "UNSAFE_OUTPUT_PATH",
    });
    await expect(
      evaluateFiles(inputs(), { cwd, limits: { maxInputFileBytes: 1 } }),
    ).rejects.toMatchObject({ code: "INPUT_SIZE_LIMIT" });
    await expect(
      evaluateFiles(inputs(), { cwd, limits: { maxOutputBytes: 1 } }),
    ).rejects.toMatchObject({ code: "OUTPUT_SIZE_LIMIT" });
  });

  it("returns nonzero machine-readable errors without a stack trace", async () => {
    let stderr = "";
    const code = await runEvaluatorCli(["evaluate", "--json-errors"], {
      stdout: () => undefined,
      stderr: (text) => {
        stderr += text;
      },
    });
    expect(code).not.toBe(0);
    expect(JSON.parse(stderr)).toEqual({
      ok: false,
      error: { code: "USAGE", message: "Missing required --request" },
    });
    expect(stderr).not.toContain("at runEvaluatorCli");
  });
});

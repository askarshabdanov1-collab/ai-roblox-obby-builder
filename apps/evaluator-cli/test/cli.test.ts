import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  EvaluatorCliError,
  evaluateFiles,
  parseCliArguments,
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

const flags = (values = inputs()): string[] =>
  Object.entries(values).flatMap(([name, value]) => [`--${name}`, value]);

const temporaryDirectories: string[] = [];
async function temporary(prefix = "obby-evaluator-cli-"): Promise<string> {
  const path = await mkdtemp(resolve(tmpdir(), prefix));
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
    expect(first.outputDirectory).toContain(first.reportPayloadHash.slice(7));
    expect(
      JSON.parse(
        await readFile(resolve(first.outputDirectory, "report.json"), "utf8"),
      ),
    ).toHaveProperty("reportPayloadHash", first.reportPayloadHash);
    expect(
      await readFile(resolve(first.outputDirectory, "report.md"), "utf8"),
    ).toContain("## Reproduction information");
  });

  it.each([
    "first-file-write",
    "second-file-write",
    "file-sync",
    "temporary-directory-sync",
    "rename",
  ] as const)(
    "does not expose partial output after %s failure",
    async (step) => {
      const cwd = await temporary();
      let injected = false;
      await expect(
        evaluateFiles(inputs(), {
          cwd,
          onAtomicStep: (actual) => {
            if (!injected && actual === step) {
              injected = true;
              throw new EvaluatorCliError("INJECTED_FAILURE", step);
            }
          },
        }),
      ).rejects.toMatchObject({ code: "OUTPUT_PUBLICATION_FAILED" });

      expect(await readdir(resolve(cwd, "output"))).toEqual([]);
    },
  );

  it("reports cleanup failure deterministically", async () => {
    const cwd = await temporary();
    await expect(
      evaluateFiles(inputs(), {
        cwd,
        onAtomicStep: (step) => {
          if (step === "first-file-write") throw new Error("write failed");
          if (step === "cleanup") throw new Error("cleanup failed");
        },
      }),
    ).rejects.toMatchObject({ code: "CLEANUP_FAILED" });
  });

  it("keeps a complete report visible if final-parent sync fails", async () => {
    const cwd = await temporary();
    await expect(
      evaluateFiles(inputs(), {
        cwd,
        onAtomicStep: (step) => {
          if (step === "final-parent-sync") throw new Error("sync failed");
        },
      }),
    ).rejects.toMatchObject({ code: "OUTPUT_PUBLICATION_FAILED" });
    const directories = await readdir(resolve(cwd, "output"));

    expect(directories).toHaveLength(1);
    const [publishedDirectory] = directories;
    if (publishedDirectory === undefined) throw new Error("missing output");
    expect(await readdir(resolve(cwd, "output", publishedDirectory))).toEqual([
      "report.json",
      "report.md",
    ]);
  });

  it("converges concurrent identical publications", async () => {
    const cwd = await temporary();
    const [first, second] = await Promise.all([
      evaluateFiles(inputs(), { cwd }),
      evaluateFiles(inputs(), { cwd }),
    ]);

    expect(second).toEqual(first);
    expect(await readdir(resolve(cwd, "output"))).toEqual([
      first.outputDirectory.split(/[\\/]/u).at(-1),
    ]);
  });

  it("fails safely when deterministic destination content conflicts", async () => {
    const cwd = await temporary();
    const published = await evaluateFiles(inputs(), { cwd });
    await writeFile(resolve(published.outputDirectory, "report.md"), "changed");

    await expect(evaluateFiles(inputs(), { cwd })).rejects.toMatchObject({
      code: "OUTPUT_CONFLICT",
    });
  });
});

describe("CLI validation and deterministic errors", () => {
  it("rejects unknown, duplicate, missing-value, and missing required options", () => {
    expect(() =>
      parseCliArguments(["evaluate", ...flags(), "--unsupported", "value"]),
    ).toThrow(expect.objectContaining({ code: "USAGE_UNKNOWN_OPTION" }));
    expect(() =>
      parseCliArguments([
        "evaluate",
        ...flags(),
        "--request",
        inputs().request,
      ]),
    ).toThrow(expect.objectContaining({ code: "USAGE_DUPLICATE_OPTION" }));
    expect(() =>
      parseCliArguments(["evaluate", "--request", "--plan", "value"]),
    ).toThrow(expect.objectContaining({ code: "USAGE_MISSING_VALUE" }));
    expect(() => parseCliArguments(["evaluate"])).toThrow(
      expect.objectContaining({ code: "USAGE_MISSING_OPTION" }),
    );
  });

  it("returns typed malformed, missing, schema, and stale-hash errors", async () => {
    const cwd = await temporary();
    const malformed = resolve(cwd, "malformed.json");
    const wrongSchema = resolve(cwd, "wrong-schema.json");
    const stalePlan = resolve(cwd, "stale-plan.json");
    await writeFile(malformed, "{");
    await writeFile(wrongSchema, "{}");
    const plan = JSON.parse(await readFile(inputs().plan, "utf8")) as {
      seed: number;
    };
    plan.seed += 1;
    await writeFile(stalePlan, JSON.stringify(plan));

    await expect(
      evaluateFiles({ ...inputs(), request: malformed }, { cwd }),
    ).rejects.toMatchObject({ code: "INVALID_JSON" });
    await expect(
      evaluateFiles(
        { ...inputs(), request: resolve(cwd, "missing.json") },
        {
          cwd,
        },
      ),
    ).rejects.toMatchObject({ code: "INPUT_NOT_FOUND" });
    await expect(
      evaluateFiles({ ...inputs(), manifest: wrongSchema }, { cwd }),
    ).rejects.toMatchObject({ code: "INPUT_SCHEMA_ERROR" });
    await expect(
      evaluateFiles({ ...inputs(), plan: stalePlan }, { cwd }),
    ).rejects.toMatchObject({ code: "INPUT_VALIDATION_ERROR" });
  });

  it("returns stable machine-readable errors without paths or stack traces", async () => {
    let stderr = "";
    const values = inputs();
    values.request = "definitely-missing.json";
    const code = await runEvaluatorCli(
      ["evaluate", ...flags(values), "--json-errors"],
      {
        stdout: () => undefined,
        stderr: (text) => {
          stderr += text;
        },
      },
    );

    expect(code).toBe(2);
    expect(JSON.parse(stderr)).toEqual({
      ok: false,
      error: {
        code: "INPUT_NOT_FOUND",
        message: "Input file not found: request",
      },
    });
    expect(stderr).not.toContain(process.cwd());
    expect(stderr).not.toContain("at runEvaluatorCli");
  });

  it("normalizes a non-directory output segment without leaking host paths", async () => {
    const cwd = await temporary();
    await writeFile(resolve(cwd, "blocked"), "not a directory");
    let stderr = "";
    const code = await runEvaluatorCli(
      ["evaluate", ...flags(inputs("blocked/child")), "--json-errors"],
      {
        stdout: () => undefined,
        stderr: (text) => {
          stderr += text;
        },
      },
      { cwd },
    );
    const payload = JSON.parse(stderr) as {
      error: { code: string; message: string };
    };

    expect(code).toBe(2);
    expect(payload.error.code).toBe("OUTPUT_PATH_NOT_DIRECTORY");
    expect(stderr).not.toContain(cwd);
    expect(payload.error.message).not.toMatch(/[A-Z]:\\|\/tmp\//iu);

    let textError = "";
    const textCode = await runEvaluatorCli(
      ["evaluate", ...flags(inputs("blocked/child"))],
      {
        stdout: () => undefined,
        stderr: (text) => {
          textError += text;
        },
      },
      { cwd },
    );
    expect(textCode).toBe(2);
    expect(textError).toContain("OUTPUT_PATH_NOT_DIRECTORY");
    expect(textError).not.toContain(cwd);
  });
});

describe("CLI path safety", () => {
  it("rejects traversal, reserved names, non-NFC paths, and size limits", async () => {
    const cwd = await temporary();
    await expect(
      evaluateFiles(inputs("../escape"), { cwd }),
    ).rejects.toMatchObject({ code: "UNSAFE_OUTPUT_PATH" });
    await expect(evaluateFiles(inputs("CON"), { cwd })).rejects.toMatchObject({
      code: "UNSAFE_OUTPUT_PATH",
    });
    await expect(
      evaluateFiles(inputs("e\u0301valuation"), { cwd }),
    ).rejects.toMatchObject({ code: "UNSAFE_OUTPUT_PATH" });
    await expect(
      evaluateFiles(inputs(), { cwd, limits: { maxInputFileBytes: 1 } }),
    ).rejects.toMatchObject({ code: "INPUT_SIZE_LIMIT" });
    await expect(
      evaluateFiles(inputs(), { cwd, limits: { maxOutputBytes: 1 } }),
    ).rejects.toMatchObject({ code: "OUTPUT_SIZE_LIMIT" });
  });

  it("rejects an existing Windows junction or portable directory symlink", async () => {
    const cwd = await temporary();
    const outside = await temporary("obby-evaluator-outside-");
    await symlink(
      outside,
      resolve(cwd, "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );

    await expect(
      evaluateFiles(inputs("linked/reports"), { cwd }),
    ).rejects.toMatchObject({ code: "UNSAFE_OUTPUT_PATH" });
  });

  it("rejects an identical final-output junction before reading it", async () => {
    const sourceCwd = await temporary("obby-evaluator-source-");
    const source = await evaluateFiles(inputs(), { cwd: sourceCwd });
    const targetCwd = await temporary("obby-evaluator-target-");
    const outputRoot = resolve(targetCwd, "output");
    await mkdir(outputRoot);
    const semanticName = source.outputDirectory.split(/[\\/]/u).at(-1);
    if (semanticName === undefined) throw new Error("missing semantic name");
    await symlink(
      source.outputDirectory,
      resolve(outputRoot, semanticName),
      process.platform === "win32" ? "junction" : "dir",
    );

    await expect(
      evaluateFiles(inputs(), { cwd: targetCwd }),
    ).rejects.toMatchObject({ code: "UNSAFE_OUTPUT_PATH" });
  });

  it.each(["before-read", "after-read"] as const)(
    "fails closed when the final output is replaced %s",
    async (replacementStep) => {
      const cwd = await temporary("obby-evaluator-existing-race-");
      const published = await evaluateFiles(inputs(), { cwd });
      const outside = await temporary("obby-evaluator-existing-outside-");
      let replaced = false;

      await expect(
        evaluateFiles(inputs(), {
          cwd,
          onExistingOutputStep: async (step) => {
            if (replaced || step !== replacementStep) return;
            replaced = true;
            await rename(
              published.outputDirectory,
              `${published.outputDirectory}-displaced`,
            );
            await symlink(
              outside,
              published.outputDirectory,
              process.platform === "win32" ? "junction" : "dir",
            );
          },
        }),
      ).rejects.toMatchObject({ code: "OUTPUT_ROOT_CHANGED" });
    },
  );

  it("normalizes permission failures from existing-output validation", async () => {
    const cwd = await temporary();
    await evaluateFiles(inputs(), { cwd });

    await expect(
      evaluateFiles(inputs(), {
        cwd,
        onExistingOutputStep: () => {
          throw Object.assign(new Error(`denied ${cwd}`), { code: "EACCES" });
        },
      }),
    ).rejects.toMatchObject({
      code: "FILESYSTEM_PERMISSION_DENIED",
      message: "A filesystem operation was not permitted",
    });
  });

  it("fails closed when an output ancestor is replaced before commit", async () => {
    const cwd = await temporary();
    const outside = await temporary("obby-evaluator-race-outside-");
    await expect(
      evaluateFiles(inputs(), {
        cwd,
        beforeCommit: async () => {
          await rename(resolve(cwd, "output"), resolve(cwd, "displaced"));
          await symlink(
            outside,
            resolve(cwd, "output"),
            process.platform === "win32" ? "junction" : "dir",
          );
        },
      }),
    ).rejects.toMatchObject({ code: "OUTPUT_ROOT_CHANGED" });

    expect(await readdir(outside)).toEqual([]);
  });

  it("rejects output/input identity collision", async () => {
    const cwd = await temporary();
    const requestPath = resolve(cwd, "request.json");
    await writeFile(requestPath, await readFile(inputs().request));

    await expect(
      evaluateFiles(
        { ...inputs("request.json"), request: requestPath },
        { cwd },
      ),
    ).rejects.toMatchObject({ code: "OUTPUT_INPUT_COLLISION" });
  });

  it("accepts exact input/output byte limits and rejects one byte below", async () => {
    const paths = Object.values(inputs()).filter((value) => value !== "output");
    const sizes = await Promise.all(
      paths.map(async (path) => (await stat(path)).size),
    );
    const maximumInput = Math.max(...sizes);
    const firstCwd = await temporary();
    const baseline = await evaluateFiles(inputs(), { cwd: firstCwd });
    const outputBytes =
      (await stat(resolve(baseline.outputDirectory, "report.json"))).size +
      (await stat(resolve(baseline.outputDirectory, "report.md"))).size;

    const exactCwd = await temporary();
    await expect(
      evaluateFiles(inputs(), {
        cwd: exactCwd,
        limits: {
          maxInputFileBytes: maximumInput,
          maxOutputBytes: outputBytes,
        },
      }),
    ).resolves.toBeDefined();
    await expect(
      evaluateFiles(inputs(), {
        cwd: await temporary(),
        limits: { maxInputFileBytes: maximumInput - 1 },
      }),
    ).rejects.toMatchObject({ code: "INPUT_SIZE_LIMIT" });
    await expect(
      evaluateFiles(inputs(), {
        cwd: await temporary(),
        limits: { maxOutputBytes: outputBytes - 1 },
      }),
    ).rejects.toMatchObject({ code: "OUTPUT_SIZE_LIMIT" });
  });

  it("treats case variants as the same collision domain on Windows", async () => {
    if (process.platform !== "win32") return;
    const cwd = await temporary();
    await mkdir(resolve(cwd, "Output"));
    const first = await evaluateFiles(inputs("Output"), { cwd });
    const second = await evaluateFiles(inputs("output"), { cwd });

    expect(second.outputDirectory.toLowerCase()).toBe(
      first.outputDirectory.toLowerCase(),
    );
  });
});

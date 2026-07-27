import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import {
  canonicalizeEvaluatorSnapshot,
  compareUnicodeScalars,
  type JsonValue,
} from "@obby/canonical-json";
import { assertValidSceneManifest } from "@obby/contracts";
import type { ContentHash } from "@obby/obby-evaluator-contracts";
import {
  assembleE1Evaluation,
  renderMarkdownReport,
} from "@obby/scoring-engine";

export const CLI_VERSION = "0.1.0";
export type EvaluatorCliLimits = {
  maxInputFileBytes: number;
  maxOutputBytes: number;
  maxOutputPathLength: number;
};

export const CLI_LIMITS: Readonly<EvaluatorCliLimits> = Object.freeze({
  maxInputFileBytes: 8_388_608,
  maxOutputBytes: 16_777_216,
  maxOutputPathLength: 240,
});

export class EvaluatorCliError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly exitCode = 2,
  ) {
    super(message);
    this.name = "EvaluatorCliError";
  }
}

export type EvaluateFileInputs = {
  request: string;
  plan: string;
  definitions: string;
  catalog: string;
  profile: string;
  manifest: string;
  evidence: string;
  availability: string;
  output: string;
};

export type EvaluateFilesOptions = {
  cwd?: string;
  limits?: Partial<EvaluatorCliLimits>;
  beforeCommit?: (temporaryDirectory: string) => void | Promise<void>;
};

export type PublishedEvaluation = {
  outputDirectory: string;
  reportFilename: "report.json";
  markdownFilename: "report.md";
  reportPayloadHash: ContentHash;
  reportRenderHash: ContentHash;
};

async function readJson(path: string, maximum: number): Promise<unknown> {
  const handle = await open(path, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) {
      throw new EvaluatorCliError(
        "INPUT_NOT_FILE",
        `Input is not a file: ${path}`,
      );
    }
    if (stat.size > maximum) {
      throw new EvaluatorCliError(
        "INPUT_SIZE_LIMIT",
        `Input exceeds ${maximum} bytes: ${path}`,
      );
    }
    const bytes = await handle.readFile();
    try {
      return JSON.parse(bytes.toString("utf8")) as unknown;
    } catch {
      throw new EvaluatorCliError(
        "INVALID_JSON",
        `Input is not valid JSON: ${path}`,
      );
    }
  } finally {
    await handle.close();
  }
}

function safeOutputRoot(
  cwd: string,
  supplied: string,
  maximumLength: number,
): string {
  if (isAbsolute(supplied) || supplied.split(/[\\/]/u).includes("..")) {
    throw new EvaluatorCliError(
      "UNSAFE_OUTPUT_PATH",
      "Output must be a relative path inside the working directory",
    );
  }
  const target = resolve(cwd, supplied);
  const rel = relative(cwd, target);
  if (
    rel === "" ||
    rel.startsWith(`..${sep}`) ||
    rel === ".." ||
    target.length > maximumLength
  ) {
    throw new EvaluatorCliError(
      "UNSAFE_OUTPUT_PATH",
      "Output path is outside safe limits",
    );
  }
  return target;
}

async function rejectSymlinkSegments(
  cwd: string,
  target: string,
): Promise<void> {
  const rel = relative(cwd, target);
  let current = cwd;
  for (const segment of rel.split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new EvaluatorCliError(
          "UNSAFE_OUTPUT_PATH",
          `Output path contains a symbolic link: ${current}`,
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      break;
    }
  }
}

async function durableWrite(path: string, bytes: Uint8Array): Promise<void> {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function existingOutputMatches(
  directory: string,
  reportBytes: Uint8Array,
  markdownBytes: Uint8Array,
): Promise<boolean> {
  try {
    const [report, markdown] = await Promise.all([
      readFile(resolve(directory, "report.json")),
      readFile(resolve(directory, "report.md")),
    ]);
    return report.equals(reportBytes) && markdown.equals(markdownBytes);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function evaluateFiles(
  inputs: EvaluateFileInputs,
  options: EvaluateFilesOptions = {},
): Promise<PublishedEvaluation> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const limits = { ...CLI_LIMITS, ...options.limits };
  const outputRoot = safeOutputRoot(
    cwd,
    inputs.output,
    limits.maxOutputPathLength,
  );
  await rejectSymlinkSegments(cwd, outputRoot);
  const [
    request,
    plan,
    definitions,
    catalog,
    profile,
    manifestInput,
    evidenceInput,
    availabilityInput,
  ] = await Promise.all(
    [
      inputs.request,
      inputs.plan,
      inputs.definitions,
      inputs.catalog,
      inputs.profile,
      inputs.manifest,
      inputs.evidence,
      inputs.availability,
    ].map((path) => readJson(resolve(cwd, path), limits.maxInputFileBytes)),
  );
  const manifest = assertValidSceneManifest(manifestInput);
  if (!Array.isArray(definitions)) {
    throw new EvaluatorCliError(
      "INVALID_INPUT_SHAPE",
      "Metric definitions must be an array",
    );
  }
  if (typeof evidenceInput !== "object" || evidenceInput === null) {
    throw new EvaluatorCliError(
      "INVALID_INPUT_SHAPE",
      "Evidence bundle must be an object",
    );
  }
  const bundle = evidenceInput as {
    evidence?: unknown;
    findings?: unknown;
    manifestHash?: unknown;
  };
  if (!Array.isArray(bundle.evidence) || !Array.isArray(bundle.findings)) {
    throw new EvaluatorCliError(
      "INVALID_INPUT_SHAPE",
      "Evidence bundle must contain evidence and findings arrays",
    );
  }
  if (bundle.manifestHash !== manifest.manifestHash) {
    throw new EvaluatorCliError(
      "MANIFEST_SCOPE_MISMATCH",
      "Evidence bundle does not match the validated SceneManifest",
    );
  }
  if (!Array.isArray(availabilityInput)) {
    throw new EvaluatorCliError(
      "INVALID_INPUT_SHAPE",
      "Availability records must be an array",
    );
  }
  const assembled = assembleE1Evaluation({
    metricDefinitions: definitions,
    catalog,
    profile,
    plan,
    request,
    evaluatorVersion: CLI_VERSION,
    componentVersions: {
      "obby-evaluator-contracts": "0.1.0",
      "geometry-evaluator": "0.1.0",
      "route-playability-evaluator": "0.1.0",
      "scoring-engine": "0.1.0",
    },
    evidence: bundle.evidence,
    findings: bundle.findings,
    availabilityRecords: availabilityInput,
  });
  const rendered = renderMarkdownReport(assembled.report);
  const reportBytes = new TextEncoder().encode(
    `${canonicalizeEvaluatorSnapshot(assembled.report as unknown as JsonValue).canonicalText}\n`,
  );
  const outputBytes = reportBytes.byteLength + rendered.bytes.byteLength;
  if (outputBytes > limits.maxOutputBytes) {
    throw new EvaluatorCliError(
      "OUTPUT_SIZE_LIMIT",
      `Output requires ${outputBytes} bytes, exceeding ${limits.maxOutputBytes}`,
    );
  }
  await mkdir(outputRoot, { recursive: true });
  await rejectSymlinkSegments(cwd, outputRoot);
  const semanticName = `report-${assembled.report.reportPayloadHash.slice(7, 23)}`;
  const finalDirectory = resolve(outputRoot, semanticName);
  if (
    await existingOutputMatches(finalDirectory, reportBytes, rendered.bytes)
  ) {
    return {
      outputDirectory: finalDirectory,
      reportFilename: "report.json",
      markdownFilename: "report.md",
      reportPayloadHash: assembled.report.reportPayloadHash,
      reportRenderHash: rendered.reportRenderHash,
    };
  }
  try {
    await lstat(finalDirectory);
    throw new EvaluatorCliError(
      "OUTPUT_CONFLICT",
      `Deterministic output directory already exists with different content: ${semanticName}`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporaryDirectory = resolve(
    outputRoot,
    `.obby-evaluator-${process.pid}-${assembled.report.reportPayloadHash.slice(7, 19)}.tmp`,
  );
  await rm(temporaryDirectory, { force: true, recursive: true });
  await mkdir(temporaryDirectory, { recursive: false, mode: 0o700 });
  try {
    const orderedOutputs = [
      ["report.json", reportBytes] as const,
      ["report.md", rendered.bytes] as const,
    ].toSorted((left, right) => compareUnicodeScalars(left[0], right[0]));
    for (const [name, bytes] of orderedOutputs) {
      await durableWrite(resolve(temporaryDirectory, name), bytes);
    }
    await options.beforeCommit?.(temporaryDirectory);
    await rename(temporaryDirectory, finalDirectory);
  } catch (error) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    throw error;
  }
  return {
    outputDirectory: finalDirectory,
    reportFilename: "report.json",
    markdownFilename: "report.md",
    reportPayloadHash: assembled.report.reportPayloadHash,
    reportRenderHash: rendered.reportRenderHash,
  };
}

const REQUIRED_FLAGS = [
  "request",
  "plan",
  "definitions",
  "catalog",
  "profile",
  "manifest",
  "evidence",
  "availability",
  "output",
] as const;

export function parseCliArguments(argv: readonly string[]): {
  inputs: EvaluateFileInputs;
  jsonErrors: boolean;
} {
  if (argv[0] !== "evaluate") {
    throw new EvaluatorCliError("USAGE", "Expected command: evaluate", 64);
  }
  const values = new Map<string, string>();
  let jsonErrors = false;
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json-errors") {
      jsonErrors = true;
      continue;
    }
    if (!token?.startsWith("--")) {
      throw new EvaluatorCliError(
        "USAGE",
        `Unexpected argument: ${token ?? "missing"}`,
        64,
      );
    }
    const name = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--") || values.has(name)) {
      throw new EvaluatorCliError("USAGE", `Invalid value for --${name}`, 64);
    }
    values.set(name, value);
    index += 1;
  }
  for (const flag of REQUIRED_FLAGS) {
    if (!values.has(flag)) {
      throw new EvaluatorCliError("USAGE", `Missing required --${flag}`, 64);
    }
  }
  return {
    inputs: Object.fromEntries(
      REQUIRED_FLAGS.map((flag) => [flag, values.get(flag)]),
    ) as EvaluateFileInputs,
    jsonErrors,
  };
}

export async function runEvaluatorCli(
  argv: readonly string[],
  output: { stdout: (text: string) => void; stderr: (text: string) => void } = {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  },
): Promise<number> {
  let jsonErrors = argv.includes("--json-errors");
  try {
    const parsed = parseCliArguments(argv);
    jsonErrors = parsed.jsonErrors;
    const result = await evaluateFiles(parsed.inputs);
    output.stdout(`${JSON.stringify({ ok: true, ...result })}\n`);
    return 0;
  } catch (error) {
    const known =
      error instanceof EvaluatorCliError
        ? error
        : new EvaluatorCliError(
            "EVALUATION_FAILED",
            error instanceof Error ? error.message : "Evaluation failed",
            1,
          );
    output.stderr(
      jsonErrors
        ? `${JSON.stringify({ ok: false, error: { code: known.code, message: known.message } })}\n`
        : `obby-evaluator: ${known.code}: ${known.message}\n`,
    );
    return known.exitCode;
  }
}

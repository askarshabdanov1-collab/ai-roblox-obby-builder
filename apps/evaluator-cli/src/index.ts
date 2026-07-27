import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
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
  onAtomicStep?: (
    step:
      | "first-file-write"
      | "second-file-write"
      | "file-sync"
      | "temporary-directory-sync"
      | "rename"
      | "final-parent-sync"
      | "cleanup",
  ) => void | Promise<void>;
};

export type PublishedEvaluation = {
  outputDirectory: string;
  reportFilename: "report.json";
  markdownFilename: "report.md";
  reportPayloadHash: ContentHash;
  reportRenderHash: ContentHash;
};

async function readJson(
  label: string,
  path: string,
  maximum: number,
): Promise<unknown> {
  let handle;
  try {
    handle = await open(path, "r");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    throw new EvaluatorCliError(
      code === "ENOENT" ? "INPUT_NOT_FOUND" : "INPUT_UNREADABLE",
      code === "ENOENT"
        ? `Input file not found: ${label}`
        : `Input file cannot be read: ${label}`,
    );
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) {
      throw new EvaluatorCliError(
        "INPUT_NOT_FILE",
        `Input is not a file: ${label}`,
      );
    }
    if (stat.size > maximum) {
      throw new EvaluatorCliError(
        "INPUT_SIZE_LIMIT",
        `Input exceeds ${maximum} bytes: ${label}`,
      );
    }
    const bytes = await handle.readFile();
    try {
      return JSON.parse(bytes.toString("utf8")) as unknown;
    } catch {
      throw new EvaluatorCliError(
        "INVALID_JSON",
        `Input is not valid JSON: ${label}`,
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
  const segments = supplied.split(/[\\/]/u).filter(Boolean);
  const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
  if (
    isAbsolute(supplied) ||
    segments.includes("..") ||
    segments.some(
      (segment) =>
        segment !== segment.normalize("NFC") ||
        reserved.test(segment) ||
        /[. ]$/u.test(segment),
    )
  ) {
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

function collisionKey(path: string): string {
  const normalized = resolve(path).normalize("NFC");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

type DirectoryIdentity = {
  path: string;
  realPath: string;
  device: number;
  inode: number;
  birthtimeMs: number;
};

async function directoryIdentity(path: string): Promise<DirectoryIdentity> {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new EvaluatorCliError(
      "UNSAFE_OUTPUT_PATH",
      "Output path contains a non-directory or reparse-point segment",
    );
  }
  return {
    path,
    realPath: await realpath(path),
    device: info.dev,
    inode: info.ino,
    birthtimeMs: info.birthtimeMs,
  };
}

async function captureDirectoryChain(
  cwd: string,
  target: string,
): Promise<DirectoryIdentity[]> {
  const identities = [await directoryIdentity(cwd)];
  let current = cwd;
  for (const segment of relative(cwd, target).split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    identities.push(await directoryIdentity(current));
  }
  const rootRealPath = identities[0]?.realPath;
  const targetRealPath = identities.at(-1)?.realPath;
  if (
    rootRealPath === undefined ||
    targetRealPath === undefined ||
    relative(rootRealPath, targetRealPath).startsWith(`..${sep}`)
  ) {
    throw new EvaluatorCliError(
      "UNSAFE_OUTPUT_PATH",
      "Output directory resolves outside the working directory",
    );
  }
  return identities;
}

async function assertDirectoryChain(
  expected: readonly DirectoryIdentity[],
): Promise<void> {
  for (const identity of expected) {
    let actual: DirectoryIdentity;
    try {
      actual = await directoryIdentity(identity.path);
    } catch {
      throw new EvaluatorCliError(
        "OUTPUT_ROOT_CHANGED",
        "Output directory identity changed during publication",
      );
    }
    if (
      actual.realPath !== identity.realPath ||
      actual.device !== identity.device ||
      actual.inode !== identity.inode ||
      actual.birthtimeMs !== identity.birthtimeMs
    ) {
      throw new EvaluatorCliError(
        "OUTPUT_ROOT_CHANGED",
        "Output directory identity changed during publication",
      );
    }
  }
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

async function durableWrite(
  path: string,
  bytes: Uint8Array,
  onAtomicStep: EvaluateFilesOptions["onAtomicStep"],
): Promise<void> {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await onAtomicStep?.("file-sync");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(
  path: string,
  step: "temporary-directory-sync" | "final-parent-sync",
  onAtomicStep: EvaluateFilesOptions["onAtomicStep"],
): Promise<void> {
  await onAtomicStep?.(step);
  let handle;
  try {
    handle = await open(path, "r");
    await handle.sync();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (
      !["EACCES", "EINVAL", "EISDIR", "ENOTSUP", "EPERM"].includes(code ?? "")
    ) {
      throw error;
    }
  } finally {
    await handle?.close();
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
  const inputEntries = [
    ["request", inputs.request],
    ["plan", inputs.plan],
    ["definitions", inputs.definitions],
    ["catalog", inputs.catalog],
    ["profile", inputs.profile],
    ["manifest", inputs.manifest],
    ["evidence", inputs.evidence],
    ["availability", inputs.availability],
  ] as const;
  if (
    inputEntries.some(
      ([, path]) =>
        collisionKey(resolve(cwd, path)) === collisionKey(outputRoot),
    )
  ) {
    throw new EvaluatorCliError(
      "OUTPUT_INPUT_COLLISION",
      "Output directory must not be an input file",
    );
  }
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
    inputEntries.map(([label, path]) =>
      readJson(label, resolve(cwd, path), limits.maxInputFileBytes),
    ),
  );
  let manifest;
  try {
    manifest = assertValidSceneManifest(manifestInput);
  } catch {
    throw new EvaluatorCliError(
      "INPUT_SCHEMA_ERROR",
      "SceneManifest failed schema or semantic validation",
    );
  }
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
  let assembled;
  try {
    assembled = assembleE1Evaluation({
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
  } catch {
    throw new EvaluatorCliError(
      "INPUT_VALIDATION_ERROR",
      "Evaluator inputs failed identity, graph, or policy validation",
    );
  }
  const reportBytes = new TextEncoder().encode(
    `${canonicalizeEvaluatorSnapshot(assembled.report as unknown as JsonValue).canonicalText}\n`,
  );
  if (reportBytes.byteLength > limits.maxOutputBytes) {
    throw new EvaluatorCliError(
      "OUTPUT_SIZE_LIMIT",
      `Report JSON exceeds ${limits.maxOutputBytes} bytes`,
    );
  }
  let rendered;
  try {
    rendered = renderMarkdownReport(assembled.report, {
      maxBytes: limits.maxOutputBytes - reportBytes.byteLength,
      maxWorkUnits: 100_000,
    });
  } catch {
    throw new EvaluatorCliError(
      "OUTPUT_SIZE_LIMIT",
      `Combined semantic output exceeds ${limits.maxOutputBytes} bytes`,
    );
  }
  await mkdir(outputRoot, { recursive: true });
  await rejectSymlinkSegments(cwd, outputRoot);
  const outputChain = await captureDirectoryChain(cwd, outputRoot);
  const semanticName = `report-${assembled.report.reportPayloadHash.slice(7)}`;
  const finalDirectory = resolve(outputRoot, semanticName);
  if (finalDirectory.length > limits.maxOutputPathLength) {
    throw new EvaluatorCliError(
      "UNSAFE_OUTPUT_PATH",
      "Final semantic output path exceeds the configured limit",
    );
  }
  const finalFiles = [
    resolve(finalDirectory, "report.json"),
    resolve(finalDirectory, "report.md"),
  ];
  const inputKeys = new Set(
    inputEntries.map(([, path]) => collisionKey(resolve(cwd, path))),
  );
  if (finalFiles.some((path) => inputKeys.has(collisionKey(path)))) {
    throw new EvaluatorCliError(
      "OUTPUT_INPUT_COLLISION",
      "Final output files must not replace evaluator inputs",
    );
  }
  const published = (): PublishedEvaluation => ({
    outputDirectory: finalDirectory,
    reportFilename: "report.json",
    markdownFilename: "report.md",
    reportPayloadHash: assembled.report.reportPayloadHash,
    reportRenderHash: rendered.reportRenderHash,
  });
  if (
    await existingOutputMatches(finalDirectory, reportBytes, rendered.bytes)
  ) {
    return published();
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
    `.obby-evaluator-${assembled.report.reportPayloadHash.slice(7)}-${process.pid}-${randomUUID()}.tmp`,
  );
  await mkdir(temporaryDirectory, { recursive: false, mode: 0o700 });
  const publicationState = { committed: false };
  try {
    const orderedOutputs = [
      ["report.json", reportBytes] as const,
      ["report.md", rendered.bytes] as const,
    ].toSorted((left, right) => compareUnicodeScalars(left[0], right[0]));
    for (let index = 0; index < orderedOutputs.length; index += 1) {
      const output = orderedOutputs[index];
      if (output === undefined) continue;
      const [name, bytes] = output;
      await options.onAtomicStep?.(
        index === 0 ? "first-file-write" : "second-file-write",
      );
      await durableWrite(
        resolve(temporaryDirectory, name),
        bytes,
        options.onAtomicStep,
      );
    }
    await syncDirectory(
      temporaryDirectory,
      "temporary-directory-sync",
      options.onAtomicStep,
    );
    await options.beforeCommit?.(temporaryDirectory);
    await assertDirectoryChain(outputChain);
    await options.onAtomicStep?.("rename");
    try {
      await rename(temporaryDirectory, finalDirectory);
      publicationState.committed = true;
    } catch (error) {
      if (
        ["EEXIST", "ENOTEMPTY", "EPERM"].includes(
          (error as NodeJS.ErrnoException).code ?? "",
        ) &&
        (await existingOutputMatches(
          finalDirectory,
          reportBytes,
          rendered.bytes,
        ))
      ) {
        await rm(temporaryDirectory, { force: true, recursive: true });
        return published();
      }
      throw error;
    }
    await assertDirectoryChain(outputChain);
    await syncDirectory(outputRoot, "final-parent-sync", options.onAtomicStep);
  } catch (error) {
    const publicationError =
      error instanceof EvaluatorCliError && error.code === "OUTPUT_ROOT_CHANGED"
        ? error
        : new EvaluatorCliError(
            "OUTPUT_PUBLICATION_FAILED",
            "Atomic output publication failed",
          );
    if (!publicationState.committed) {
      try {
        await assertDirectoryChain(outputChain);
        await options.onAtomicStep?.("cleanup");
        await rm(temporaryDirectory, { force: true, recursive: true });
      } catch (cleanupError) {
        if (publicationError.code === "OUTPUT_ROOT_CHANGED") {
          throw publicationError;
        }
        throw new EvaluatorCliError(
          "CLEANUP_FAILED",
          cleanupError instanceof Error
            ? "Temporary output cleanup failed"
            : "Temporary output cleanup failed",
        );
      }
    }
    throw publicationError;
  }
  return published();
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
    if (!(REQUIRED_FLAGS as readonly string[]).includes(name)) {
      throw new EvaluatorCliError(
        "USAGE_UNKNOWN_OPTION",
        `Unknown option: --${name}`,
        64,
      );
    }
    const value = argv[index + 1];
    if (values.has(name)) {
      throw new EvaluatorCliError(
        "USAGE_DUPLICATE_OPTION",
        `Duplicate option: --${name}`,
        64,
      );
    }
    if (value === undefined || value.startsWith("--")) {
      throw new EvaluatorCliError(
        "USAGE_MISSING_VALUE",
        `Missing value for --${name}`,
        64,
      );
    }
    values.set(name, value);
    index += 1;
  }
  for (const flag of REQUIRED_FLAGS) {
    if (!values.has(flag)) {
      throw new EvaluatorCliError(
        "USAGE_MISSING_OPTION",
        `Missing required --${flag}`,
        64,
      );
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

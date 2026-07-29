import { lstat, mkdir, open, realpath, rmdir, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { evaluatorCanonicalStringify } from "@obby/canonical-json";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  GeneratorContractError,
  generateObby,
} from "@obby/obby-generator";
import type {
  GeneratorConfiguration,
  MechanicCatalog,
} from "@obby/obby-generator";
import type { GenerationBundle } from "@obby/obby-generator-contracts";
import type {
  LayoutConfiguration,
  MechanicLayoutDefinition,
} from "@obby/obby-layout-contracts";
import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
} from "@obby/obby-layout-engine";

import { buildG1ArtifactSet } from "./layout-workflow.js";

export type GeneratorCliStreams = {
  stdout: { write(text: string): unknown };
  stderr: { write(text: string): unknown };
};
export type GeneratorCliOptions = {
  cwd?: string;
  platform?: NodeJS.Platform;
  beforeCommit?: (temporaryDirectory: string) => void | Promise<void>;
  onAtomicStep?: (
    step:
      | "file-write"
      | "file-sync"
      | "temporary-directory-sync"
      | "destination-claim"
      | "final-commit"
      | "before-no-replace-commit"
      | "final-directory-sync"
      | "rename"
      | "final-parent-sync"
      | "cleanup",
  ) => void | Promise<void>;
};
type GenerateOptions = {
  command: "generate";
  requestPath: string;
  configurationPath?: string;
  catalogPath?: string;
  outputDirectory: string;
  jsonErrors: boolean;
};
type LayoutOptions = {
  command: "layout";
  bundlePath: string;
  generatorConfigurationPath?: string;
  catalogPath?: string;
  layoutConfigurationPath?: string;
  layoutDefinitionsPath?: string;
  outputDirectory: string;
  jsonErrors: boolean;
};
type Options = GenerateOptions | LayoutOptions;

function parseArguments(arguments_: readonly string[]): Options {
  const command = arguments_[0];
  if (command !== "generate" && command !== "layout")
    throw new GeneratorContractError(
      "usage",
      "expected command: generate or layout",
    );
  const values = new Map<string, string>();
  let jsonErrors = false;
  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--json-errors") {
      if (jsonErrors)
        throw new GeneratorContractError(
          "usage",
          "duplicate option --json-errors",
        );
      jsonErrors = true;
      continue;
    }
    const allowed =
      command === "generate"
        ? ["--request", "--config", "--catalog", "--output"]
        : [
            "--bundle",
            "--generator-config",
            "--catalog",
            "--layout-config",
            "--layout-definitions",
            "--output",
          ];
    if (!allowed.includes(argument ?? ""))
      throw new GeneratorContractError(
        "usage",
        `unknown argument ${String(argument)}`,
      );
    if (argument === undefined)
      throw new GeneratorContractError("usage", "missing argument name");
    if (values.has(argument))
      throw new GeneratorContractError("usage", `duplicate option ${argument}`);
    const value = arguments_[index + 1];
    if (value === undefined || value.startsWith("--"))
      throw new GeneratorContractError("usage", `${argument} requires a value`);
    values.set(argument, value);
    index += 1;
  }
  const outputDirectory = values.get("--output");
  if (outputDirectory === undefined)
    throw new GeneratorContractError("usage", "--output is required");
  if (command === "generate") {
    const requestPath = values.get("--request");
    if (requestPath === undefined)
      throw new GeneratorContractError("usage", "--request is required");
    const configurationPath = values.get("--config");
    const catalogPath = values.get("--catalog");
    return {
      command,
      requestPath,
      outputDirectory,
      jsonErrors,
      ...(configurationPath === undefined ? {} : { configurationPath }),
      ...(catalogPath === undefined ? {} : { catalogPath }),
    };
  }
  const bundlePath = values.get("--bundle");
  if (bundlePath === undefined)
    throw new GeneratorContractError("usage", "--bundle is required");
  const generatorConfigurationPath = values.get("--generator-config");
  const catalogPath = values.get("--catalog");
  const layoutConfigurationPath = values.get("--layout-config");
  const layoutDefinitionsPath = values.get("--layout-definitions");
  return {
    command,
    bundlePath,
    outputDirectory,
    jsonErrors,
    ...(generatorConfigurationPath === undefined
      ? {}
      : { generatorConfigurationPath }),
    ...(catalogPath === undefined ? {} : { catalogPath }),
    ...(layoutConfigurationPath === undefined
      ? {}
      : { layoutConfigurationPath }),
    ...(layoutDefinitionsPath === undefined ? {} : { layoutDefinitionsPath }),
  };
}

function collisionKey(path: string): string {
  const normalized = resolve(path).normalize("NFC");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function safeInputPath(cwd: string, supplied: string): string {
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
  )
    throw new GeneratorContractError(
      "path-safety",
      "input must be a normalized relative path inside the working directory",
    );
  const target = resolve(cwd, supplied);
  const relation = relative(cwd, target);
  if (relation === "" || relation === ".." || relation.startsWith(`..${sep}`))
    throw new GeneratorContractError(
      "path-safety",
      "input path is outside safe limits",
    );
  return target;
}

async function rejectInputReparseSegments(
  cwd: string,
  target: string,
): Promise<void> {
  const segments = relative(cwd, target).split(sep).filter(Boolean);
  let current = cwd;
  for (const [index, segment] of segments.entries()) {
    current = resolve(current, segment);
    try {
      const info = await lstat(current);
      const isFinal = index === segments.length - 1;
      if (
        info.isSymbolicLink() ||
        (isFinal ? !info.isFile() : !info.isDirectory())
      )
        throw new GeneratorContractError(
          "path-safety",
          "input contains a non-regular or reparse-point segment",
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
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
  )
    throw new GeneratorContractError(
      "path-safety",
      "output must be a normalized relative path inside the working directory",
    );
  const target = resolve(cwd, supplied);
  const rel = relative(cwd, target);
  if (
    rel === "" ||
    rel === ".." ||
    rel.startsWith(`..${sep}`) ||
    target.length > maximumLength
  )
    throw new GeneratorContractError(
      "path-safety",
      "output path is outside safe limits",
    );
  return target;
}

async function readBoundedJson(
  label: string,
  path: string,
  maximumBytes: number,
): Promise<unknown> {
  let handle;
  try {
    handle = await open(path, "r");
  } catch (error) {
    throw new GeneratorContractError(
      (error as NodeJS.ErrnoException).code === "ENOENT"
        ? "input"
        : "path-safety",
      `${label} cannot be opened`,
    );
  }
  try {
    const info = await handle.stat();
    if (!info.isFile())
      throw new GeneratorContractError(
        "path-safety",
        `${label} is not a regular file`,
      );
    if (info.size > maximumBytes)
      throw new GeneratorContractError(
        "input-too-large",
        `${label} exceeds ${maximumBytes} bytes`,
      );
    const bytes = await handle.readFile();
    if (bytes.byteLength > maximumBytes)
      throw new GeneratorContractError(
        "input-too-large",
        `${label} changed beyond its size limit`,
      );
    try {
      return JSON.parse(bytes.toString("utf8")) as unknown;
    } catch {
      throw new GeneratorContractError("input", `${label} is not valid JSON`);
    }
  } finally {
    await handle.close();
  }
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
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new GeneratorContractError(
      "path-safety",
      "output contains a non-directory or reparse-point segment",
    );
  return {
    path,
    realPath: await realpath(path),
    device: info.dev,
    inode: info.ino,
    birthtimeMs: info.birthtimeMs,
  };
}

async function rejectSymlinkSegments(
  cwd: string,
  target: string,
): Promise<void> {
  let current = cwd;
  for (const segment of relative(cwd, target).split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory())
        throw new GeneratorContractError(
          "path-safety",
          "output contains a non-directory or reparse-point segment",
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      else break;
    }
  }
}

async function captureDirectoryChain(
  cwd: string,
  target: string,
): Promise<DirectoryIdentity[]> {
  const result = [await directoryIdentity(cwd)];
  let current = cwd;
  for (const segment of relative(cwd, target).split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    result.push(await directoryIdentity(current));
  }
  const root = result[0]?.realPath;
  const end = result.at(-1)?.realPath;
  if (
    root === undefined ||
    end === undefined ||
    relative(root, end) === ".." ||
    relative(root, end).startsWith(`..${sep}`)
  )
    throw new GeneratorContractError(
      "path-safety",
      "output resolves outside the working directory",
    );
  return result;
}

async function assertDirectoryChain(
  expected: readonly DirectoryIdentity[],
): Promise<void> {
  for (const identity of expected) {
    let actual: DirectoryIdentity;
    try {
      actual = await directoryIdentity(identity.path);
    } catch {
      throw new GeneratorContractError(
        "path-safety",
        "output directory identity changed during publication",
      );
    }
    if (
      actual.realPath !== identity.realPath ||
      actual.device !== identity.device ||
      actual.inode !== identity.inode ||
      actual.birthtimeMs !== identity.birthtimeMs
    )
      throw new GeneratorContractError(
        "path-safety",
        "output directory identity changed during publication",
      );
  }
}

function sameDirectoryIdentity(
  left: DirectoryIdentity,
  right: DirectoryIdentity,
  includePath = true,
): boolean {
  return (
    (!includePath || left.realPath === right.realPath) &&
    left.device === right.device &&
    left.inode === right.inode &&
    left.birthtimeMs === right.birthtimeMs
  );
}

async function assertOwnedDirectory(
  identity: DirectoryIdentity,
): Promise<void> {
  let actual: DirectoryIdentity;
  try {
    actual = await directoryIdentity(identity.path);
  } catch {
    throw new GeneratorContractError(
      "path-safety",
      "private publication lock identity changed",
    );
  }
  if (!sameDirectoryIdentity(actual, identity))
    throw new GeneratorContractError(
      "path-safety",
      "private publication lock identity changed",
    );
}

async function syncDirectory(
  path: string,
  step:
    "temporary-directory-sync" | "final-directory-sync" | "final-parent-sync",
  hook: GeneratorCliOptions["onAtomicStep"],
): Promise<void> {
  await hook?.(step);
  let handle;
  try {
    handle = await open(path, "r");
    await handle.sync();
  } catch (error) {
    if (
      !["EACCES", "EINVAL", "EISDIR", "ENOTSUP", "EPERM"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      throw error;
  } finally {
    await handle?.close();
  }
}

async function assertDestinationAbsent(
  finalPath: string,
  directoryName: string,
): Promise<void> {
  try {
    const finalInfo = await lstat(finalPath);
    if (finalInfo.isSymbolicLink())
      throw new GeneratorContractError(
        "path-safety",
        "final output is a symbolic link or reparse point",
      );
    throw new GeneratorContractError(
      "output-conflict",
      `output already exists: ${directoryName}`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function throwDestinationConflict(
  finalPath: string,
  directoryName: string,
): Promise<never> {
  try {
    const finalInfo = await lstat(finalPath);
    if (finalInfo.isSymbolicLink())
      throw new GeneratorContractError(
        "path-safety",
        "final output is a symbolic link or reparse point",
      );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  throw new GeneratorContractError(
    "output-conflict",
    `output already exists: ${directoryName}`,
  );
}

const LINUX_NO_REPLACE_HELPER = fileURLToPath(
  new URL("../native/rename-noreplace.py", import.meta.url),
);
const WINDOWS_NO_REPLACE_HELPER = fileURLToPath(
  new URL("../native/move-noreplace.ps1", import.meta.url),
);

async function runNoReplaceHelper(
  executable: string,
  arguments_: readonly string[],
): Promise<number> {
  return new Promise((resolveExit, rejectExit) => {
    const child = spawn(executable, arguments_, {
      shell: false,
      stdio: "ignore",
      windowsHide: true,
    });
    let settled = false;
    child.once("error", () => {
      if (settled) return;
      settled = true;
      rejectExit(
        new GeneratorContractError(
          "output-publication",
          "atomic no-replace publication is unavailable",
        ),
      );
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      resolveExit(code ?? 30);
    });
  });
}

async function commitDirectoryNoReplace(
  source: string,
  destination: string,
  directoryName: string,
  platform: NodeJS.Platform,
): Promise<void> {
  if (platform === "linux") {
    const exitCode = await runNoReplaceHelper("python3", [
      LINUX_NO_REPLACE_HELPER,
      source,
      destination,
    ]);
    if (exitCode === 0) return;
    if (exitCode === 10)
      await throwDestinationConflict(destination, directoryName);
    throw new GeneratorContractError(
      "output-publication",
      "atomic no-replace publication is unavailable",
    );
  }
  if (platform === "win32") {
    const exitCode = await runNoReplaceHelper("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-File",
      WINDOWS_NO_REPLACE_HELPER,
      source,
      destination,
    ]);
    if (exitCode === 0) return;
    if (exitCode === 10)
      await throwDestinationConflict(destination, directoryName);
    throw new GeneratorContractError(
      "output-publication",
      "atomic no-replace publication is unavailable",
    );
  }
  throw new GeneratorContractError(
    "output-publication",
    "atomic no-replace publication is unsupported on this platform",
  );
}

async function claimPrivateLock(
  lockPath: string,
  directoryName: string,
): Promise<DirectoryIdentity> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await mkdir(lockPath, { mode: 0o700 });
      return await directoryIdentity(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const info = await lstat(lockPath);
        if (info.isSymbolicLink())
          throw new GeneratorContractError(
            "path-safety",
            "private publication lock is a reparse point",
          );
        throw new GeneratorContractError(
          "output-conflict",
          `output publication is already claimed: ${directoryName}`,
        );
      } catch (inspectionError) {
        if ((inspectionError as NodeJS.ErrnoException).code === "ENOENT")
          continue;
        throw inspectionError;
      }
    }
  }
  throw new GeneratorContractError(
    "output-conflict",
    `output publication is already claimed: ${directoryName}`,
  );
}

async function publish(
  cwd: string,
  outputRoot: string,
  directoryName: string,
  files: Readonly<Record<string, Uint8Array>>,
  options: GeneratorCliOptions,
): Promise<string> {
  try {
    await rejectSymlinkSegments(cwd, outputRoot);
    await mkdir(outputRoot, { recursive: true });
    await rejectSymlinkSegments(cwd, outputRoot);
    const outputChain = await captureDirectoryChain(cwd, outputRoot);
    const finalPath = resolve(outputRoot, directoryName);
    const lockPath = resolve(
      outputRoot,
      `.obby-generator-${directoryName}.lock`,
    );
    if (
      finalPath.length >
      DEFAULT_GENERATOR_CONFIGURATION.limits.maxOutputPathLength
    )
      throw new GeneratorContractError(
        "path-safety",
        "semantic output path exceeds its configured limit",
      );
    await assertDestinationAbsent(finalPath, directoryName);

    let stagingPath = "";
    for (let counter = 0; counter < 32; counter += 1) {
      const candidate = resolve(
        outputRoot,
        `.obby-generator-${directoryName}-${process.pid}-${counter}.tmp`,
      );
      try {
        await mkdir(candidate, { mode: 0o700 });
        stagingPath = candidate;
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    if (stagingPath === "")
      throw new GeneratorContractError(
        "work-limit",
        "bounded staging acquisition exhausted",
      );

    let committed = false;
    let publicationLock: DirectoryIdentity | undefined;
    try {
      const filenames = Object.keys(files).sort();
      if (filenames.length === 0)
        throw new GeneratorContractError(
          "output-publication",
          "publication artifact set is empty",
        );
      for (const filename of filenames) {
        if (
          filename === "" ||
          filename !== filename.normalize("NFC") ||
          filename.includes("/") ||
          filename.includes("\\") ||
          filename === "." ||
          filename === ".."
        )
          throw new GeneratorContractError(
            "path-safety",
            "publication artifact name is unsafe",
          );
        const content = files[filename];
        if (content === undefined)
          throw new GeneratorContractError(
            "output-publication",
            "publication artifact content is missing",
          );
        await options.onAtomicStep?.("file-write");
        const handle = await open(resolve(stagingPath, filename), "wx", 0o600);
        try {
          await handle.writeFile(content);
          await options.onAtomicStep?.("file-sync");
          await handle.sync();
        } finally {
          await handle.close();
        }
      }
      await syncDirectory(
        stagingPath,
        "temporary-directory-sync",
        options.onAtomicStep,
      );
      await options.beforeCommit?.(stagingPath);
      await assertDirectoryChain(outputChain);
      await options.onAtomicStep?.("rename");
      await assertDirectoryChain(outputChain);
      publicationLock = await claimPrivateLock(lockPath, directoryName);
      await options.onAtomicStep?.("destination-claim");
      await assertDirectoryChain(outputChain);
      await assertOwnedDirectory(publicationLock);
      await assertDestinationAbsent(finalPath, directoryName);
      await options.onAtomicStep?.("final-commit");
      await assertDirectoryChain(outputChain);
      await assertOwnedDirectory(publicationLock);
      await assertDestinationAbsent(finalPath, directoryName);
      const stagingIdentity = await directoryIdentity(stagingPath);
      await options.onAtomicStep?.("before-no-replace-commit");
      await commitDirectoryNoReplace(
        stagingPath,
        finalPath,
        directoryName,
        options.platform ?? process.platform,
      );
      committed = true;
      await assertDirectoryChain(outputChain);
      const committedIdentity = await directoryIdentity(finalPath);
      if (!sameDirectoryIdentity(committedIdentity, stagingIdentity, false))
        throw new GeneratorContractError(
          "path-safety",
          "committed output identity changed during publication",
        );
      await syncDirectory(
        finalPath,
        "final-directory-sync",
        options.onAtomicStep,
      );
      await assertOwnedDirectory(publicationLock);
      await rmdir(lockPath);
      publicationLock = undefined;
      await syncDirectory(
        outputRoot,
        "final-parent-sync",
        options.onAtomicStep,
      );
      return finalPath;
    } catch (error) {
      try {
        await assertDirectoryChain(outputChain);
        await options.onAtomicStep?.("cleanup");
        if (!committed) await rm(stagingPath, { force: true, recursive: true });
        if (publicationLock !== undefined) {
          await assertOwnedDirectory(publicationLock);
          await rmdir(publicationLock.path);
          publicationLock = undefined;
        }
      } catch (cleanupError) {
        if (
          cleanupError instanceof GeneratorContractError &&
          cleanupError.code === "path-safety"
        )
          throw cleanupError;
        throw new GeneratorContractError(
          "cleanup-failed",
          "publication cleanup failed",
        );
      }
      if (error instanceof GeneratorContractError) throw error;
      throw new GeneratorContractError(
        "output-publication",
        "atomic output publication failed",
      );
    }
  } catch (error) {
    if (error instanceof GeneratorContractError) throw error;
    throw new GeneratorContractError(
      "output-publication",
      "atomic output publication failed",
    );
  }
}

export async function runGeneratorCli(
  arguments_: readonly string[],
  streams: GeneratorCliStreams = process,
  executionOptions: GeneratorCliOptions = {},
): Promise<number> {
  let jsonErrors = arguments_.includes("--json-errors");
  try {
    const options = parseArguments(arguments_);
    jsonErrors = options.jsonErrors;
    const cwd = resolve(executionOptions.cwd ?? process.cwd());
    const outputRoot = safeOutputRoot(
      cwd,
      options.outputDirectory,
      DEFAULT_GENERATOR_CONFIGURATION.limits.maxOutputPathLength,
    );
    const suppliedInputPaths =
      options.command === "generate"
        ? [
            options.requestPath,
            options.configurationPath,
            options.catalogPath,
          ].filter((value): value is string => value !== undefined)
        : [
            options.bundlePath,
            options.generatorConfigurationPath,
            options.catalogPath,
            options.layoutConfigurationPath,
            options.layoutDefinitionsPath,
          ].filter((value): value is string => value !== undefined);
    const inputPaths = suppliedInputPaths.map((path) =>
      safeInputPath(cwd, path),
    );
    for (const inputPath of inputPaths)
      await rejectInputReparseSegments(cwd, inputPath);
    const outputKey = collisionKey(outputRoot);
    const inputKeys = inputPaths.map(collisionKey);
    if (
      inputKeys.includes(outputKey) ||
      inputPaths.some((inputPath) => {
        const relation = relative(outputRoot, inputPath);
        return (
          relation === "" ||
          (relation !== ".." && !relation.startsWith(`..${sep}`))
        );
      })
    )
      throw new GeneratorContractError(
        "path-safety",
        "output directory cannot also be an input file",
      );
    let directoryName: string;
    let publicationFiles: Readonly<Record<string, Uint8Array>>;
    if (options.command === "generate") {
      const request = await readBoundedJson(
        "request",
        safeInputPath(cwd, options.requestPath),
        DEFAULT_GENERATOR_CONFIGURATION.limits.maxRequestBytes,
      );
      const configuration =
        options.configurationPath === undefined
          ? DEFAULT_GENERATOR_CONFIGURATION
          : ((await readBoundedJson(
              "configuration",
              safeInputPath(cwd, options.configurationPath),
              DEFAULT_GENERATOR_CONFIGURATION.limits.maxConfigurationBytes,
            )) as GeneratorConfiguration);
      const catalog =
        options.catalogPath === undefined
          ? DEFAULT_MECHANIC_CATALOG
          : ((await readBoundedJson(
              "catalog",
              safeInputPath(cwd, options.catalogPath),
              DEFAULT_GENERATOR_CONFIGURATION.limits.maxCatalogBytes,
            )) as MechanicCatalog);
      const bundle = generateObby(request, configuration, catalog);
      const output = new TextEncoder().encode(
        `${evaluatorCanonicalStringify(bundle)}\n`,
      );
      if (output.byteLength > configuration.limits.maxOutputBytes)
        throw new GeneratorContractError(
          "work-limit",
          "canonical output exceeds configured byte limit",
        );
      directoryName = `obby-${bundle.obbySpec.obbySpecHash.slice(7)}`;
      publicationFiles = { "generation-bundle.json": output };
    } else {
      const generatorConfiguration =
        options.generatorConfigurationPath === undefined
          ? DEFAULT_GENERATOR_CONFIGURATION
          : ((await readBoundedJson(
              "generator configuration",
              safeInputPath(cwd, options.generatorConfigurationPath),
              DEFAULT_GENERATOR_CONFIGURATION.limits.maxConfigurationBytes,
            )) as GeneratorConfiguration);
      const catalog =
        options.catalogPath === undefined
          ? DEFAULT_MECHANIC_CATALOG
          : ((await readBoundedJson(
              "mechanic catalog",
              safeInputPath(cwd, options.catalogPath),
              DEFAULT_GENERATOR_CONFIGURATION.limits.maxCatalogBytes,
            )) as MechanicCatalog);
      const layoutConfiguration =
        options.layoutConfigurationPath === undefined
          ? DEFAULT_LAYOUT_CONFIGURATION
          : ((await readBoundedJson(
              "layout configuration",
              safeInputPath(cwd, options.layoutConfigurationPath),
              DEFAULT_GENERATOR_CONFIGURATION.limits.maxConfigurationBytes,
            )) as LayoutConfiguration);
      const layoutDefinitions =
        options.layoutDefinitionsPath === undefined
          ? DEFAULT_MECHANIC_LAYOUT_DEFINITIONS
          : ((await readBoundedJson(
              "mechanic layout definitions",
              safeInputPath(cwd, options.layoutDefinitionsPath),
              DEFAULT_GENERATOR_CONFIGURATION.limits.maxCatalogBytes,
            )) as readonly MechanicLayoutDefinition[]);
      const sourceGenerationBundle = (await readBoundedJson(
        "generation bundle",
        safeInputPath(cwd, options.bundlePath),
        DEFAULT_LAYOUT_CONFIGURATION.limits.maxOutputBytes,
      )) as GenerationBundle;
      const artifactSet = buildG1ArtifactSet({
        sourceGenerationBundle,
        generatorConfiguration,
        mechanicCatalog: catalog,
        layoutConfiguration,
        mechanicLayoutDefinitions: layoutDefinitions,
      });
      directoryName = artifactSet.directoryName;
      publicationFiles = artifactSet.files;
    }
    const path = await publish(
      cwd,
      outputRoot,
      directoryName,
      publicationFiles,
      executionOptions,
    );
    streams.stdout.write(`${path}\n`);
    return 0;
  } catch (error) {
    const tagged = error as { name?: unknown; code?: unknown };
    const workflowErrorNames = new Set([
      "LayoutContractError",
      "LayoutEngineError",
      "LayoutProjectionError",
      "G1WorkflowError",
    ]);
    const normalized =
      error instanceof GeneratorContractError
        ? error
        : workflowErrorNames.has(String(tagged.name)) &&
            typeof tagged.code === "string" &&
            /^[a-z][a-z-]*$/u.test(tagged.code)
          ? {
              code: tagged.code,
              message:
                "G1 artifact workflow rejected the supplied contract graph",
            }
          : new GeneratorContractError(
              "output-publication",
              "operation failed",
            );
    streams.stderr.write(
      jsonErrors
        ? `${JSON.stringify({ error: { code: normalized.code, message: normalized.message } })}\n`
        : `obby-generator: ${normalized.code}: ${normalized.message}\n`,
    );
    return 1;
  }
}

export * from "./layout-workflow.js";

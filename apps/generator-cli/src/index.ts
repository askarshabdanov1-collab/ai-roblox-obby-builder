import {
  link,
  lstat,
  mkdir,
  open,
  realpath,
  rmdir,
  rm,
} from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

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

export type GeneratorCliStreams = {
  stdout: { write(text: string): unknown };
  stderr: { write(text: string): unknown };
};
export type GeneratorCliOptions = {
  cwd?: string;
  beforeCommit?: (temporaryDirectory: string) => void | Promise<void>;
  onAtomicStep?: (
    step:
      | "file-write"
      | "file-sync"
      | "temporary-directory-sync"
      | "destination-claim"
      | "final-directory-sync"
      | "rename"
      | "final-parent-sync"
      | "cleanup",
  ) => void | Promise<void>;
};
type Options = {
  requestPath: string;
  configurationPath?: string;
  catalogPath?: string;
  outputDirectory: string;
  jsonErrors: boolean;
};

function parseArguments(arguments_: readonly string[]): Options {
  if (arguments_[0] !== "generate")
    throw new GeneratorContractError("usage", "expected command: generate");
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
    if (
      !["--request", "--config", "--catalog", "--output"].includes(
        argument ?? "",
      )
    )
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
  const requestPath = values.get("--request");
  const outputDirectory = values.get("--output");
  if (requestPath === undefined || outputDirectory === undefined)
    throw new GeneratorContractError(
      "usage",
      "--request and --output are required",
    );
  const configurationPath = values.get("--config");
  const catalogPath = values.get("--catalog");
  return {
    requestPath,
    outputDirectory,
    jsonErrors,
    ...(configurationPath === undefined ? {} : { configurationPath }),
    ...(catalogPath === undefined ? {} : { catalogPath }),
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

async function claimDestination(
  finalPath: string,
  directoryName: string,
): Promise<DirectoryIdentity> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await mkdir(finalPath, { mode: 0o700 });
      return await directoryIdentity(finalPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        await assertDestinationAbsent(finalPath, directoryName);
      } catch (inspectionError) {
        if ((inspectionError as NodeJS.ErrnoException).code === "ENOENT")
          continue;
        throw inspectionError;
      }
    }
  }
  throw new GeneratorContractError(
    "output-conflict",
    `output already exists: ${directoryName}`,
  );
}

async function publish(
  cwd: string,
  outputRoot: string,
  directoryName: string,
  content: Uint8Array,
  options: GeneratorCliOptions,
): Promise<string> {
  try {
    await rejectSymlinkSegments(cwd, outputRoot);
    await mkdir(outputRoot, { recursive: true });
    await rejectSymlinkSegments(cwd, outputRoot);
    const outputChain = await captureDirectoryChain(cwd, outputRoot);
    const finalPath = resolve(outputRoot, directoryName);
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
        `.obby-generator-${directoryName.slice(5)}-${process.pid}-${counter}.tmp`,
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
    let destinationClaim: DirectoryIdentity | undefined;
    try {
      await options.onAtomicStep?.("file-write");
      const handle = await open(
        resolve(stagingPath, "generation-bundle.json"),
        "wx",
        0o600,
      );
      try {
        await handle.writeFile(content);
        await options.onAtomicStep?.("file-sync");
        await handle.sync();
      } finally {
        await handle.close();
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
      destinationClaim = await claimDestination(finalPath, directoryName);
      await options.onAtomicStep?.("destination-claim");
      await assertDirectoryChain(outputChain);
      const stagingFile = resolve(stagingPath, "generation-bundle.json");
      const finalFile = resolve(finalPath, "generation-bundle.json");
      try {
        await link(stagingFile, finalFile);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST")
          throw new GeneratorContractError(
            "output-conflict",
            `output already exists: ${directoryName}`,
          );
        throw error;
      }
      committed = true;
      try {
        await rm(stagingPath, { force: true, recursive: true });
      } catch {
        throw new GeneratorContractError(
          "cleanup-failed",
          "temporary output cleanup failed",
        );
      }
      await assertDirectoryChain(outputChain);
      const actualClaim = await directoryIdentity(finalPath);
      if (
        actualClaim.realPath !== destinationClaim.realPath ||
        actualClaim.device !== destinationClaim.device ||
        actualClaim.inode !== destinationClaim.inode ||
        actualClaim.birthtimeMs !== destinationClaim.birthtimeMs
      )
        throw new GeneratorContractError(
          "path-safety",
          "final output identity changed during publication",
        );
      await syncDirectory(
        finalPath,
        "final-directory-sync",
        options.onAtomicStep,
      );
      await syncDirectory(
        outputRoot,
        "final-parent-sync",
        options.onAtomicStep,
      );
      return finalPath;
    } catch (error) {
      if (!committed) {
        try {
          await assertDirectoryChain(outputChain);
          await options.onAtomicStep?.("cleanup");
          await rm(stagingPath, { force: true, recursive: true });
          if (
            destinationClaim !== undefined &&
            !(
              error instanceof GeneratorContractError &&
              error.code === "output-conflict"
            )
          ) {
            const actualClaim = await directoryIdentity(finalPath);
            if (
              actualClaim.realPath !== destinationClaim.realPath ||
              actualClaim.device !== destinationClaim.device ||
              actualClaim.inode !== destinationClaim.inode ||
              actualClaim.birthtimeMs !== destinationClaim.birthtimeMs
            )
              throw new GeneratorContractError(
                "path-safety",
                "final output identity changed during cleanup",
              );
            await rmdir(finalPath);
          }
        } catch {
          if (
            error instanceof GeneratorContractError &&
            error.code === "path-safety"
          )
            throw error;
          throw new GeneratorContractError(
            "cleanup-failed",
            "publication cleanup failed",
          );
        }
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
    const suppliedInputPaths = [
      options.requestPath,
      options.configurationPath,
      options.catalogPath,
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
    const path = await publish(
      cwd,
      outputRoot,
      `obby-${bundle.obbySpec.obbySpecHash.slice(7)}`,
      output,
      executionOptions,
    );
    streams.stdout.write(`${path}\n`);
    return 0;
  } catch (error) {
    const normalized =
      error instanceof GeneratorContractError
        ? error
        : new GeneratorContractError("output-publication", "operation failed");
    streams.stderr.write(
      jsonErrors
        ? `${JSON.stringify({ error: { code: normalized.code, message: normalized.message } })}\n`
        : `obby-generator: ${normalized.code}: ${normalized.message}\n`,
    );
    return 1;
  }
}

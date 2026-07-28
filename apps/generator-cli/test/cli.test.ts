import {
  mkdir,
  mkdtemp,
  lstat,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { runGeneratorCli } from "../src/index.js";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  assertValidGenerationBundle,
  generateObby,
  type GenerationBundle,
} from "@obby/obby-generator";

const minimal = {
  schemaVersion: "0.1",
  requestId: "cli",
  workingName: "CLI Obby",
  genre: "obby",
  stageCount: 5,
  checkpointFrequency: 3,
  difficulty: "easy",
  seed: 7,
};
const streams = () => {
  let stdout = "";
  let stderr = "";
  return {
    io: {
      stdout: {
        write: (text: string) => {
          stdout += text;
        },
      },
      stderr: {
        write: (text: string) => {
          stderr += text;
        },
      },
    },
    output: () => ({ stdout, stderr }),
  };
};

function errorCode(text: string): string {
  const value = JSON.parse(text) as unknown;
  if (value === null || typeof value !== "object" || !("error" in value))
    throw new Error("missing error envelope");
  const error = value.error;
  if (
    error === null ||
    typeof error !== "object" ||
    !("code" in error) ||
    typeof error.code !== "string"
  )
    throw new Error("missing error code");
  return error.code;
}

function bundleFrom(text: string): GenerationBundle {
  return JSON.parse(text) as GenerationBundle;
}

describe("offline generator CLI", () => {
  it("publishes canonical output under a deterministic content-addressed name", async () => {
    const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
    try {
      const request = join(root, "request.json");
      await writeFile(request, JSON.stringify(minimal));
      const firstStreams = streams();
      expect(
        await runGeneratorCli(
          ["generate", "--request", "request.json", "--output", "out"],
          firstStreams.io,
          { cwd: root },
        ),
      ).toBe(0);
      const directories = await readdir(join(root, "out"));
      expect(directories).toHaveLength(1);
      expect(directories[0]).toMatch(/^obby-[0-9a-f]{64}$/u);
      const outputDirectory = directories[0];
      if (outputDirectory === undefined)
        throw new Error("missing semantic output directory");
      const text = await readFile(
        join(root, "out", outputDirectory, "generation-bundle.json"),
        "utf8",
      );
      expect(text.endsWith("\n")).toBe(true);
      expect(bundleFrom(text).obbySpec.stages).toHaveLength(5);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns stable JSON errors without a stack and cleans atomic staging", async () => {
    const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
    try {
      const request = join(root, "request.json");
      await writeFile(request, JSON.stringify({ ...minimal, stageCount: 4 }));
      const captured = streams();
      expect(
        await runGeneratorCli(
          [
            "generate",
            "--request",
            "request.json",
            "--output",
            "out",
            "--json-errors",
          ],
          captured.io,
          { cwd: root },
        ),
      ).toBe(1);
      expect(errorCode(captured.output().stderr)).toBe("stage-count");
      expect(captured.output().stderr).not.toContain(" at ");
      expect(await readdir(root)).not.toContain(
        expect.stringMatching(/staging/u),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a directory symlink or Windows junction before publication", async () => {
    const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
    try {
      const request = join(root, "request.json");
      const target = join(root, "real-output");
      const link = join(root, "out");
      await writeFile(request, JSON.stringify(minimal));
      await mkdir(target);
      await symlink(
        target,
        link,
        process.platform === "win32" ? "junction" : "dir",
      );
      const captured = streams();
      expect(
        await runGeneratorCli(
          [
            "generate",
            "--request",
            "request.json",
            "--output",
            "out",
            "--json-errors",
          ],
          captured.io,
          { cwd: root },
        ),
      ).toBe(1);
      expect(errorCode(captured.output().stderr)).toBe("path-safety");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a final content-addressed output reparse point", async () => {
    const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
    try {
      await writeFile(join(root, "request.json"), JSON.stringify(minimal));
      await mkdir(join(root, "out"));
      await mkdir(join(root, "reparse-target"));
      const finalName = `obby-${generateObby(minimal).obbySpec.obbySpecHash.slice(7)}`;
      await symlink(
        join(root, "reparse-target"),
        join(root, "out", finalName),
        process.platform === "win32" ? "junction" : "dir",
      );
      const captured = streams();
      expect(
        await runGeneratorCli(
          [
            "generate",
            "--request",
            "request.json",
            "--output",
            "out",
            "--json-errors",
          ],
          captured.io,
          { cwd: root },
        ),
      ).toBe(1);
      expect(errorCode(captured.output().stderr)).toBe("path-safety");
      expect(captured.output().stderr).not.toContain(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects output-ancestor replacement before rename", async () => {
    const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
    try {
      await writeFile(join(root, "request.json"), JSON.stringify(minimal));
      await mkdir(join(root, "replacement-target"));
      const captured = streams();
      expect(
        await runGeneratorCli(
          [
            "generate",
            "--request",
            "request.json",
            "--output",
            "out",
            "--json-errors",
          ],
          captured.io,
          {
            cwd: root,
            onAtomicStep: async (step) => {
              if (step !== "rename") return;
              await rm(join(root, "out"), { recursive: true });
              await symlink(
                join(root, "replacement-target"),
                join(root, "out"),
                process.platform === "win32" ? "junction" : "dir",
              );
            },
          },
        ),
      ).toBe(1);
      expect(errorCode(captured.output().stderr)).toBe("path-safety");
      expect(captured.output().stderr).not.toContain(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each(["empty-directory", "nonempty-directory", "file"] as const)(
    "preserves a late-created conflicting %s with a typed conflict",
    async (kind) => {
      const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
      try {
        await writeFile(join(root, "request.json"), JSON.stringify(minimal));
        const finalName = `obby-${generateObby(minimal).obbySpec.obbySpecHash.slice(7)}`;
        const finalPath = join(root, "out", finalName);
        const sentinel = "concurrent-owner-content";
        const captured = streams();
        let identityBefore: Awaited<ReturnType<typeof lstat>> | undefined;
        expect(
          await runGeneratorCli(
            [
              "generate",
              "--request",
              "request.json",
              "--output",
              "out",
              "--json-errors",
            ],
            captured.io,
            {
              cwd: root,
              beforeCommit: async () => {
                if (kind !== "file") {
                  await mkdir(finalPath);
                  if (kind === "nonempty-directory")
                    await writeFile(join(finalPath, "owner.txt"), sentinel);
                } else await writeFile(finalPath, sentinel);
                identityBefore = await lstat(finalPath);
              },
            },
          ),
        ).toBe(1);
        expect(errorCode(captured.output().stderr)).toBe("output-conflict");
        expect(captured.output().stderr).not.toContain(root);
        const identityAfter = await lstat(finalPath);
        expect([
          identityAfter.dev,
          identityAfter.ino,
          identityAfter.birthtimeMs,
        ]).toEqual([
          identityBefore?.dev,
          identityBefore?.ino,
          identityBefore?.birthtimeMs,
        ]);
        if (kind === "nonempty-directory") {
          expect(await readFile(join(finalPath, "owner.txt"), "utf8")).toBe(
            sentinel,
          );
          expect(await readdir(finalPath)).toEqual(["owner.txt"]);
        } else if (kind === "empty-directory")
          expect(await readdir(finalPath)).toEqual([]);
        else expect(await readFile(finalPath, "utf8")).toBe(sentinel);
        expect(
          (await readdir(join(root, "out"))).some((name) =>
            name.endsWith(".tmp"),
          ),
        ).toBe(false);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it("allows exactly one concurrent identical publisher and leaves no staging or claim debris", async () => {
    const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
    try {
      await writeFile(join(root, "request.json"), JSON.stringify(minimal));
      let arrivals = 0;
      let release: (() => void) | undefined;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const beforeCommit = async () => {
        arrivals += 1;
        if (arrivals === 2) release?.();
        await barrier;
      };
      const first = streams();
      const second = streams();
      const arguments_ = [
        "generate",
        "--request",
        "request.json",
        "--output",
        "out",
        "--json-errors",
      ] as const;
      const results = await Promise.all([
        runGeneratorCli(arguments_, first.io, { cwd: root, beforeCommit }),
        runGeneratorCli(arguments_, second.io, { cwd: root, beforeCommit }),
      ]);
      expect(results.sort()).toEqual([0, 1]);
      const failed = [first.output(), second.output()].find(
        (output) => output.stderr.length > 0,
      );
      expect(errorCode(failed?.stderr ?? "")).toBe("output-conflict");
      expect(failed?.stderr).not.toContain(root);
      const entries = await readdir(join(root, "out"));
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatch(/^obby-[0-9a-f]{64}$/u);
      const outputName = entries[0];
      if (outputName === undefined) throw new Error("missing output");
      const contents = await readdir(join(root, "out", outputName));
      expect(contents).toEqual(["generation-bundle.json"]);
      const finalBundle = bundleFrom(
        await readFile(
          join(root, "out", outputName, "generation-bundle.json"),
          "utf8",
        ),
      );
      assertValidGenerationBundle(
        finalBundle,
        DEFAULT_MECHANIC_CATALOG,
        DEFAULT_GENERATOR_CONFIGURATION,
      );
      expect(entries.some((name) => name.endsWith(".tmp"))).toBe(false);

      const retry = streams();
      expect(await runGeneratorCli(arguments_, retry.io, { cwd: root })).toBe(
        1,
      );
      expect(errorCode(retry.output().stderr)).toBe("output-conflict");
      expect(await readdir(join(root, "out"))).toEqual(entries);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("removes its empty destination claim and staging after a post-claim failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
    try {
      await writeFile(join(root, "request.json"), JSON.stringify(minimal));
      const captured = streams();
      expect(
        await runGeneratorCli(
          [
            "generate",
            "--request",
            "request.json",
            "--output",
            "out",
            "--json-errors",
          ],
          captured.io,
          {
            cwd: root,
            onAtomicStep: (step) => {
              if (step === "destination-claim")
                throw new Error(`private failure ${root}`);
            },
          },
        ),
      ).toBe(1);
      expect(errorCode(captured.output().stderr)).toBe("output-publication");
      expect(captured.output().stderr).not.toContain(root);
      expect(await readdir(join(root, "out"))).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    [
      [
        "generate",
        "--request",
        "request.json",
        "--request",
        "other.json",
        "--output",
        "out",
      ],
      "usage",
    ],
    [
      [
        "generate",
        "--unknown",
        "x",
        "--request",
        "request.json",
        "--output",
        "out",
      ],
      "usage",
    ],
    [["generate", "--request", "--output", "out"], "usage"],
    [["generate", "--request", "request.json"], "usage"],
  ] as const)(
    "returns a typed parser error for %#",
    async (arguments_, code) => {
      const captured = streams();
      expect(
        await runGeneratorCli([...arguments_, "--json-errors"], captured.io),
      ).toBe(1);
      expect(errorCode(captured.output().stderr)).toBe(code);
    },
  );

  it("returns typed, path-redacted malformed and missing input errors", async () => {
    const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
    try {
      await writeFile(join(root, "bad.json"), "{");
      for (const [file, code] of [
        ["bad.json", "input"],
        ["missing.json", "input"],
      ] as const) {
        const captured = streams();
        expect(
          await runGeneratorCli(
            ["generate", "--request", file, "--output", "out", "--json-errors"],
            captured.io,
            { cwd: root },
          ),
        ).toBe(1);
        expect(errorCode(captured.output().stderr)).toBe(code);
        expect(captured.output().stderr).not.toContain(root);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves the typed stale request hash validation error", async () => {
    const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
    try {
      await writeFile(
        join(root, "request.json"),
        JSON.stringify({
          ...minimal,
          generationRequestHash: `sha256:${"0".repeat(64)}`,
        }),
      );
      const captured = streams();
      expect(
        await runGeneratorCli(
          [
            "generate",
            "--request",
            "request.json",
            "--output",
            "out",
            "--json-errors",
          ],
          captured.io,
          { cwd: root },
        ),
      ).toBe(1);
      expect(errorCode(captured.output().stderr)).toBe("hash-mismatch");
      expect(captured.output().stderr).not.toContain(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects absolute, traversal, and symlinked input paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
    try {
      await writeFile(join(root, "request.json"), JSON.stringify(minimal));
      await mkdir(join(root, "real-input"));
      await writeFile(
        join(root, "real-input", "request.json"),
        JSON.stringify(minimal),
      );
      await symlink(
        join(root, "real-input"),
        join(root, "input-link"),
        process.platform === "win32" ? "junction" : "dir",
      );
      for (const file of [
        join(root, "request.json"),
        "../request.json",
        "input-link/request.json",
      ]) {
        const captured = streams();
        expect(
          await runGeneratorCli(
            ["generate", "--request", file, "--output", "out", "--json-errors"],
            captured.io,
            { cwd: root },
          ),
        ).toBe(1);
        expect(errorCode(captured.output().stderr)).toBe("path-safety");
        expect(captured.output().stderr).not.toContain(root);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each(["CON", "bad. ", "Cafe\u0301"])(
    "rejects unsafe output segment %s",
    async (output) => {
      const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
      try {
        await writeFile(join(root, "request.json"), JSON.stringify(minimal));
        const captured = streams();
        expect(
          await runGeneratorCli(
            [
              "generate",
              "--request",
              "request.json",
              "--output",
              output,
              "--json-errors",
            ],
            captured.io,
            { cwd: root },
          ),
        ).toBe(1);
        expect(errorCode(captured.output().stderr)).toBe("path-safety");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it.runIf(process.platform === "win32")(
    "rejects a case-insensitive input/output alias on Windows",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
      try {
        await writeFile(join(root, "Request.json"), JSON.stringify(minimal));
        const captured = streams();
        expect(
          await runGeneratorCli(
            [
              "generate",
              "--request",
              "Request.json",
              "--output",
              "request.json",
              "--json-errors",
            ],
            captured.io,
            { cwd: root },
          ),
        ).toBe(1);
        expect(errorCode(captured.output().stderr)).toBe("path-safety");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it("removes the sibling staging directory after an injected pre-commit failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
    try {
      await writeFile(join(root, "request.json"), JSON.stringify(minimal));
      const captured = streams();
      expect(
        await runGeneratorCli(
          [
            "generate",
            "--request",
            "request.json",
            "--output",
            "out",
            "--json-errors",
          ],
          captured.io,
          {
            cwd: root,
            beforeCommit: () => {
              throw new Error("injected");
            },
          },
        ),
      ).toBe(1);
      expect(errorCode(captured.output().stderr)).toBe("output-publication");
      expect(await readdir(join(root, "out"))).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects parent traversal in the output root", async () => {
    const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
    try {
      await writeFile(join(root, "request.json"), JSON.stringify(minimal));
      const captured = streams();
      expect(
        await runGeneratorCli(
          [
            "generate",
            "--request",
            "request.json",
            "--output",
            "../escape",
            "--json-errors",
          ],
          captured.io,
          { cwd: root },
        ),
      ).toBe(1);
      expect(errorCode(captured.output().stderr)).toBe("path-safety");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a request larger than the fixed pre-parse byte limit", async () => {
    const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
    try {
      await writeFile(join(root, "request.json"), "x".repeat(65_537));
      const captured = streams();
      expect(
        await runGeneratorCli(
          [
            "generate",
            "--request",
            "request.json",
            "--output",
            "out",
            "--json-errors",
          ],
          captured.io,
          { cwd: root },
        ),
      ).toBe(1);
      expect(errorCode(captured.output().stderr)).toBe("input-too-large");
      await expect(readdir(join(root, "out"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

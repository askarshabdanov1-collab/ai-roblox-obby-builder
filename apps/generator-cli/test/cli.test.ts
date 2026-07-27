import {
  mkdir,
  mkdtemp,
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
import type { GenerationBundle } from "@obby/obby-generator";

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

  it.runIf(process.platform !== "win32")(
    "rejects a symlink output segment before publication",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "obby-generator-cli-"));
      try {
        const request = join(root, "request.json");
        const target = join(root, "real-output");
        const link = join(root, "out");
        await writeFile(request, JSON.stringify(minimal));
        await mkdir(target);
        await symlink(target, link, "dir");
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

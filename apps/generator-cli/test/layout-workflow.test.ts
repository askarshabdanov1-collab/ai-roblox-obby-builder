import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TextDecoder } from "node:util";

import { evaluatorCanonicalStringify } from "@obby/canonical-json";
import {
  assertValidPlaceSpecV03,
  assertValidSceneManifestV03,
} from "@obby/contracts";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  generateObby,
} from "@obby/obby-generator";
import type { GenerationRequest } from "@obby/obby-generator-contracts";
import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  preflightLayoutWorkAdmission,
} from "@obby/obby-layout-engine";
import {
  assertValidLayoutBundle,
  type LayoutConfiguration,
} from "@obby/obby-layout-contracts";
import { describe, expect, it } from "vitest";

import {
  G1_ARTIFACT_FILENAMES,
  buildG1ArtifactSet,
} from "../src/layout-workflow.js";
import { runGeneratorCli } from "../src/index.js";

const decoder = new TextDecoder();
const REQUEST = {
  schemaVersion: "0.1",
  requestId: "g1d-workflow-test",
  workingName: "G1d offline workflow",
  genre: "obby",
  theme: "sky",
  stageCount: 15,
  difficulty: "medium",
  checkpointFrequency: 5,
  assetPolicy: "native-parts-only",
  seed: 42,
} as const;

function artifacts(overrides: Partial<GenerationRequest> = {}) {
  return artifactSet(generateObby({ ...REQUEST, ...overrides }));
}

function artifactSet(
  sourceGenerationBundle: ReturnType<typeof generateObby>,
  layoutConfiguration: LayoutConfiguration = DEFAULT_LAYOUT_CONFIGURATION,
  mechanicLayoutDefinitions = DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
) {
  return buildG1ArtifactSet({
    sourceGenerationBundle,
    generatorConfiguration: DEFAULT_GENERATOR_CONFIGURATION,
    mechanicCatalog: DEFAULT_MECHANIC_CATALOG,
    layoutConfiguration,
    mechanicLayoutDefinitions,
  });
}

function jsonArtifact(
  result: ReturnType<typeof buildG1ArtifactSet>,
  name: (typeof G1_ARTIFACT_FILENAMES)[keyof typeof G1_ARTIFACT_FILENAMES],
): unknown {
  return JSON.parse(decoder.decode(result.files[name])) as unknown;
}

describe("G1d deterministic offline artifact workflow", () => {
  it("produces the complete validated artifact set before publication", () => {
    const result = artifacts();
    expect(Object.keys(result.files).sort()).toEqual(
      Object.values(G1_ARTIFACT_FILENAMES).sort(),
    );
    const layout = jsonArtifact(result, G1_ARTIFACT_FILENAMES.layoutBundle);
    const place = jsonArtifact(result, G1_ARTIFACT_FILENAMES.placeSpec);
    const manifest = jsonArtifact(result, G1_ARTIFACT_FILENAMES.sceneManifest);
    const referencedHashes = new Set(
      (
        layout as {
          mechanicLayoutDefinitionRefs: readonly {
            mechanicLayoutDefinitionHash: string;
          }[];
        }
      ).mechanicLayoutDefinitionRefs.map(
        (reference) => reference.mechanicLayoutDefinitionHash,
      ),
    );
    expect(() =>
      assertValidLayoutBundle(
        layout,
        generateObby(REQUEST),
        DEFAULT_GENERATOR_CONFIGURATION,
        DEFAULT_MECHANIC_CATALOG,
        DEFAULT_LAYOUT_CONFIGURATION,
        DEFAULT_MECHANIC_LAYOUT_DEFINITIONS.filter((definition) =>
          referencedHashes.has(definition.mechanicLayoutDefinitionHash),
        ),
      ),
    ).not.toThrow();
    expect(() => assertValidPlaceSpecV03(place)).not.toThrow();
    expect(() => assertValidSceneManifestV03(manifest)).not.toThrow();
    expect(
      decoder.decode(result.files[G1_ARTIFACT_FILENAMES.robloxModule]),
    ).toContain("return {");
  });

  it("is byte-identical with an identical content-addressed directory name", () => {
    const first = artifacts();
    const second = artifacts();
    expect(second.directoryName).toBe(first.directoryName);
    expect(second.totalBytes).toBe(first.totalBytes);
    for (const filename of Object.values(G1_ARTIFACT_FILENAMES))
      expect(second.files[filename]).toEqual(first.files[filename]);
  }, 15_000);

  it("changes its content address and layout identity for a controlled seed change", () => {
    const first = artifacts({ seed: 42 });
    const second = artifacts({ seed: 43 });
    expect(second.directoryName).not.toBe(first.directoryName);
    expect(
      (
        jsonArtifact(second, G1_ARTIFACT_FILENAMES.layoutBundle) as {
          layoutBundleHash: string;
        }
      ).layoutBundleHash,
    ).not.toBe(
      (
        jsonArtifact(first, G1_ARTIFACT_FILENAMES.layoutBundle) as {
          layoutBundleHash: string;
        }
      ).layoutBundleHash,
    );
  });

  it.each([5, 20, 21, 50])(
    "terminates and preserves all %i stages",
    (stageCount) => {
      const result = artifacts({ stageCount });
      const layout = jsonArtifact(
        result,
        G1_ARTIFACT_FILENAMES.layoutBundle,
      ) as {
        layoutSpec: { stages: readonly unknown[] };
      };
      expect(layout.layoutSpec.stages).toHaveLength(stageCount);
    },
  );

  it("preserves the zero-checkpoint representation through every projection", () => {
    const result = artifacts({ stageCount: 5, checkpointFrequency: 5 });
    const layout = jsonArtifact(result, G1_ARTIFACT_FILENAMES.layoutBundle) as {
      layoutSpec: {
        stages: readonly { checkpointObjectId?: string }[];
        objects: readonly { role: string }[];
      };
    };
    const place = jsonArtifact(result, G1_ARTIFACT_FILENAMES.placeSpec) as {
      checkpointPlan: { checkpointObjectIds: readonly string[] };
    };
    const manifest = jsonArtifact(
      result,
      G1_ARTIFACT_FILENAMES.sceneManifest,
    ) as {
      navigation: { checkpointObjectIds: readonly string[] };
    };
    expect(
      layout.layoutSpec.stages.some(
        (stage) => stage.checkpointObjectId !== undefined,
      ),
    ).toBe(false);
    expect(
      layout.layoutSpec.objects.some((object) => object.role === "checkpoint"),
    ).toBe(false);
    expect(place.checkpointPlan.checkpointObjectIds).toEqual([]);
    expect(manifest.navigation.checkpointObjectIds).toEqual([]);
  });

  it("binds the directory identity to the complete named artifact set", () => {
    const result = artifacts();
    const layout = jsonArtifact(result, G1_ARTIFACT_FILENAMES.layoutBundle) as {
      layoutBundleHash: string;
    };
    expect(result.directoryName).toBe(
      `g1-${result.artifactSetHash.slice("sha256:".length)}`,
    );
    expect(result.artifactSetHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(
      decoder.decode(result.files[G1_ARTIFACT_FILENAMES.layoutBundle]),
    ).toBe(`${evaluatorCanonicalStringify(layout)}\n`);
  });

  it("enforces N-1/N/N+1 layout work admission without making budget semantic", () => {
    const source = generateObby(REQUEST);
    const required = preflightLayoutWorkAdmission(
      source,
      DEFAULT_LAYOUT_CONFIGURATION,
      DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
    ).requiredWorkUnits;
    const withBudget = (maxWorkUnits: number): LayoutConfiguration => ({
      ...DEFAULT_LAYOUT_CONFIGURATION,
      limits: { ...DEFAULT_LAYOUT_CONFIGURATION.limits, maxWorkUnits },
    });
    expect(() => artifactSet(source, withBudget(required - 1))).toThrow(
      expect.objectContaining({ code: "maximum-work-units" }),
    );
    const exact = artifactSet(source, withBudget(required));
    const extra = artifactSet(source, withBudget(required + 1));
    expect(extra.directoryName).toBe(exact.directoryName);
    for (const filename of Object.values(G1_ARTIFACT_FILENAMES))
      expect(extra.files[filename]).toEqual(exact.files[filename]);
  }, 15_000);

  it("propagates stale G0 authority and missing G1 recipe failures as typed results", () => {
    const stale = structuredClone(generateObby(REQUEST));
    stale.generationBundleHash = `sha256:${"0".repeat(64)}`;
    expect(() => artifactSet(stale)).toThrow(
      expect.objectContaining({ code: "stale-authority" }),
    );
    const source = generateObby({
      ...REQUEST,
      supportedMechanicPreferences: ["static-jumps"],
    });
    expect(() =>
      artifactSet(
        source,
        DEFAULT_LAYOUT_CONFIGURATION,
        DEFAULT_MECHANIC_LAYOUT_DEFINITIONS.filter(
          (definition) =>
            definition.sourceMechanic.mechanicId !== "static-jumps",
        ),
      ),
    ).toThrow(expect.objectContaining({ code: "unsupported-mechanic" }));
  });

  it("rejects output-byte N-1 while N and N+1 preserve exact bytes", () => {
    const source = generateObby(REQUEST);
    const control = artifactSet(source);
    const input = {
      sourceGenerationBundle: source,
      generatorConfiguration: DEFAULT_GENERATOR_CONFIGURATION,
      mechanicCatalog: DEFAULT_MECHANIC_CATALOG,
      layoutConfiguration: DEFAULT_LAYOUT_CONFIGURATION,
      mechanicLayoutDefinitions: DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
    };
    expect(() =>
      buildG1ArtifactSet(input, {
        maxArtifactSetBytes: control.totalBytes - 1,
      }),
    ).toThrow(expect.objectContaining({ code: "output-limit" }));
    const exact = buildG1ArtifactSet(input, {
      maxArtifactSetBytes: control.totalBytes,
    });
    const extra = buildG1ArtifactSet(input, {
      maxArtifactSetBytes: control.totalBytes + 1,
    });
    expect(exact.directoryName).toBe(control.directoryName);
    expect(extra.directoryName).toBe(control.directoryName);
  }, 20_000);

  it("fails with packing-limit when the workflow's tighter world bound is exhausted", () => {
    const source = generateObby(REQUEST);
    expect(() =>
      buildG1ArtifactSet(
        {
          sourceGenerationBundle: source,
          generatorConfiguration: DEFAULT_GENERATOR_CONFIGURATION,
          mechanicCatalog: DEFAULT_MECHANIC_CATALOG,
          layoutConfiguration: DEFAULT_LAYOUT_CONFIGURATION,
          mechanicLayoutDefinitions: DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
        },
        { maxWorldExtent: 1 },
      ),
    ).toThrow(expect.objectContaining({ code: "packing-limit" }));
  });
});

describe("G1d layout CLI publication", () => {
  it("publishes the complete set atomically and refuses an identical rerun", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "g1d-cli-"));
    try {
      await writeFile(
        join(cwd, "bundle.json"),
        evaluatorCanonicalStringify(generateObby(REQUEST)),
      );
      const output: string[] = [];
      const errors: string[] = [];
      const arguments_ = [
        "layout",
        "--bundle",
        "bundle.json",
        "--output",
        "artifacts",
        "--json-errors",
      ];
      expect(
        await runGeneratorCli(
          arguments_,
          {
            stdout: { write: (text) => output.push(text) },
            stderr: { write: (text) => errors.push(text) },
          },
          { cwd },
        ),
      ).toBe(0);
      const directory = output.join("").trim();
      expect((await readdir(directory)).sort()).toEqual(
        Object.values(G1_ARTIFACT_FILENAMES).sort(),
      );
      for (const filename of Object.values(G1_ARTIFACT_FILENAMES))
        expect(
          (await readFile(join(directory, filename))).byteLength,
        ).toBeGreaterThan(0);

      expect(
        await runGeneratorCli(
          arguments_,
          {
            stdout: { write: (text) => output.push(text) },
            stderr: { write: (text) => errors.push(text) },
          },
          { cwd },
        ),
      ).toBe(1);
      expect(errors.at(-1)).toContain('"error":{"code":"output-conflict"');
      expect(
        (await readdir(join(cwd, "artifacts"))).filter((name) =>
          /\.(?:tmp|lock)$/u.test(name),
        ),
      ).toEqual([]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("allows exactly one concurrent publisher for an identical artifact identity", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "g1d-race-"));
    try {
      await writeFile(
        join(cwd, "bundle.json"),
        evaluatorCanonicalStringify(generateObby(REQUEST)),
      );
      const invoke = async () => {
        const errors: string[] = [];
        const code = await runGeneratorCli(
          [
            "layout",
            "--bundle",
            "bundle.json",
            "--output",
            "artifacts",
            "--json-errors",
          ],
          {
            stdout: { write: () => undefined },
            stderr: { write: (text) => errors.push(text) },
          },
          { cwd },
        );
        return { code, error: errors.join("") };
      };
      const results = await Promise.all([invoke(), invoke()]);
      expect(results.map((result) => result.code).sort()).toEqual([0, 1]);
      expect(results.find((result) => result.code === 1)?.error).toContain(
        '"code":"output-conflict"',
      );
      const entries = await readdir(join(cwd, "artifacts"));
      expect(entries.filter((entry) => entry.startsWith("g1-"))).toHaveLength(
        1,
      );
      expect(entries.filter((name) => /\.(?:tmp|lock)$/u.test(name))).toEqual(
        [],
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("fails closed when the host has no supported atomic no-replace primitive", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "g1d-platform-"));
    try {
      await writeFile(
        join(cwd, "bundle.json"),
        evaluatorCanonicalStringify(generateObby(REQUEST)),
      );
      const errors: string[] = [];
      expect(
        await runGeneratorCli(
          [
            "layout",
            "--bundle",
            "bundle.json",
            "--output",
            "artifacts",
            "--json-errors",
          ],
          {
            stdout: { write: () => undefined },
            stderr: { write: (text) => errors.push(text) },
          },
          { cwd, platform: "aix" },
        ),
      ).toBe(1);
      expect(errors.join("")).toContain('"code":"output-publication"');
      expect(await readdir(join(cwd, "artifacts"))).toEqual([]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("returns cleanup-failed without leaking filesystem paths", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "g1d-cleanup-"));
    try {
      await writeFile(
        join(cwd, "bundle.json"),
        evaluatorCanonicalStringify(generateObby(REQUEST)),
      );
      const errors: string[] = [];
      expect(
        await runGeneratorCli(
          [
            "layout",
            "--bundle",
            "bundle.json",
            "--output",
            "artifacts",
            "--json-errors",
          ],
          {
            stdout: { write: () => undefined },
            stderr: { write: (text) => errors.push(text) },
          },
          {
            cwd,
            beforeCommit: () => {
              throw new Error(`injected publication failure at ${cwd}`);
            },
            onAtomicStep: (step) => {
              if (step === "cleanup")
                throw new Error(`injected cleanup failure at ${cwd}`);
            },
          },
        ),
      ).toBe(1);
      expect(errors.join("")).toContain('"code":"cleanup-failed"');
      expect(errors.join("")).not.toContain(cwd);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

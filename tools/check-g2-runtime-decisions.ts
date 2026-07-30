import { access, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

import {
  expectedG1WorkflowFixtures,
  g1WorkflowFixturePaths,
} from "./g1-workflow-fixture-content.js";

const BASELINE = "421f8f49d7b2ae17d011f5ad1b222ece5249690e";

const documents = Object.freeze({
  "docs/decisions/0003-g2-runtime-boundary.md": [
    "## Decision 1: Spawn semantics",
    "## Decision 2: Wedge mapping",
    "## Decision 3: Manifest hash trust",
    "## Decision 4: Authoritative runtime transport",
    "## Decision 5: Scene replacement",
    "## Decision 6: Cross-version behavior",
    "## Decision 7: Player-state semantics",
    "## Decision 8: Performance measurement",
    "## Decision 9: Fixture coverage",
    "## Decision 10: Validator parity",
  ],
  "docs/generator/g2-scene-replacement.md": [
    "## No-yield activation sequence",
    "## Failure-injection and rollback matrix",
  ],
  "docs/generator/g2-compatibility-rollback.md": [
    "SceneManifest `0.2`",
    "SceneManifest `0.3`",
    "fresh server",
  ],
  "docs/generator/g2-player-session-lifecycle.md": [
    "## State keys",
    "## Stale callback rule",
    "## Player removal",
  ],
  "docs/generator/g2-validator-parity.md": [
    "Additional properties",
    "Numeric validity",
    "Manifest identity/hash",
    "G2b blocker",
  ],
  "docs/generator/g2-fixtures-and-drift.md": [
    g1WorkflowFixturePaths.robloxModule,
    "npm run layout:workflow:fixtures:check",
    "maximum-50",
  ],
  "docs/generator/g2-studio-acceptance.md": [
    "## Measurement environment",
    "## Logging format",
    "no millisecond pass threshold",
    "Manual Studio execution",
  ],
  "docs/generator/g2a-acceptance.md": [
    "## Ten decisions",
    "## G2b handoff gate",
    "SceneManifest 0.3 runtime construction remains unimplemented",
  ],
  "docs/generator/g2b-manifest-admission.md": [
    "## Implemented modules",
    "## Trust boundary",
    "## Remaining limitations and G2c boundary",
  ],
});

const existingRuntimeModules = Object.freeze([
  "roblox/src/ReplicatedStorage/ObbyRuntime/Builder.luau",
  "roblox/src/ReplicatedStorage/ObbyRuntime/ManifestValidator.luau",
  "roblox/src/ReplicatedStorage/ObbyRuntime/ManifestValidatorV03.luau",
  "roblox/src/ReplicatedStorage/ObbyRuntime/SceneBuilderCore.luau",
  "roblox/src/ServerScriptService/ObbyBootstrap.server.luau",
  "roblox/default.project.json",
  "roblox/smoke.project.json",
]);

async function requireFile(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new Error(`required repository path is missing: ${path}`);
  }
}

async function checkDecisions(): Promise<void> {
  for (const path of existingRuntimeModules) await requireFile(path);

  for (const [path, markers] of Object.entries(documents)) {
    const content = await readFile(path, "utf8");
    for (const marker of markers) {
      if (!content.includes(marker))
        throw new Error(
          `${path} is missing required decision marker: ${marker}`,
        );
    }
  }

  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };
  if (
    packageJson.scripts?.["layout:workflow:fixtures:check"] !==
    "tsx tools/check-g1-workflow-fixtures.ts"
  )
    throw new Error("the authoritative G1d drift-check command changed");
  if (
    packageJson.scripts?.["g2:fixtures:check"] !==
    "tsx tools/check-g2-runtime-fixtures.ts"
  )
    throw new Error("the authoritative G2b drift-check command changed");

  const expected =
    expectedG1WorkflowFixtures()[g1WorkflowFixturePaths.robloxModule];
  const actual = await readFile(g1WorkflowFixturePaths.robloxModule, "utf8");
  if (actual !== expected)
    throw new Error(
      "the authoritative G2 runtime transport fixture has drifted",
    );

  const defaultProject = await readFile("roblox/default.project.json", "utf8");
  if (
    !defaultProject.includes("VerticalSliceManifest") ||
    defaultProject.includes("G1dReferenceManifest")
  )
    throw new Error(
      "the active default project must remain on the 0.2 manifest in G2a",
    );

  console.log(
    `G2 runtime decisions complete (${Object.keys(documents).length} documents; authoritative transport matches G1d)`,
  );
}

function checkScope(): void {
  const output = execFileSync(
    "git",
    ["diff", "--name-only", `${BASELINE}...HEAD`],
    { encoding: "utf8" },
  );
  const allowedFiles = new Set([
    "apps/generator-cli/test/layout-workflow.test.ts",
    "package.json",
    "tools/check-g2-runtime-decisions.ts",
  ]);
  const unexpected = output
    .split(/\r?\n/u)
    .filter(Boolean)
    .filter((path) => !path.startsWith("docs/") && !allowedFiles.has(path));
  if (unexpected.length > 0)
    throw new Error(`G2a scope violation: ${unexpected.join(", ")}`);
  console.log(
    "G2a diff is documentation/test/check-only; active runtime is unchanged",
  );
}

if (process.argv.includes("--scope")) checkScope();
else await checkDecisions();

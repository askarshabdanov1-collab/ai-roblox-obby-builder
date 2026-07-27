import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type RouteCases = {
  baseManifestHash: string;
  validCases: { id: string; expected: string }[];
  invalidOrLimitedCases: {
    id: string;
    expected?: string;
    expectedCode?: string;
  }[];
};

const fixture = JSON.parse(
  readFileSync(
    new URL("../fixtures/route-cases.json", import.meta.url),
    "utf8",
  ),
) as RouteCases;

describe("E1b fixture registry", () => {
  it("names every required deterministic fixture probe", () => {
    const ids = [
      ...fixture.validCases.map((item) => item.id),
      ...fixture.invalidOrLimitedCases.map((item) => item.id),
    ];
    expect(ids).toEqual(
      expect.arrayContaining([
        "simple-linear-obby",
        "multiple-checkpoints",
        "missing-route-object",
        "disconnected-route",
        "duplicate-index",
        "duplicate-stage-index",
        "reversed-edge",
        "source-equals-destination",
        "safe-route-ref-mismatch",
        "feasible-under-model-transition",
        "horizontal-gap-over-profile",
        "excessive-rise",
        "excessive-downward-drop",
        "unsupported-curved-to-curved",
        "decorative-route-endpoint",
        "hazard-route-endpoint",
        "finish-before-checkpoint",
        "missing-finish",
        "hazard-consuming-landing-candidate",
        "checkpoint-bypass-candidate",
        "spawn-to-late-stage-skip-candidate",
        "checkpoint-to-finish-skip-candidate",
        "required-stage-skip-candidate",
        "required-route-dead-end",
        "shuffled-semantic-manifest",
      ]),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses a real base manifest hash and no positive zero hash", () => {
    expect(fixture.baseManifestHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(fixture.baseManifestHash).not.toBe(`sha256:${"0".repeat(64)}`);
    expect(JSON.stringify(fixture.validCases)).not.toContain("ZERO_HASH");
  });

  it("contains no host-locale semantic ordering", () => {
    for (const source of [
      "classification.ts",
      "evaluator.ts",
      "graph.ts",
      "limits.ts",
      "profile.ts",
      "types.ts",
    ]) {
      const content = readFileSync(
        new URL(`../src/${source}`, import.meta.url),
        "utf8",
      );
      expect(content).not.toContain("localeCompare");
      expect(content).not.toContain("Intl.Collator");
    }
  });
});

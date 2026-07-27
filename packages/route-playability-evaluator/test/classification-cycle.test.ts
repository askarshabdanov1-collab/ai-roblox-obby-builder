import type * as EvaluatorContracts from "@obby/obby-evaluator-contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

type GraphValidator = (records: readonly unknown[]) => unknown;

const graphValidation = vi.hoisted(() => ({
  invoke:
    vi.fn<(validate: GraphValidator, records: readonly unknown[]) => unknown>(),
}));

vi.mock("@obby/obby-evaluator-contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof EvaluatorContracts>();
  return {
    ...actual,
    assertValidEvidenceGraph: (records: readonly unknown[]) =>
      graphValidation.invoke(actual.assertValidEvidenceGraph, records),
  };
});

import { assertAcyclicResolvedEvidenceGraph } from "../../obby-evaluator-contracts/src/internal/evidence-cycle.js";
import {
  classifyCoarseTransitionWithEvidence,
  CoarseTransitionValidationError,
  createDefaultControllerProfile,
  evaluateRoutePlayability,
} from "../src/index.js";
import { manifestFixture, requiredFixture } from "./fixtures.js";

describe("public evidence-backed classifier graph validation", () => {
  beforeEach(() => {
    graphValidation.invoke.mockReset();
    graphValidation.invoke.mockImplementation(
      (
        validate: (records: readonly unknown[]) => unknown,
        records: readonly unknown[],
      ) => validate(records),
    );
  });

  it("translates an honestly exercised resolved-node cycle guard before classification", () => {
    const evaluated = evaluateRoutePlayability({
      manifest: manifestFixture(),
      controllerProfile: createDefaultControllerProfile(),
    });
    const transition = requiredFixture(
      evaluated.transitions[0],
      "first transition",
    );
    graphValidation.invoke.mockClear();
    graphValidation.invoke.mockImplementationOnce(() =>
      assertAcyclicResolvedEvidenceGraph([
        { identity: "cycle-a", parentIdentities: ["cycle-b"] },
        { identity: "cycle-b", parentIdentities: ["cycle-a"] },
      ]),
    );
    try {
      classifyCoarseTransitionWithEvidence(
        transition,
        createDefaultControllerProfile(),
        {
          evidenceRecords: evaluated.evidence,
          expectedManifestHash: evaluated.evidence[0]
            ?.manifestHash as `sha256:${string}`,
        },
      );
      throw new Error("expected cycle validation rejection");
    } catch (caught) {
      expect(caught).toBeInstanceOf(CoarseTransitionValidationError);
      expect((caught as CoarseTransitionValidationError).issues).toEqual([
        expect.objectContaining({
          code: "input-evidence-graph",
          path: "/inputEvidenceRecords",
        }),
      ]);
    }
    expect(graphValidation.invoke).toHaveBeenCalledTimes(1);
  });
});

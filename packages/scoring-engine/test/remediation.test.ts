import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  hashAvailabilityRecord,
  hashEvidenceContent,
  type AvailabilityRecord,
  type EvidenceRecordContract,
} from "@obby/obby-evaluator-contracts";

import {
  applyAvailabilityRecords,
  assembleE1Evaluation,
  ScoringContractError,
} from "../src/index.js";
import { selectAuthoritativeE1Evidence } from "../src/evidence-selection.js";
import {
  deferredRuntimeAvailability,
  evaluatorFixtureGraph,
  type E1bFixtureBundle,
} from "./fixtures.js";

function fixtureInput() {
  const graph = evaluatorFixtureGraph();
  return {
    graph,
    input: {
      metricDefinitions: graph.metricDefinitions,
      catalog: graph.catalog,
      profile: graph.profile,
      plan: graph.plan,
      request: graph.request,
      evaluatorVersion: "0.1.0",
      componentVersions: {
        "obby-evaluator-contracts": "0.1.0",
        "geometry-evaluator": "0.1.0",
        "route-playability-evaluator": "0.1.0",
        "scoring-engine": "0.1.0",
      },
      evidence: graph.evidenceBundle.evidence,
      findings: graph.evidenceBundle.findings,
      availabilityRecords: [
        deferredRuntimeAvailability(graph.plan.scene.manifestHash),
      ],
    },
  };
}

function rehashEvidence(
  record: EvidenceRecordContract,
): EvidenceRecordContract {
  return {
    ...record,
    evidenceContentHash: hashEvidenceContent(record).hash,
  };
}

function rehashAvailability(record: AvailabilityRecord): AvailabilityRecord {
  return {
    ...record,
    availabilityRecordHash: hashAvailabilityRecord(record).hash,
  };
}

function calculationValue(
  result: ReturnType<typeof assembleE1Evaluation>,
  metricId: string,
) {
  return result.calculations.find((item) => item.metricId === metricId)?.result
    .value;
}

describe("authoritative E1b evidence selection", () => {
  it("rejects a GhostHazard that is absent from normalized manifest geometry", () => {
    const fixture = fixtureInput();
    const hazard = structuredClone(
      fixture.input.evidence.find(
        (record) => record.kind === "hazard-relationship",
      ),
    );
    if (hazard?.payload.kind !== "hazard-relationship") {
      throw new Error("missing hazard fixture");
    }
    hazard.evidenceId = "audit:ghost-hazard";
    hazard.payload.hazardObjectId = "GhostHazard";
    const ghost = rehashEvidence(hazard);

    expect(() =>
      assembleE1Evaluation({
        ...fixture.input,
        evidence: [...fixture.input.evidence, ghost],
      }),
    ).toThrow(/unknown manifest object GhostHazard/);
  });

  it("rejects conflicting coarse evidence for one required transition", () => {
    const fixture = fixtureInput();
    const coarse = structuredClone(
      fixture.input.evidence.find(
        (record) => record.kind === "coarse-transition-state",
      ),
    );
    if (coarse === undefined) throw new Error("missing coarse fixture");
    coarse.evidenceId = "audit:conflicting-coarse";
    coarse.limitations = [...coarse.limitations, "Conflicting audit record."];
    const conflicting = rehashEvidence(coarse);

    expect(() =>
      assembleE1Evaluation({
        ...fixture.input,
        evidence: [...fixture.input.evidence, conflicting],
      }),
    ).toThrow(/conflicting coarse states/);
  });

  it("keeps a valid non-required alternative transition and its coarse state byte-inert", () => {
    const fixture = fixtureInput();
    const baseline = assembleE1Evaluation(fixture.input);
    const transition = structuredClone(
      fixture.input.evidence.find(
        (record) => record.kind === "route-transition",
      ),
    );
    const coarse = structuredClone(
      fixture.input.evidence.find(
        (record) => record.kind === "coarse-transition-state",
      ),
    );
    if (
      transition?.payload.kind !== "route-transition" ||
      coarse?.payload.kind !== "coarse-transition-state"
    ) {
      throw new Error("missing transition fixtures");
    }
    transition.evidenceId = "audit:alternative-transition";
    transition.subject = {
      kind: "transition",
      fromObjectId: "Spawn",
      toObjectId: "Checkpoint01",
      fromGlobalIndex: 0,
      toGlobalIndex: 2,
    };
    transition.payload.fromObjectId = "Spawn";
    transition.payload.toObjectId = "Checkpoint01";
    transition.payload.fromGlobalIndex = 0;
    transition.payload.toGlobalIndex = 2;
    transition.payload.transitionId = "route:audit/Spawn/Checkpoint01/0/2";
    const alternativeTransition = rehashEvidence(transition);
    coarse.evidenceId = "audit:alternative-coarse";
    coarse.subject = structuredClone(alternativeTransition.subject);
    coarse.parentEvidenceHashes = [alternativeTransition.evidenceContentHash];
    coarse.payload.fromObjectId = "Spawn";
    coarse.payload.toObjectId = "Checkpoint01";
    coarse.payload.transitionId = "route:audit/Spawn/Checkpoint01/0/2";
    coarse.payload.resultId = "coarse.audit.0.2";
    coarse.payload.inputEvidenceHashes = [
      alternativeTransition.evidenceContentHash,
    ];
    coarse.payload.reproduction.inputHashes = [
      alternativeTransition.evidenceContentHash,
    ];
    const alternativeCoarse = rehashEvidence(coarse);

    const result = assembleE1Evaluation({
      ...fixture.input,
      evidence: [
        ...fixture.input.evidence,
        alternativeTransition,
        alternativeCoarse,
      ],
    });

    expect(result.calculations).toEqual(baseline.calculations);
    expect(result.report).toEqual(baseline.report);
  });

  it("keeps uncited same-manifest hazard and skip candidates byte-inert", () => {
    const fixture = fixtureInput();
    const baseline = assembleE1Evaluation(fixture.input);
    const hazard = structuredClone(
      fixture.input.evidence.find(
        (record) => record.kind === "hazard-relationship",
      ),
    );
    const candidateBundle = JSON.parse(
      readFileSync(
        new URL(
          "../fixtures/generated/candidate-only-issues/evidence-bundle.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as E1bFixtureBundle;
    const skip = structuredClone(
      candidateBundle.evidence.find(
        (record) => record.kind === "skip-candidate",
      ),
    );
    if (
      hazard?.payload.kind !== "hazard-relationship" ||
      skip?.payload.kind !== "skip-candidate"
    ) {
      throw new Error("missing candidate fixtures");
    }
    hazard.evidenceId = "audit:uncited-hazard";
    hazard.payload.relationship = "landing-surface-overlap";
    hazard.payload.routeObjectId = "Spawn";
    const unrelatedHazard = rehashEvidence(hazard);
    skip.evidenceId = "audit:uncited-skip";
    skip.payload.candidateId = "skip.audit.uncited";
    const unrelatedSkip = rehashEvidence(skip);
    const result = assembleE1Evaluation({
      ...fixture.input,
      evidence: [...fixture.input.evidence, unrelatedHazard, unrelatedSkip],
    });

    expect(result.calculations).toEqual(baseline.calculations);
    expect(result.calculationBundle).toEqual(baseline.calculationBundle);
    expect(result.report).toEqual(baseline.report);
  });

  it("keeps route-external hazard evidence with a literal undefined index byte-inert", () => {
    const fixture = fixtureInput();
    const baseline = assembleE1Evaluation(fixture.input);
    const hazard = structuredClone(
      fixture.input.evidence.find(
        (record) => record.kind === "hazard-relationship",
      ),
    );
    if (hazard?.payload.kind !== "hazard-relationship") {
      throw new Error("missing hazard fixture");
    }
    hazard.evidenceId = "e1b:hazard:KillFloor:undefined:overlap";
    hazard.payload.hazardObjectId = "KillFloor";
    hazard.payload.routeObjectId = "KillFloor";
    hazard.payload.relationship = "landing-surface-overlap";
    const routeExternal = rehashEvidence(hazard);

    const forward = assembleE1Evaluation({
      ...fixture.input,
      evidence: [...fixture.input.evidence, routeExternal],
    });
    const shuffled = assembleE1Evaluation({
      ...fixture.input,
      evidence: [routeExternal, ...fixture.input.evidence].reverse(),
    });

    expect(forward.calculations).toEqual(baseline.calculations);
    expect(forward.calculationBundle).toEqual(baseline.calculationBundle);
    expect(forward.report).toEqual(baseline.report);
    expect(shuffled.report).toEqual(baseline.report);
  });

  it("rejects duplicate checkpoint coverage", () => {
    const fixture = fixtureInput();
    const checkpoint = structuredClone(
      fixture.input.evidence.find(
        (record) => record.kind === "checkpoint-topology",
      ),
    );
    if (checkpoint === undefined) throw new Error("missing checkpoint fixture");
    checkpoint.evidenceId = "audit:duplicate-checkpoint";
    checkpoint.limitations = [
      ...checkpoint.limitations,
      "Duplicate audit record.",
    ];
    const duplicate = rehashEvidence(checkpoint);

    expect(() =>
      assembleE1Evaluation({
        ...fixture.input,
        evidence: [...fixture.input.evidence, duplicate],
      }),
    ).toThrow(/duplicate topology records/);
  });

  it("exposes missing coverage for a second declared checkpoint", () => {
    const fixture = fixtureInput();
    const evidence = structuredClone(fixture.input.evidence);
    const route = evidence.find((record) => record.kind === "route-graph");
    if (route?.payload.kind !== "route-graph") {
      throw new Error("missing route fixture");
    }
    route.payload.checkpointObjectIds = ["Checkpoint01", "WedgeClimb01"];

    const selected = selectAuthoritativeE1Evidence(evidence);

    expect(route.payload.checkpointObjectIds).toHaveLength(2);
    expect(selected.checkpoints.map((record) => record.evidenceId)).toEqual([
      "e1b:checkpoint:1",
    ]);
  });

  it("keeps unrelated generic runtime evidence byte-inert", () => {
    const fixture = fixtureInput();
    const baseline = assembleE1Evaluation(fixture.input);
    const runtimeSource: EvidenceRecordContract = {
      schemaVersion: "0.1",
      evidenceId: "audit:generic-runtime",
      kind: "runtime-observation",
      manifestHash: fixture.graph.plan.scene.manifestHash,
      subject: { kind: "scene" },
      producer: { component: "generic-runtime", version: "0.1.0" },
      payload: {
        kind: "runtime-observation",
        runtimeObservationContentHash: `sha256:${"9".repeat(64)}`,
      },
      parentEvidenceHashes: [],
      artifactHashes: [],
      quality: { completeness: "complete", validityCodes: [] },
      limitations: ["Not a checkpoint-isolation observation."],
      evidenceContentHash: `sha256:${"0".repeat(64)}`,
    };
    const runtime = rehashEvidence(runtimeSource);
    const withRuntime = assembleE1Evaluation({
      ...fixture.input,
      evidence: [...fixture.input.evidence, runtime],
    });

    expect(withRuntime.calculations).toEqual(baseline.calculations);
    expect(withRuntime.calculationBundle).toEqual(baseline.calculationBundle);
    expect(withRuntime.report).toEqual(baseline.report);
    expect(
      calculationValue(
        withRuntime,
        "runtime.checkpoint-isolation-availability",
      ),
    ).toBeUndefined();
  });
});

describe("runtime capability availability identity", () => {
  it.each([
    [
      "wrong subject kind",
      (record: AvailabilityRecord) => {
        record.subject.kind = "evidence";
      },
    ],
    [
      "wrong subject content hash",
      (record: AvailabilityRecord) => {
        record.subject.contentHash = `sha256:${"a".repeat(64)}`;
        record.impactScope.affectedIdentityHashes = [
          record.subject.contentHash,
        ];
      },
    ],
    [
      "wrong capability ID",
      (record: AvailabilityRecord) => {
        const detail = record.reasonDetails.find(
          (item) => item.code === "capability-id",
        );
        if (detail !== undefined) detail.value = "wrong-capability";
      },
    ],
    [
      "wrong capability version",
      (record: AvailabilityRecord) => {
        const detail = record.reasonDetails.find(
          (item) => item.code === "capability-version",
        );
        if (detail !== undefined) detail.value = "wrong-version";
      },
    ],
    [
      "wrong manifest scope",
      (record: AvailabilityRecord) => {
        const detail = record.reasonDetails.find(
          (item) => item.code === "manifest-hash",
        );
        if (detail !== undefined) detail.value = `sha256:${"b".repeat(64)}`;
      },
    ],
    [
      "wrong producer",
      (record: AvailabilityRecord) => {
        record.producer.component = "untrusted-producer";
      },
    ],
  ])("rejects %s", (_name, mutate) => {
    const fixture = fixtureInput();
    const record = structuredClone(fixture.input.availabilityRecords[0]);
    if (record === undefined) throw new Error("missing availability fixture");
    mutate(record);

    expect(() =>
      assembleE1Evaluation({
        ...fixture.input,
        availabilityRecords: [rehashAvailability(record)],
      }),
    ).toThrow(/runtime availability record/);
  });

  it("rejects a stale availability hash", () => {
    const fixture = fixtureInput();
    const record = structuredClone(fixture.input.availabilityRecords[0]);
    if (record === undefined) throw new Error("missing availability fixture");
    record.reasonCode = "policy-restricted";

    expect(() =>
      assembleE1Evaluation({
        ...fixture.input,
        availabilityRecords: [record],
      }),
    ).toThrow(/availabilityRecordHash content hash mismatch/);
  });

  it("rejects a producer mutation that retains the old availability hash", () => {
    const fixture = fixtureInput();
    const record = structuredClone(fixture.input.availabilityRecords[0]);
    if (record === undefined) throw new Error("missing availability fixture");
    record.producer.version = "0.2.0";

    expect(() =>
      assembleE1Evaluation({
        ...fixture.input,
        availabilityRecords: [record],
      }),
    ).toThrow(/availabilityRecordHash content hash mismatch/);
  });

  it("rejects conflicting producers for one availability subject", () => {
    const fixture = fixtureInput();
    const first = fixture.input.availabilityRecords[0];
    if (first === undefined) throw new Error("missing availability fixture");
    const second = structuredClone(first);
    second.producer.component = "competing-producer";
    second.effectiveSequence = 2;

    expect(() =>
      assembleE1Evaluation({
        ...fixture.input,
        availabilityRecords: [first, rehashAvailability(second)],
      }),
    ).toThrow(/producer|authority/i);
  });

  it("rejects conflicting effective records without supersession", () => {
    const fixture = fixtureInput();
    const restricted = fixture.input.availabilityRecords[0];
    if (restricted === undefined) throw new Error("missing availability");
    const competing = structuredClone(restricted);
    competing.availabilityState = "available";
    competing.reasonCode = "created";
    competing.effectiveSequence = 2;

    expect(() =>
      assembleE1Evaluation({
        ...fixture.input,
        availabilityRecords: [restricted, rehashAvailability(competing)],
      }),
    ).toThrow(/no unique authoritative state/);
  });

  it("deduplicates equivalent records and is invariant to input ordering", () => {
    const fixture = fixtureInput();
    const record = fixture.input.availabilityRecords[0];
    if (record === undefined) throw new Error("missing availability");
    const first = assembleE1Evaluation({
      ...fixture.input,
      availabilityRecords: [record, structuredClone(record)],
    });
    const second = assembleE1Evaluation({
      ...fixture.input,
      availabilityRecords: [structuredClone(record), record],
    });

    expect(first.report).toEqual(second.report);
    expect(first.report.availabilityRecordHashes).toEqual([
      record.availabilityRecordHash,
    ]);
  });

  it("keeps missing runtime explanation incomplete", () => {
    const fixture = fixtureInput();
    const result = assembleE1Evaluation({
      ...fixture.input,
      availabilityRecords: [],
    });
    const completeness = calculationValue(
      result,
      "policy.evidence-completeness",
    );

    expect(result.completeness.state).toBe("incomplete");
    expect(completeness).toEqual({ kind: "boolean", value: false });
  });

  it("keeps an explained optional runtime absence complete", () => {
    const fixture = fixtureInput();
    const result = assembleE1Evaluation(fixture.input);

    expect(result.completeness.state).toBe("complete");
    expect(calculationValue(result, "policy.evidence-completeness")).toEqual({
      kind: "boolean",
      value: true,
    });
  });

  it("does not let a runtime explanation excuse unavailable required route evidence", () => {
    const fixture = fixtureInput();
    const result = assembleE1Evaluation({
      ...fixture.input,
      evidence: fixture.input.evidence.filter(
        (record) => record.kind !== "route-playability-summary",
      ),
    });

    expect(result.completeness.state).toBe("incomplete");
    expect(calculationValue(result, "policy.evidence-completeness")).toEqual({
      kind: "boolean",
      value: false,
    });
  });
});

describe("one authoritative completeness and dependency propagation", () => {
  it("makes required indeterminate state agree with the completeness metric", () => {
    const fixture = fixtureInput();
    const bundle = JSON.parse(
      readFileSync(
        new URL(
          "../fixtures/generated/indeterminate-route/evidence-bundle.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as E1bFixtureBundle;
    const result = assembleE1Evaluation({
      ...fixture.input,
      evidence: bundle.evidence,
      findings: bundle.findings,
    });

    expect(result.completeness.state).toBe("incomplete");
    expect(calculationValue(result, "policy.evidence-completeness")).toEqual({
      kind: "boolean",
      value: false,
    });
  });

  it("blocks only categories declared by a failed finish invariant", () => {
    const fixture = fixtureInput();
    const evidence = fixture.input.evidence.map((record) => {
      if (record.payload.kind !== "finish-topology") return record;
      const invalid = structuredClone(record);
      if (invalid.payload.kind !== "finish-topology") return record;
      invalid.payload.structurallyReachable = false;
      return rehashEvidence(invalid);
    });
    const result = assembleE1Evaluation({ ...fixture.input, evidence });
    const categories = new Map(
      result.categories.map((category) => [
        category.categoryId,
        category.status,
      ]),
    );

    expect(result.report.outcome).toBe("fail");
    expect(categories.get("playability")).toBe("incomplete");
    expect(categories.get("checkpoint")).toBe("available");
    expect(categories.get("hazard")).toBe("available");
    expect(categories.get("performance")).toBe("available");
  });

  it("propagates a declared global evidence-integrity gap to every category", () => {
    const fixture = fixtureInput();
    const result = assembleE1Evaluation({
      ...fixture.input,
      evidence: [],
      findings: [],
    });

    expect(
      result.invariantGates.find(
        (gate) => gate.invariantId === "evidence-graph-integrity",
      )?.state,
    ).toBe("missing-evidence");
    expect(
      result.categories.every(
        (category) => category.status === "missing-evidence",
      ),
    ).toBe(true);
  });
});

describe("availability-derived report determinism", () => {
  function evidenceAvailability(
    record: EvidenceRecordContract,
    sequence: number,
  ): AvailabilityRecord {
    if (record.evidenceId === undefined) throw new Error("missing evidence ID");
    return rehashAvailability({
      schemaVersion: "0.1",
      subject: {
        kind: "evidence",
        stableId: record.evidenceId,
        contentHash: record.evidenceContentHash,
      },
      availabilityState: "deleted",
      reasonCode: "retention-expired",
      reasonDetails: [],
      authority: {
        authorityKind: "retention-policy",
        authorityId: "retention-policy:local",
      },
      producer: { component: "retention-policy", version: "1.0.0" },
      effectiveSequence: sequence,
      supersedesAvailabilityRecordHashes: [],
      policy: { component: "retention-policy", version: "1.0.0" },
      impactScope: {
        scopeKind: "subject-only",
        affectedIdentityHashes: [record.evidenceContentHash],
      },
      availabilityRecordHash: `sha256:${"0".repeat(64)}`,
    });
  }

  it("supports multiple subjects and shuffled ordering without duplicate-key crashes", () => {
    const fixture = fixtureInput();
    const report = assembleE1Evaluation(fixture.input).report;
    const firstEvidence = fixture.input.evidence[0];
    const secondEvidence = fixture.input.evidence[1];
    if (firstEvidence === undefined || secondEvidence === undefined) {
      throw new Error("missing evidence fixtures");
    }
    const firstRecord = evidenceAvailability(firstEvidence, 1);
    const secondRecord = evidenceAvailability(secondEvidence, 1);

    const left = applyAvailabilityRecords(report, [firstRecord, secondRecord]);
    const right = applyAvailabilityRecords(report, [secondRecord, firstRecord]);

    expect(left).toEqual(right);
    expect(left.missingEvidence).toHaveLength(
      report.missingEvidence.length + 2,
    );
  });

  it("rejects conflicting states for the same evidence subject", () => {
    const fixture = fixtureInput();
    const report = assembleE1Evaluation(fixture.input).report;
    const evidence = fixture.input.evidence[0];
    if (evidence === undefined) throw new Error("missing evidence fixture");
    const deleted = evidenceAvailability(evidence, 1);
    const available = rehashAvailability({
      ...structuredClone(deleted),
      availabilityState: "available",
      reasonCode: "created",
      effectiveSequence: 2,
    });

    expect(() =>
      applyAvailabilityRecords(report, [deleted, available]),
    ).toThrow(/no unique authoritative state/);
  });

  it("rejects a record whose stable ID does not match indexed evidence", () => {
    const fixture = fixtureInput();
    const report = assembleE1Evaluation(fixture.input).report;
    const evidence = fixture.input.evidence[0];
    if (evidence === undefined) throw new Error("missing evidence fixture");
    const wrong = evidenceAvailability(evidence, 1);
    wrong.subject.stableId = "evidence:wrong";

    expect(() =>
      applyAvailabilityRecords(report, [rehashAvailability(wrong)]),
    ).toThrow(/does not bind an indexed evidence subject/);
  });
});

describe("exact scoring resource boundaries", () => {
  function measuredSelection(evidence: readonly EvidenceRecordContract[]): {
    selected: ReturnType<typeof selectAuthoritativeE1Evidence>;
    units: number;
    charges: number[];
  } {
    let units = 0;
    const charges: number[] = [];
    const selected = selectAuthoritativeE1Evidence(evidence, (amount = 1) => {
      units += amount;
      charges.push(amount);
    });
    return { selected, units, charges };
  }

  function selectedTransitionFixture(count: number): EvidenceRecordContract[] {
    const fixture = fixtureInput();
    const route = structuredClone(
      fixture.input.evidence.find((record) => record.kind === "route-graph"),
    );
    const geometry = structuredClone(
      fixture.input.evidence.find((record) => record.kind === "geometry-fact"),
    );
    const transition = fixture.input.evidence.find(
      (record) => record.kind === "route-transition",
    );
    const coarse = fixture.input.evidence.find(
      (record) => record.kind === "coarse-transition-state",
    );
    const summary = structuredClone(
      fixture.input.evidence.find(
        (record) => record.kind === "route-playability-summary",
      ),
    );
    if (
      route?.payload.kind !== "route-graph" ||
      geometry?.payload.kind !== "geometry-fact" ||
      transition?.payload.kind !== "route-transition" ||
      coarse?.payload.kind !== "coarse-transition-state" ||
      summary?.payload.kind !== "route-playability-summary"
    ) {
      throw new Error("missing selected transition fixtures");
    }
    const objectIds = Array.from(
      { length: count + 1 },
      (_, index) => `SelectedRouteObject${index}`,
    );
    const transitionIds = Array.from(
      { length: count },
      (_, index) => `route:selected/${index}/${index + 1}`,
    );
    route.payload.orderedNodeIds = objectIds as [string, string, ...string[]];
    route.payload.orderedTransitionIds = transitionIds as [string, ...string[]];
    route.payload.checkpointObjectIds = [];
    route.payload.spawnObjectId = objectIds[0] ?? "SelectedRouteObject0";
    route.payload.finishObjectId = objectIds.at(-1) ?? "SelectedRouteObject0";
    geometry.payload.objectIds = objectIds as [string, ...string[]];
    const records: EvidenceRecordContract[] = [route, geometry];
    for (let index = 0; index < count; index += 1) {
      const fromObjectId = objectIds[index];
      const toObjectId = objectIds[index + 1];
      const transitionId = transitionIds[index];
      if (
        fromObjectId === undefined ||
        toObjectId === undefined ||
        transitionId === undefined
      ) {
        throw new Error("invalid selected transition fixture index");
      }
      const edge = structuredClone(transition);
      edge.evidenceId = `selected:transition:${index}`;
      edge.evidenceContentHash = `sha256:${(index + 40_000)
        .toString(16)
        .padStart(64, "0")}`;
      edge.subject = {
        kind: "transition",
        fromObjectId,
        toObjectId,
        fromGlobalIndex: index,
        toGlobalIndex: index + 1,
      };
      edge.parentEvidenceHashes = [
        route.evidenceContentHash,
        geometry.evidenceContentHash,
      ];
      edge.payload.transitionId = transitionId;
      edge.payload.fromObjectId = fromObjectId;
      edge.payload.toObjectId = toObjectId;
      edge.payload.fromGlobalIndex = index;
      edge.payload.toGlobalIndex = index + 1;
      const state = structuredClone(coarse);
      state.evidenceId = `selected:coarse:${index}`;
      state.evidenceContentHash = `sha256:${(index + 50_000)
        .toString(16)
        .padStart(64, "0")}`;
      state.subject = structuredClone(edge.subject);
      state.parentEvidenceHashes = [edge.evidenceContentHash];
      state.payload.transitionId = transitionId;
      state.payload.fromObjectId = fromObjectId;
      state.payload.toObjectId = toObjectId;
      records.push(edge, state);
    }
    summary.payload.routeId = route.payload.routeId;
    summary.parentEvidenceHashes = [
      route.evidenceContentHash,
      ...records
        .filter((record) => record.kind === "coarse-transition-state")
        .map((record) => record.evidenceContentHash),
    ];
    records.push(summary);
    return records;
  }

  function transitionCorrelationFixture(
    count: number,
  ): EvidenceRecordContract[] {
    const fixture = fixtureInput();
    const transition = fixture.input.evidence.find(
      (record) => record.kind === "route-transition",
    );
    const coarse = fixture.input.evidence.find(
      (record) => record.kind === "coarse-transition-state",
    );
    if (
      transition?.payload.kind !== "route-transition" ||
      coarse?.payload.kind !== "coarse-transition-state"
    ) {
      throw new Error("missing transition fixtures");
    }
    const additions: EvidenceRecordContract[] = [];
    for (let index = 0; index < count; index += 1) {
      const hash =
        `sha256:${(index + 10_000).toString(16).padStart(64, "0")}` as const;
      const coarseHash =
        `sha256:${(index + 20_000).toString(16).padStart(64, "0")}` as const;
      const transitionId = `route:audit/Spawn/JumpPlatform01/${index}/${index + 1}`;
      const candidate = structuredClone(transition);
      candidate.evidenceId = `audit:transition:${index}`;
      candidate.evidenceContentHash = hash;
      candidate.payload.transitionId = transitionId;
      const state = structuredClone(coarse);
      state.evidenceId = `audit:coarse:${index}`;
      state.evidenceContentHash = coarseHash;
      state.parentEvidenceHashes = [hash];
      state.payload.transitionId = transitionId;
      additions.push(candidate, state);
    }
    return [...fixture.input.evidence, ...additions];
  }

  function checkpointCorrelationFixture(
    count: number,
  ): EvidenceRecordContract[] {
    const fixture = fixtureInput();
    const route = structuredClone(
      fixture.input.evidence.find((record) => record.kind === "route-graph"),
    );
    const geometry = structuredClone(
      fixture.input.evidence.find((record) => record.kind === "geometry-fact"),
    );
    const checkpoint = fixture.input.evidence.find(
      (record) => record.kind === "checkpoint-topology",
    );
    if (
      route?.payload.kind !== "route-graph" ||
      geometry?.payload.kind !== "geometry-fact" ||
      checkpoint?.payload.kind !== "checkpoint-topology"
    ) {
      throw new Error("missing checkpoint fixtures");
    }
    const checkpointIds = Array.from(
      { length: count },
      (_, index) => `CheckpointAudit${index}`,
    );
    route.payload.checkpointObjectIds = checkpointIds;
    route.payload.orderedNodeIds = [
      "Spawn",
      ...checkpointIds,
      "FinishPlatform",
    ] as unknown as [string, string, ...string[]];
    route.payload.orderedTransitionIds = ["route:audit/missing"];
    geometry.payload.objectIds = [...route.payload.orderedNodeIds];
    const records = checkpointIds.map((checkpointId, index) => {
      const record = structuredClone(checkpoint);
      record.evidenceId = `audit:checkpoint:${index}`;
      record.evidenceContentHash = `sha256:${(index + 30_000)
        .toString(16)
        .padStart(64, "0")}`;
      record.subject = { kind: "object", objectId: checkpointId };
      record.payload.checkpointObjectId = checkpointId;
      record.payload.checkpointOrder = index + 1;
      record.payload.routeIndex = index + 1;
      return record;
    });
    return [route, geometry, ...records];
  }

  it("charges both selected-route sorts at their deterministic n-log-n cost", () => {
    const count = 64;
    const expectedSortCharge = count * Math.ceil(Math.log2(count));
    const measured = measuredSelection(selectedTransitionFixture(count));

    expect(measured.selected.transitions).toHaveLength(count);
    expect(measured.selected.coarseTransitions).toHaveLength(count);
    expect(measured.charges.slice(-2)).toEqual([
      expectedSortCharge,
      expectedSortCharge,
    ]);
  });

  it("accounts for near-maximum selected transitions and checkpoints within the documented bound", () => {
    const transitionSmall = measuredSelection(selectedTransitionFixture(900));
    const transitionLarge = measuredSelection(selectedTransitionFixture(1_900));
    const checkpointSmall = measuredSelection(
      checkpointCorrelationFixture(1_000),
    );
    const checkpointLarge = measuredSelection(
      checkpointCorrelationFixture(2_000),
    );

    expect(transitionLarge.units).toBeGreaterThan(transitionSmall.units);
    expect(transitionLarge.units).toBeLessThan(transitionSmall.units * 2.5);
    expect(checkpointLarge.units).toBeGreaterThan(checkpointSmall.units);
    expect(checkpointLarge.units).toBeLessThan(checkpointSmall.units * 2.1);
    expect(transitionLarge.selected.transitions).toHaveLength(1_900);
    expect(transitionLarge.selected.coarseTransitions).toHaveLength(1_900);
    expect(checkpointLarge.selected.checkpoints).toHaveLength(2_000);
  });

  it("does not substitute unrelated route-external records for selected-route sort load", () => {
    const selected = measuredSelection(selectedTransitionFixture(64));
    const external = measuredSelection(transitionCorrelationFixture(1_000));

    expect(selected.selected.transitions).toHaveLength(64);
    expect(external.selected.transitions.length).toBeLessThan(64);
    expect(selected.charges.slice(-2)).toEqual([
      64 * Math.ceil(Math.log2(64)),
      64 * Math.ceil(Math.log2(64)),
    ]);
  });

  it("enforces selected-route sorting at one below, exactly at, and one above a work limit", () => {
    const evidence = selectedTransitionFixture(128);
    const baseline = measuredSelection(evidence);
    const maximum = baseline.units + 1;
    const runWithAdditionalWork = (additionalUnits: number): number => {
      let used = 0;
      const charge = (amount = 1): void => {
        if (amount > maximum - used) {
          throw new ScoringContractError(
            "maximum-work-units",
            `selection work exceeds ${maximum}`,
          );
        }
        used += amount;
      };
      selectAuthoritativeE1Evidence(evidence, charge);
      charge(additionalUnits);
      return used;
    };

    expect(runWithAdditionalWork(0)).toBe(maximum - 1);
    expect(runWithAdditionalWork(1)).toBe(maximum);
    expect(() => runWithAdditionalWork(2)).toThrow(/selection work exceeds/);
    expect(measuredSelection([...evidence].reverse()).units).toBe(
      baseline.units,
    );
  });

  it("accepts exact collection limits and rejects one below each collection", () => {
    const fixture = fixtureInput();
    const exact = {
      maxMetricDefinitions: fixture.input.metricDefinitions.length,
      maxCalculations: fixture.input.metricDefinitions.length,
      maxEvidenceRecords: fixture.input.evidence.length,
      maxFindings: fixture.input.findings.length,
      maxAvailabilityRecords: fixture.input.availabilityRecords.length,
    };

    expect(() =>
      assembleE1Evaluation({ ...fixture.input, limits: exact }),
    ).not.toThrow();
    for (const [name, value] of Object.entries(exact)) {
      expect(() =>
        assembleE1Evaluation({
          ...fixture.input,
          limits: { [name]: value - 1 },
        }),
      ).toThrow(/exceeds limit/);
    }
  });

  it("accepts exact report-item and work limits and rejects one below", () => {
    const fixture = fixtureInput();
    const baseline = assembleE1Evaluation(fixture.input);
    const reportItems =
      baseline.calculations.length +
      baseline.invariantGates.length +
      baseline.profileGates.length +
      baseline.categories.length +
      baseline.report.findings.length +
      baseline.report.evidenceIndex.length +
      baseline.report.missingEvidence.length;

    expect(() =>
      assembleE1Evaluation({
        ...fixture.input,
        limits: {
          maxReportItems: reportItems,
          maxWorkUnits: baseline.workUnitsUsed,
        },
      }),
    ).not.toThrow();
    expect(() =>
      assembleE1Evaluation({
        ...fixture.input,
        limits: { maxReportItems: reportItems - 1 },
      }),
    ).toThrow(/report-items count/);
    expect(() =>
      assembleE1Evaluation({
        ...fixture.input,
        limits: { maxWorkUnits: baseline.workUnitsUsed - 1 },
      }),
    ).toThrow(/work exceeds limit/);
  });
});

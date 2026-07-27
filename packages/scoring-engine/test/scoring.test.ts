import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type {
  AvailabilityRecord,
  EvidenceRecordContract,
  Finding,
  MetricCatalog,
  ReportCategoryResult,
  ScoringProfile,
} from "@obby/obby-evaluator-contracts";
import { hashAvailabilityRecord } from "@obby/obby-evaluator-contracts";

import {
  applyAvailabilityRecords,
  finalizeE1Report,
  type E1ReportInput,
} from "../src/index.js";

const hash = (digit: string): `sha256:${string}` =>
  `sha256:${digit.repeat(64)}`;

const fixture = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../obby-evaluator-contracts/fixtures/generated/${name}`,
        import.meta.url,
      ),
      "utf8",
    ),
  );

const catalog = fixture("e1-metric-catalog.json") as MetricCatalog;
const scoringProfile = fixture("e1-scoring-profile.json") as ScoringProfile;

const evidence = (id: string, digit: string): EvidenceRecordContract => ({
  schemaVersion: "0.1",
  evidenceId: id,
  kind: "route-graph",
  manifestHash: hash("1"),
  subject: { kind: "scene" },
  producer: { component: "route-playability-evaluator", version: "0.1.0" },
  payload: {
    kind: "route-graph",
    routeId: "scene-a",
    stageIds: ["stage-1"],
    orderedNodeIds: ["Start", "Finish"],
    orderedTransitionIds: ["route:scene-a/Start/Finish/0/1"],
    spawnObjectId: "Start",
    checkpointObjectIds: [],
    finishObjectId: "Finish",
    structuralState: "connected",
    reproduction: { methodId: "declared-route-v1", inputHashes: [hash("1")] },
  },
  parentEvidenceHashes: [],
  artifactHashes: [],
  quality: { completeness: "complete", validityCodes: [] },
  limitations: [],
  evidenceContentHash: hash(digit),
});

const category = (): ReportCategoryResult => ({
  categoryId: "playability",
  status: "available",
  metricIds: ["playability.route-completeness"],
  confidence: {
    value: 1,
    basis: "required-evidence-complete",
    limitations: [],
  },
  classification: "provisional",
});

const finding = (id: string, overrides: Partial<Finding> = {}): Finding => ({
  schemaVersion: "0.1",
  findingId: id,
  ruleId: "route.required-topology",
  ruleVersion: "1.0.0",
  metricIds: [],
  title: "Required route topology",
  summary: "Required route topology failed.",
  severity: "blocking",
  blocking: true,
  invariantId: "required-route-topology",
  sourceKind: "deterministic",
  subjects: [{ kind: "scene" }],
  evidenceIds: ["e1c:route"],
  limitations: [],
  ...overrides,
});

const base = (): E1ReportInput => ({
  identities: {
    calculationBundleHash: hash("2"),
    manifestHash: hash("1"),
    manifestSchemaVersion: "1.0.0",
    configurationHash: hash("3"),
    evaluationRequestHash: hash("4"),
    evaluator: { component: "scoring-engine", version: "0.1.0" },
  },
  catalog,
  scoringProfile,
  invariantGates: [
    {
      invariantId: "required-route-topology",
      state: "pass",
      evidenceIds: ["e1c:route"],
      findingIds: [],
    },
    {
      invariantId: "decorative-gameplay-collision",
      state: "pass",
      evidenceIds: ["e1c:route"],
      findingIds: [],
    },
  ],
  profileGates: [],
  categories: [
    category(),
    {
      categoryId: "policy",
      status: "available",
      metricIds: ["policy.decorative-collision-violations"],
      confidence: {
        value: 1,
        basis: "required-evidence-complete",
        limitations: [],
      },
      classification: "invariant",
    },
  ],
  metrics: [],
  findings: [],
  evidence: [evidence("e1c:route", "7")],
  missingEvidence: [],
  limitations: [
    {
      code: "coarse-model-only",
      text: "Coarse geometry is not exact physics.",
    },
  ],
  compatibleDimensions: ["route"],
});

describe("E1c scoring precedence", () => {
  it("never lets a category result clear an invariant failure", () => {
    const input = base();
    input.invariantGates = [
      {
        invariantId: "required-route-topology",
        state: "fail",
        evidenceIds: ["e1c:route"],
        findingIds: ["finding.required-route"],
      },
      {
        invariantId: "decorative-gameplay-collision",
        state: "pass",
        evidenceIds: ["e1c:route"],
        findingIds: [],
      },
    ];
    input.findings = [finding("finding.required-route")];

    const report = finalizeE1Report(input);

    expect(report.outcome).toBe("fail");
    expect(report.blockingFindingIds).toEqual(["finding.required-route"]);
    expect(report.scoreProfile.aggregateScore).toBe(false);
  });

  it("keeps model-relative profile failure separate from invariants", () => {
    const input = base();
    input.profileGates = [
      {
        gateId: "coarse-route-feasibility",
        state: "fail",
        classification: "provisional",
        evidenceIds: ["e1c:route"],
        findingIds: ["finding.coarse"],
      },
    ];
    const profileFinding = finding("finding.coarse", {
      ruleId: "playability.coarse-transition-infeasible-under-model",
      severity: "error",
      blocking: true,
      sourceKind: "heuristic",
    });
    delete profileFinding.invariantId;
    input.findings = [profileFinding];

    expect(finalizeE1Report(input).outcome).toBe("fail-under-profile");
  });

  it("fails closed as incomplete when an invariant lacks evidence", () => {
    const input = base();
    input.invariantGates = [
      {
        invariantId: "required-route-topology",
        state: "missing-evidence",
        evidenceIds: [],
        findingIds: [],
      },
      {
        invariantId: "decorative-gameplay-collision",
        state: "pass",
        evidenceIds: ["e1c:route"],
        findingIds: [],
      },
    ];

    expect(finalizeE1Report(input).outcome).toBe("incomplete");
  });

  it("produces the same payload hash after set reordering and execution-id changes", () => {
    const firstInput = base();
    const warningFinding = finding("finding.warning", {
      blocking: false,
      severity: "warning",
      executionId: "execution-a",
    });
    delete warningFinding.invariantId;
    firstInput.findings = [warningFinding];
    const secondInput = structuredClone(firstInput);
    secondInput.evidence = [...secondInput.evidence].reverse();
    secondInput.categories = [...secondInput.categories].reverse();
    const secondFinding = secondInput.findings[0];
    if (secondFinding === undefined) throw new Error("missing test finding");
    secondFinding.executionId = "execution-b";

    const first = finalizeE1Report(firstInput);
    const second = finalizeE1Report(secondInput);

    expect(first.outcome).toBe("pass-with-warnings");
    expect(second.reportPayloadHash).toBe(first.reportPayloadHash);
  });
});

describe("E1c immutable evidence availability", () => {
  it("creates a newly hashed derived report without mutating the original", () => {
    const original = finalizeE1Report(base());
    const originalSnapshot = structuredClone(original);
    const availabilitySource: AvailabilityRecord = {
      schemaVersion: "0.1",
      subject: {
        kind: "evidence",
        stableId: "e1c:route",
        contentHash: hash("7"),
      },
      availabilityState: "deleted",
      reasonCode: "retention-expired",
      reasonDetails: [],
      authority: {
        authorityKind: "retention-policy",
        authorityId: "retention-policy:local",
      },
      effectiveSequence: 1,
      supersedesAvailabilityRecordHashes: [],
      policy: { component: "retention-policy", version: "1.0.0" },
      impactScope: {
        scopeKind: "subject-and-derived",
        affectedIdentityHashes: [hash("7")],
      },
      availabilityRecordHash: hash("8"),
    };
    const availability: AvailabilityRecord = {
      ...availabilitySource,
      availabilityRecordHash: hashAvailabilityRecord(availabilitySource).hash,
    };

    const derived = applyAvailabilityRecords(original, [availability]);

    expect(original).toEqual(originalSnapshot);
    expect(derived.reportPayloadHash).not.toBe(original.reportPayloadHash);
    expect(derived.derivedFrom).toEqual({
      reportPayloadHash: original.reportPayloadHash,
      availabilityRecordHashes: [availability.availabilityRecordHash],
      reproduction: "impossible",
    });
    expect(derived.outcome).toBe("incomplete");
  });
});

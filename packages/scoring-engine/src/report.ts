import { compareUnicodeScalars } from "@obby/canonical-json";
import {
  hashReportPayload,
  parseAvailabilityRecord,
  parseReportPayloadPreimage,
  verifyAvailabilityRecordIdentity,
  verifyMetricCatalogIdentity,
  verifyReportPayloadIdentity,
  verifyScoringProfileIdentity,
  type AvailabilityRecord,
  type EvidenceRecordContract,
  type Finding,
  type ReportPayloadPreimage,
} from "@obby/obby-evaluator-contracts";

import {
  ScoringContractError,
  type E1ReportInput,
  type FinalizedE1Report,
} from "./types.js";

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].toSorted(compareUnicodeScalars);
}

function subjectKey(evidence: EvidenceRecordContract): string {
  const subject = evidence.subject;
  switch (subject.kind) {
    case "scene":
      return "scene";
    case "object":
      return `object:${subject.objectId}`;
    case "transition":
      return `transition:${subject.fromObjectId}:${subject.toObjectId}:${subject.fromGlobalIndex}:${subject.toGlobalIndex}`;
    case "point":
      return `point:${subject.point.x}:${subject.point.y}:${subject.point.z}`;
  }
}

function cleanFinding(finding: Finding): Finding {
  const clean = structuredClone(finding);
  if (clean.executionId === undefined) delete clean.executionId;
  if (clean.invariantId === undefined) delete clean.invariantId;
  return clean;
}

function assertBindings(input: E1ReportInput): void {
  const catalog = verifyMetricCatalogIdentity(input.catalog);
  const profile = verifyScoringProfileIdentity(input.scoringProfile);
  if (profile.metricCatalogHash !== catalog.metricCatalogHash) {
    throw new ScoringContractError(
      "profile-catalog-mismatch",
      "scoring profile does not reference the supplied metric catalog",
    );
  }
  const evidenceIds = new Set(
    input.evidence.map((record) => {
      if (record.evidenceId === undefined) {
        throw new ScoringContractError(
          "missing-evidence-id",
          "final reports require a stable evidenceId for every evidence record",
        );
      }
      return record.evidenceId;
    }),
  );
  const evidenceHashes = new Set(
    input.evidence.map((record) => record.evidenceContentHash),
  );
  const findings = new Map(
    input.findings.map((item) => [item.findingId, item]),
  );
  const invariantIds = new Set<string>();
  for (const gate of input.invariantGates) {
    if (invariantIds.has(gate.invariantId)) {
      throw new ScoringContractError(
        "duplicate-invariant-gate",
        `duplicate invariant gate ${gate.invariantId}`,
      );
    }
    invariantIds.add(gate.invariantId);
    for (const evidenceId of gate.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        throw new ScoringContractError(
          "unknown-gate-evidence",
          `invariant ${gate.invariantId} references unknown evidence ${evidenceId}`,
        );
      }
    }
    if (gate.state === "fail" && gate.findingIds.length === 0) {
      throw new ScoringContractError(
        "missing-invariant-finding",
        `failed invariant ${gate.invariantId} requires a blocking finding`,
      );
    }
    for (const findingId of gate.findingIds) {
      const finding = findings.get(findingId);
      if (finding?.invariantId !== gate.invariantId || !finding.blocking) {
        throw new ScoringContractError(
          "invalid-invariant-finding",
          `invariant ${gate.invariantId} is not bound to a matching blocking finding`,
        );
      }
    }
  }
  const expectedInvariantIds = catalog.invariantGates
    .map((gate) => gate.invariantId)
    .toSorted(compareUnicodeScalars);
  if (
    expectedInvariantIds.join("\u0000") !==
    [...invariantIds].toSorted(compareUnicodeScalars).join("\u0000")
  ) {
    throw new ScoringContractError(
      "invariant-gate-coverage",
      "every catalog invariant gate must be evaluated exactly once",
    );
  }
  for (const gate of input.profileGates) {
    for (const evidenceHash of gate.evidenceContentHashes) {
      if (!evidenceHashes.has(evidenceHash)) {
        throw new ScoringContractError(
          "unknown-profile-gate-evidence",
          `profile gate ${gate.gateId} references unknown evidence ${evidenceHash}`,
        );
      }
    }
    for (const findingId of gate.findingIds) {
      const finding = findings.get(findingId);
      if (finding === undefined || finding.invariantId !== undefined) {
        throw new ScoringContractError(
          "invalid-profile-finding",
          `profile gate ${gate.gateId} must reference a non-invariant finding`,
        );
      }
    }
  }
  const categories = new Map(
    input.categories.map((category) => [category.categoryId, category]),
  );
  for (const expected of profile.categories) {
    const actual = categories.get(expected.categoryId);
    if (
      actual === undefined ||
      unique(actual.metricIds).join("\u0000") !==
        unique(expected.metricIds).join("\u0000")
    ) {
      throw new ScoringContractError(
        "profile-category-coverage",
        `report category ${expected.categoryId} must preserve its profile metric set`,
      );
    }
  }
  if (categories.size !== profile.categories.length) {
    throw new ScoringContractError(
      "unexpected-report-category",
      "report categories must exactly match the E1 scoring profile",
    );
  }
}

function outcome(input: E1ReportInput): ReportPayloadPreimage["outcome"] {
  if (input.invariantGates.some((gate) => gate.state === "fail")) return "fail";
  if (
    input.invariantGates.some((gate) => gate.state === "missing-evidence") ||
    input.profileGates.some((gate) => gate.state === "missing-evidence") ||
    input.categories.some(
      (category) =>
        category.status === "missing-evidence" ||
        category.status === "incomplete",
    )
  ) {
    return "incomplete";
  }
  if (input.profileGates.some((gate) => gate.state === "fail")) {
    return "fail-under-profile";
  }
  return input.findings.some(
    (finding) => finding.severity === "warning" || finding.severity === "error",
  )
    ? "pass-with-warnings"
    : "pass";
}

function finalize(payload: ReportPayloadPreimage): FinalizedE1Report {
  const parsed = parseReportPayloadPreimage(payload);
  const report = {
    ...parsed,
    reportPayloadHash: hashReportPayload(parsed).hash,
  } as FinalizedE1Report;
  verifyReportPayloadIdentity(report);
  return report;
}

function requiredEvidenceId(record: EvidenceRecordContract): string {
  if (record.evidenceId === undefined) {
    throw new ScoringContractError(
      "missing-evidence-id",
      "final reports require a stable evidenceId for every evidence record",
    );
  }
  return record.evidenceId;
}

export function finalizeE1Report(input: E1ReportInput): FinalizedE1Report {
  assertBindings(input);
  const blockingFindingIds = unique([
    ...input.invariantGates
      .filter((gate) => gate.state === "fail")
      .flatMap((gate) => gate.findingIds),
    ...input.profileGates
      .filter((gate) => gate.state === "fail")
      .flatMap((gate) => gate.findingIds),
  ]);
  return finalize({
    schemaVersion: "0.1",
    calculationBundleHash: input.identities.calculationBundleHash,
    scene: {
      manifestHash: input.identities.manifestHash,
      manifestSchemaVersion: input.identities.manifestSchemaVersion,
    },
    plan: {
      configurationHash: input.identities.configurationHash,
      evaluationRequestHash: input.identities.evaluationRequestHash,
    },
    versions: {
      evaluator: input.identities.evaluator,
      metricCatalogHash: input.catalog.metricCatalogHash,
      scoringProfileHash: input.scoringProfile.scoringProfileHash,
    },
    outcome: outcome(input),
    blockingFindingIds,
    scoreProfile: {
      profileId: input.scoringProfile.profileId,
      profileVersion: input.scoringProfile.profileVersion,
      compatibilityClass: input.scoringProfile.compatibilityClass,
      aggregateScore: false,
      categories: structuredClone([...input.categories]),
    },
    calculations: structuredClone([...input.calculations]),
    invariantGates: structuredClone([...input.invariantGates]),
    profileGates: structuredClone([...input.profileGates]),
    completeness: structuredClone(input.completeness),
    metrics: structuredClone([...input.metrics]),
    findings: input.findings.map(cleanFinding),
    evidenceIndex: input.evidence.map((record) => ({
      evidenceId: requiredEvidenceId(record),
      kind: record.kind,
      subjectKey: subjectKey(record),
      evidenceContentHash: record.evidenceContentHash,
      artifactHashes: record.artifactHashes.map(
        (artifact) => artifact.contentHash,
      ),
    })),
    availabilityRecordHashes: unique(input.availabilityRecordHashes),
    missingEvidence: structuredClone(input.missingEvidence),
    comparability: {
      compatibilityClass: input.scoringProfile.compatibilityClass,
      compatibleDimensions: [...input.compatibleDimensions],
    },
    limitations: structuredClone(input.limitations),
  });
}

export function applyAvailabilityRecords(
  source: FinalizedE1Report,
  records: readonly AvailabilityRecord[],
): FinalizedE1Report {
  const original = verifyReportPayloadIdentity(source);
  if (original.reportPayloadHash === undefined) {
    throw new ScoringContractError(
      "missing-report-payload-hash",
      "availability derivation requires a finalized report",
    );
  }
  const availability = records.map((record) => {
    parseAvailabilityRecord(record);
    return verifyAvailabilityRecordIdentity(record);
  });
  const evidenceHashes = new Set(
    original.evidenceIndex.map((entry) => entry.evidenceContentHash),
  );
  const unavailable = availability.filter(
    (record) =>
      record.subject.kind === "evidence" &&
      evidenceHashes.has(record.subject.contentHash) &&
      record.availabilityState !== "available",
  );
  const unavailableHashes = new Set(
    unavailable.map((record) => record.subject.contentHash),
  );
  const affectedCount = original.evidenceIndex.filter((entry) =>
    unavailableHashes.has(entry.evidenceContentHash),
  ).length;
  const reproduction =
    affectedCount === 0
      ? "complete"
      : affectedCount === original.evidenceIndex.length
        ? "impossible"
        : "partial";
  const payload: ReportPayloadPreimage = {
    ...structuredClone(original),
    outcome: affectedCount === 0 ? original.outcome : "incomplete",
    missingEvidence: [
      ...original.missingEvidence,
      ...unavailable.map((record) => ({
        reasonCode: `evidence-${record.availabilityState}`,
        availabilityRecordHashes: [record.availabilityRecordHash],
        consequence: `Evidence ${record.subject.stableId} is ${record.availabilityState}; deterministic reproduction is ${reproduction}.`,
      })),
    ],
    availabilityRecordHashes: unique([
      ...original.availabilityRecordHashes,
      ...availability.map((record) => record.availabilityRecordHash),
    ]),
    limitations: [
      ...original.limitations,
      ...(affectedCount === 0
        ? []
        : [
            {
              code: "evidence-unavailable",
              text: "One or more immutable evidence references are no longer available.",
            },
          ]),
    ],
    derivedFrom: {
      reportPayloadHash: original.reportPayloadHash,
      availabilityRecordHashes: unique(
        availability.map((record) => record.availabilityRecordHash),
      ) as [`sha256:${string}`, ...`sha256:${string}`[]],
      reproduction,
    },
  };
  delete payload.reportPayloadHash;
  return finalize(payload);
}

import { compareUnicodeScalars } from "@obby/canonical-json";
import {
  assertValidEvidenceGraph,
  hashReportPayload,
  parseReportPayloadPreimage,
  verifyMetricCatalogIdentity,
  verifyReportPayloadIdentity,
  verifyScoringProfileIdentity,
  verifyMetricCalculationIdentity,
  type AvailabilityRecord,
  type EvidenceRecordContract,
  type Finding,
  type ReportPayloadPreimage,
} from "@obby/obby-evaluator-contracts";

import { resolveAvailabilityRecords } from "./availability.js";
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
  const verifiedEvidence = assertValidEvidenceGraph(input.evidence);
  const evidenceIds = new Set(
    verifiedEvidence.map((record) => {
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
    verifiedEvidence.map((record) => record.evidenceContentHash),
  );
  const findings = new Map<string, Finding>();
  for (const finding of input.findings) {
    if (findings.has(finding.findingId)) {
      throw new ScoringContractError(
        "duplicate-finding",
        `duplicate finding ${finding.findingId}`,
      );
    }
    for (const evidenceId of finding.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        throw new ScoringContractError(
          "unresolved-finding-evidence",
          `finding ${finding.findingId} references unknown evidence ${evidenceId}`,
        );
      }
    }
    findings.set(finding.findingId, finding);
  }
  const catalogDefinitions = new Map(
    catalog.metricDefinitions.map((definition) => [
      definition.metricId,
      definition,
    ]),
  );
  const calculations = new Map<
    string,
    ReturnType<typeof verifyMetricCalculationIdentity>
  >();
  for (const inputCalculation of input.calculations) {
    const calculation = verifyMetricCalculationIdentity(inputCalculation);
    if (calculations.has(calculation.metricId)) {
      throw new ScoringContractError(
        "duplicate-metric-calculation",
        `duplicate metric calculation ${calculation.metricId}`,
      );
    }
    const definition = catalogDefinitions.get(calculation.metricId);
    if (
      definition?.metricVersion !== calculation.metricVersion ||
      definition.metricDefinitionHash !== calculation.metricDefinitionHash
    ) {
      throw new ScoringContractError(
        "calculation-definition-mismatch",
        `calculation ${calculation.metricId} does not bind the supplied catalog`,
      );
    }
    for (const reference of calculation.evidence) {
      if (!evidenceHashes.has(reference.evidenceContentHash)) {
        throw new ScoringContractError(
          "unresolved-calculation-evidence",
          `calculation ${calculation.metricId} references unknown evidence ${reference.evidenceContentHash}`,
        );
      }
    }
    calculations.set(calculation.metricId, calculation);
  }
  const expectedCalculationIds = new Set([
    ...profile.requiredMetricIds,
    ...profile.optionalMetricIds,
  ]);
  if (
    calculations.size !== expectedCalculationIds.size ||
    [...expectedCalculationIds].some((metricId) => !calculations.has(metricId))
  ) {
    throw new ScoringContractError(
      "calculation-coverage",
      "final report calculations must exactly cover the selected scoring profile",
    );
  }
  for (const record of verifiedEvidence) {
    if (record.manifestHash !== input.identities.manifestHash) {
      throw new ScoringContractError(
        "evidence-manifest-scope",
        `evidence ${record.evidenceContentHash} is outside the report manifest`,
      );
    }
  }
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
  ) ||
    input.metrics.some(
      (metric) => metric.severity === "warning" || metric.severity === "error",
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

export function finalizeValidatedE1Report(
  input: E1ReportInput,
): FinalizedE1Report {
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
  const availability = resolveAvailabilityRecords(records);
  const evidenceByHash = new Map(
    original.evidenceIndex.map((entry) => [entry.evidenceContentHash, entry]),
  );
  for (const record of availability) {
    const evidence = evidenceByHash.get(record.subject.contentHash);
    if (
      record.subject.kind !== "evidence" ||
      record.subject.stableId !== evidence?.evidenceId ||
      !record.impactScope.affectedIdentityHashes.includes(
        record.subject.contentHash,
      )
    ) {
      throw new ScoringContractError(
        "availability-evidence-identity",
        "availability record does not bind an indexed evidence subject",
      );
    }
  }
  const unavailable = availability.filter(
    (record) =>
      record.subject.kind === "evidence" &&
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

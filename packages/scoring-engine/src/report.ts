import { compareUnicodeScalars } from "@obby/canonical-json";
import {
  hashReportPayload,
  parseReportPayloadPreimage,
  verifyReportPayloadIdentity,
  type AvailabilityRecord,
  type ReportPayloadPreimage,
} from "@obby/obby-evaluator-contracts";

import { resolveAvailabilityRecords } from "./availability.js";
import { assembleE1Evaluation as assembleE1EvaluationCore } from "./assembly.js";
import {
  ScoringContractError,
  type E1EvaluationInput,
  type FinalizedE1Report,
  type ValidatedE1EvaluationResult,
  type ValidatedE1Report,
} from "./types.js";

const validatedReports = new WeakMap<object, string>();

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].toSorted(compareUnicodeScalars);
}

function trustReport(report: FinalizedE1Report): ValidatedE1Report {
  const verified = verifyReportPayloadIdentity(report);
  if (verified.reportPayloadHash === undefined) {
    throw new ScoringContractError(
      "missing-report-payload-hash",
      "validated assembly produced a report without reportPayloadHash",
    );
  }
  validatedReports.set(report, verified.reportPayloadHash);
  return report as ValidatedE1Report;
}

export function assertValidatedE1Report(input: unknown): FinalizedE1Report {
  if (typeof input !== "object" || input === null) {
    throw new ScoringContractError(
      "unvalidated-report",
      "report operation requires an object returned by validated E1 assembly",
    );
  }
  const trustedHash = validatedReports.get(input);
  const currentHash = Reflect.get(input, "reportPayloadHash") as unknown;
  if (trustedHash === undefined || currentHash !== trustedHash) {
    throw new ScoringContractError(
      "unvalidated-report",
      "report operation requires an unchanged object returned by validated E1 assembly",
    );
  }
  let verified: FinalizedE1Report;
  try {
    verified = verifyReportPayloadIdentity(input) as FinalizedE1Report;
  } catch {
    throw new ScoringContractError(
      "unvalidated-report",
      "validated report identity no longer matches its assembly identity",
    );
  }
  if (verified.reportPayloadHash !== trustedHash) {
    throw new ScoringContractError(
      "unvalidated-report",
      "validated report identity no longer matches its assembly identity",
    );
  }
  return verified;
}

export function assembleE1Evaluation(
  input: E1EvaluationInput,
): ValidatedE1EvaluationResult {
  const result = assembleE1EvaluationCore(input);
  return {
    ...result,
    report: trustReport(result.report),
  };
}

function finalize(payload: ReportPayloadPreimage): ValidatedE1Report {
  const parsed = parseReportPayloadPreimage(payload);
  const report = {
    ...parsed,
    reportPayloadHash: hashReportPayload(parsed).hash,
  } as FinalizedE1Report;
  verifyReportPayloadIdentity(report);
  return trustReport(report);
}

export function applyAvailabilityRecords(
  source: ValidatedE1Report,
  records: readonly AvailabilityRecord[],
): ValidatedE1Report {
  const original = assertValidatedE1Report(source);
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

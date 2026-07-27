import { compareUnicodeScalars } from "@obby/canonical-json";
import {
  hashReportPayload,
  parseReportPayloadPreimage,
  verifyReportPayloadIdentity,
  type AvailabilityRecord,
  type ReportPayloadPreimage,
} from "@obby/obby-evaluator-contracts";

import { resolveAvailabilityRecords } from "./availability.js";
import { ScoringContractError, type FinalizedE1Report } from "./types.js";

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].toSorted(compareUnicodeScalars);
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

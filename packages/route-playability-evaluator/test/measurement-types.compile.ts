import type { TransitionMeasurementEvidence } from "../src/index.js";

const available = {
  status: "available" as const,
  value: 1,
  method: "world-aabb-horizontal-separation" as const,
  approximationKind: "conservative-lower-bound" as const,
  toleranceStuds: 1e-9,
  limitations: ["fixture"],
  applicability: "broad-phase-only" as const,
};

const unavailable = {
  status: "unavailable" as const,
  reasonCode: "missing-horizontal-separation" as const,
  missingEvidenceHashes: [],
  limitations: ["fixture"],
};

const acceptedAvailable: TransitionMeasurementEvidence = available;
const acceptedUnavailable: TransitionMeasurementEvidence = unavailable;
void acceptedAvailable;
void acceptedUnavailable;

// @ts-expect-error The legacy untagged measurement shape is not public input.
const missingStatus: TransitionMeasurementEvidence = {
  value: 1,
  method: "world-aabb-horizontal-separation",
  approximationKind: "conservative-lower-bound",
  toleranceStuds: 1e-9,
  limitations: ["fixture"],
  applicability: "broad-phase-only",
};
void missingStatus;

const unknownStatus: TransitionMeasurementEvidence = {
  ...available,
  // @ts-expect-error Unknown discriminants are rejected.
  status: "future",
};
void unknownStatus;

// @ts-expect-error Unavailable measurements require a reason code.
const unavailableWithoutReason: TransitionMeasurementEvidence = {
  status: "unavailable",
  missingEvidenceHashes: [],
  limitations: ["fixture"],
};
void unavailableWithoutReason;

// @ts-expect-error Unavailable measurements require limitations.
const unavailableWithoutLimitations: TransitionMeasurementEvidence = {
  status: "unavailable",
  reasonCode: "missing-horizontal-separation",
  missingEvidenceHashes: [],
};
void unavailableWithoutLimitations;

// @ts-expect-error Available measurements require a value.
const availableWithoutValue: TransitionMeasurementEvidence = {
  status: "available",
  method: "world-aabb-horizontal-separation",
  approximationKind: "conservative-lower-bound",
  toleranceStuds: 1e-9,
  limitations: ["fixture"],
  applicability: "broad-phase-only",
};
void availableWithoutValue;

const mixedAvailableUnavailable: TransitionMeasurementEvidence = {
  ...unavailable,
  // @ts-expect-error Fields from the available variant cannot be mixed into unavailable input.
  value: 1,
};
void mixedAvailableUnavailable;

const malformedEvidenceHash: TransitionMeasurementEvidence = {
  ...unavailable,
  // @ts-expect-error Missing-evidence identities must be SHA-256 content hashes.
  missingEvidenceHashes: ["not-a-content-hash"],
};
void malformedEvidenceHash;

const availableWithExtraField: TransitionMeasurementEvidence = {
  ...available,
  // @ts-expect-error Closed variants reject unexpected fields.
  unexpected: true,
};
void availableWithExtraField;

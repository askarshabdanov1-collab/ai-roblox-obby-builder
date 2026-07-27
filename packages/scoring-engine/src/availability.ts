import {
  EVALUATOR_CANONICAL_JSON_ALGORITHM,
  canonicalizeEvaluatorSnapshot,
  compareUnicodeScalars,
  sha256Bytes,
} from "@obby/canonical-json";
import {
  verifyAvailabilityRecordIdentity,
  type AvailabilityRecord,
  type ContentHash,
} from "@obby/obby-evaluator-contracts";

import { ScoringContractError } from "./types.js";

export const RUNTIME_CAPABILITY_ID = "runtime";
export const RUNTIME_CAPABILITY_VERSION = "checkpoint-isolation-deferred-v1";

export function runtimeCapabilitySubjectHash(
  manifestHash: ContentHash,
): ContentHash {
  return sha256Bytes(
    canonicalizeEvaluatorSnapshot({
      canonicalizationAlgorithm: EVALUATOR_CANONICAL_JSON_ALGORITHM,
      domain: "e1c-capability-subject-v1",
      capabilityId: RUNTIME_CAPABILITY_ID,
      capabilityVersion: RUNTIME_CAPABILITY_VERSION,
      manifestHash,
    }).canonicalBytes,
  );
}

function effectiveValue(record: AvailabilityRecord): {
  kind: "sequence" | "time";
  value: number | string;
} {
  if (record.effectiveSequence !== undefined) {
    return { kind: "sequence", value: record.effectiveSequence };
  }
  if (record.effectiveAt !== undefined) {
    return { kind: "time", value: record.effectiveAt };
  }
  throw new ScoringContractError(
    "availability-effective-identity",
    "availability record has no effective identity",
  );
}

function assertNewer(
  newer: AvailabilityRecord,
  older: AvailabilityRecord,
): void {
  const left = effectiveValue(newer);
  const right = effectiveValue(older);
  if (
    left.kind !== right.kind ||
    (typeof left.value === "number" && typeof right.value === "number"
      ? left.value <= right.value
      : String(left.value) <= String(right.value))
  ) {
    throw new ScoringContractError(
      "availability-effective-order",
      "availability supersession must use one effective identity domain and move forward",
    );
  }
}

export function resolveAvailabilityRecords(
  inputs: readonly unknown[],
): AvailabilityRecord[] {
  const byHash = new Map<ContentHash, AvailabilityRecord>();
  for (const input of inputs) {
    const record = verifyAvailabilityRecordIdentity(input);
    byHash.set(record.availabilityRecordHash, record);
  }
  const records = [...byHash.values()].toSorted((left, right) =>
    compareUnicodeScalars(
      left.availabilityRecordHash,
      right.availabilityRecordHash,
    ),
  );
  const groups = new Map<string, AvailabilityRecord[]>();
  for (const record of records) {
    const key = `${record.subject.kind}:${record.subject.stableId}:${record.subject.contentHash}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const effective: AvailabilityRecord[] = [];
  for (const [subject, group] of [...groups.entries()].toSorted((left, right) =>
    compareUnicodeScalars(left[0], right[0]),
  )) {
    if (group.length === 1) {
      const only = group[0];
      if (only !== undefined) effective.push(only);
      continue;
    }
    const superseded = new Set(
      group.flatMap((record) => record.supersedesAvailabilityRecordHashes),
    );
    const leaves = group.filter(
      (record) => !superseded.has(record.availabilityRecordHash),
    );
    if (leaves.length !== 1) {
      throw new ScoringContractError(
        "conflicting-availability-records",
        `availability subject ${subject} has no unique authoritative state`,
      );
    }
    const leaf = leaves[0];
    if (leaf === undefined) throw new Error("unreachable availability leaf");
    const reachable = new Set<ContentHash>();
    const visit = (record: AvailabilityRecord): void => {
      for (const parentHash of record.supersedesAvailabilityRecordHashes) {
        const parent = byHash.get(parentHash);
        if (parent === undefined || reachable.has(parentHash)) continue;
        const parentKey = `${parent.subject.kind}:${parent.subject.stableId}:${parent.subject.contentHash}`;
        if (parentKey !== subject) {
          throw new ScoringContractError(
            "availability-supersession-subject",
            "availability supersession cannot cross subjects",
          );
        }
        assertNewer(record, parent);
        reachable.add(parentHash);
        visit(parent);
      }
    };
    visit(leaf);
    if (
      group.some(
        (record) =>
          record !== leaf && !reachable.has(record.availabilityRecordHash),
      )
    ) {
      throw new ScoringContractError(
        "conflicting-availability-records",
        `availability subject ${subject} has an unresolved branch`,
      );
    }
    effective.push(leaf);
  }
  return effective.toSorted((left, right) =>
    compareUnicodeScalars(
      left.availabilityRecordHash,
      right.availabilityRecordHash,
    ),
  );
}

function detailMap(record: AvailabilityRecord): Map<string, string> {
  return new Map(
    record.reasonDetails.map((detail) => [detail.code, detail.value]),
  );
}

export function resolveRuntimeCapabilityAvailability(
  inputs: readonly unknown[],
  manifestHash: ContentHash,
): AvailabilityRecord[] {
  const expectedHash = runtimeCapabilitySubjectHash(manifestHash);
  const effective = resolveAvailabilityRecords(inputs);
  for (const record of effective) {
    const details = detailMap(record);
    if (
      record.subject.kind !== "reference" ||
      record.subject.stableId !== "capability:runtime" ||
      record.subject.contentHash !== expectedHash ||
      record.availabilityState !== "restricted" ||
      record.reasonCode !== "phase-deferred" ||
      record.authority.authorityKind !== "evaluator-policy" ||
      record.authority.authorityId !== "evaluator-policy:e1c" ||
      record.policy.component !== "e1-scope-policy" ||
      record.policy.version !== "1.0.0" ||
      record.impactScope.scopeKind !== "subject-only" ||
      record.impactScope.affectedIdentityHashes.length !== 1 ||
      record.impactScope.affectedIdentityHashes[0] !== expectedHash ||
      details.size !== 3 ||
      details.get("capability-id") !== RUNTIME_CAPABILITY_ID ||
      details.get("capability-version") !== RUNTIME_CAPABILITY_VERSION ||
      details.get("manifest-hash") !== manifestHash
    ) {
      throw new ScoringContractError(
        "runtime-availability-identity",
        "runtime availability record does not match the E1c deferred checkpoint-isolation capability identity",
      );
    }
  }
  return effective;
}

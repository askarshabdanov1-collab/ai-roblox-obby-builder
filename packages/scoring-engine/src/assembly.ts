import {
  EVALUATOR_CANONICAL_JSON_ALGORITHM,
  canonicalizeEvaluatorSnapshot,
  compareUnicodeScalars,
  sha256Bytes,
  type JsonValue,
} from "@obby/canonical-json";
import {
  assertValidEvaluatorConfigurationGraph,
  assertValidEvidenceGraph,
  hashCalculationBundle,
  hashMetricCalculation,
  hashReportPayload,
  parseEvaluationMetric,
  parseFinding,
  parseReportPayloadPreimage,
  verifyMetricCalculationIdentity,
  verifyReportPayloadIdentity,
  type CalculationBundlePreimage,
  type EvaluationCompleteness,
  type EvaluationMetric,
  type EvidenceKind,
  type EvidenceRecordContract,
  type Finding,
  type InvariantGateResult,
  type MetricCalculationPreimage,
  type MetricCatalog,
  type MetricDefinition,
  type MetricValue,
  type ProfileGateResult,
  type ReportCategoryResult,
  type ReportPayloadPreimage,
} from "@obby/obby-evaluator-contracts";

import { resolveRuntimeCapabilityAvailability } from "./availability.js";
import {
  selectAuthoritativeE1Evidence,
  type EvidenceSelection,
} from "./evidence-selection.js";
import {
  ScoringContractError,
  type E1EvaluationInput,
  type E1EvaluationLimits,
  type E1EvaluationResult,
  type E1ReportInput,
  type FinalizedE1Report,
} from "./types.js";

const DEFAULT_LIMITS: E1EvaluationLimits = Object.freeze({
  maxMetricDefinitions: 256,
  maxCalculations: 256,
  maxFindings: 4096,
  maxEvidenceRecords: 4096,
  maxAvailabilityRecords: 4096,
  maxReportItems: 16_384,
  maxWorkUnits: 100_000,
});

class WorkBudget {
  private used = 0;

  public constructor(private readonly maximum: number) {}

  public use(units = 1): void {
    if (
      !Number.isSafeInteger(units) ||
      units < 0 ||
      units > this.maximum - this.used
    ) {
      throw new ScoringContractError(
        "maximum-work-units",
        `E1 scoring work exceeds limit ${this.maximum}`,
      );
    }
    this.used += units;
  }

  public get totalUsed(): number {
    return this.used;
  }
}

function limits(input: Partial<E1EvaluationLimits> | undefined) {
  const resolved = { ...DEFAULT_LIMITS, ...input };
  for (const [name, value] of Object.entries(resolved)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new ScoringContractError(
        "invalid-limit",
        `${name} must be a non-negative safe integer`,
      );
    }
  }
  return resolved;
}

function enforceCount(name: string, actual: number, maximum: number): void {
  if (actual > maximum) {
    throw new ScoringContractError(
      `maximum-${name}`,
      `${name} count ${actual} exceeds limit ${maximum}`,
    );
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].toSorted(compareUnicodeScalars);
}

function semanticHash(domain: string, value: unknown): `sha256:${string}` {
  return sha256Bytes(
    canonicalizeEvaluatorSnapshot({
      canonicalizationAlgorithm: EVALUATOR_CANONICAL_JSON_ALGORITHM,
      domain,
      value: value as JsonValue,
    }).canonicalBytes,
  );
}

function evidenceSubjectKey(record: EvidenceRecordContract): string {
  return `subject:${semanticHash("evidence-subject-v1", record.subject).slice(7)}`;
}

function requiredEvidenceId(record: EvidenceRecordContract): string {
  if (record.evidenceId === undefined) {
    throw new ScoringContractError(
      "missing-evidence-id",
      `final E1 evidence ${record.evidenceContentHash} has no evidenceId`,
    );
  }
  return record.evidenceId;
}

function reportSubjectKey(evidence: EvidenceRecordContract): string {
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

function executiveOutcome(
  input: E1ReportInput,
): ReportPayloadPreimage["outcome"] {
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

function finalizeAssembledReport(input: E1ReportInput): FinalizedE1Report {
  const blockingFindingIds = unique([
    ...input.invariantGates
      .filter((gate) => gate.state === "fail")
      .flatMap((gate) => gate.findingIds),
    ...input.profileGates
      .filter((gate) => gate.state === "fail")
      .flatMap((gate) => gate.findingIds),
  ]);
  const payload = parseReportPayloadPreimage({
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
    outcome: executiveOutcome(input),
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
      subjectKey: reportSubjectKey(record),
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
  const report = {
    ...payload,
    reportPayloadHash: hashReportPayload(payload).hash,
  } as FinalizedE1Report;
  verifyReportPayloadIdentity(report);
  return report;
}

function categoryForMetric(
  metricId: string,
  categories: readonly { categoryId: string; metricIds: readonly string[] }[],
): EvaluationMetric["category"] {
  const matches = categories.filter((category) =>
    category.metricIds.includes(metricId),
  );
  if (matches.length !== 1) {
    throw new ScoringContractError(
      "metric-category-membership",
      `metric ${metricId} must belong to exactly one profile category`,
    );
  }
  const match = matches[0];
  if (match === undefined) throw new Error("unreachable category match");
  return match.categoryId as EvaluationMetric["category"];
}

function compareThreshold(
  value: MetricValue | undefined,
  operator: "eq" | "ne" | "lt" | "lte" | "gt" | "gte",
  expected: boolean | number | string,
): boolean {
  const actual = value?.value;
  if (actual === undefined || typeof actual !== typeof expected) return false;
  switch (operator) {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "lt":
      return actual < expected;
    case "lte":
      return actual <= expected;
    case "gt":
      return actual > expected;
    case "gte":
      return actual >= expected;
  }
}

type CalculationDecision = {
  state: MetricCalculationPreimage["calculationState"];
  value?: MetricValue;
  evidence: EvidenceRecordContract[];
  limitations: string[];
  unavailableReason?: MetricCalculationPreimage["unavailableReason"];
  blockedBy?: MetricCalculationPreimage["blockedBy"];
  parentCalculations?: MetricCalculationPreimage["parentCalculations"];
};

function finalizeCalculation(
  definition: MetricDefinition,
  decision: CalculationDecision,
  planConfigurationHash: string,
): MetricCalculationPreimage {
  const deterministicParametersHash = semanticHash(
    "e1-metric-deterministic-parameters-v1",
    {
      metricId: definition.metricId,
      metricVersion: definition.metricVersion,
      calculationConfigurationHash: definition.calculation.configurationHash,
      planConfigurationHash,
    },
  );
  const evidence = decision.evidence
    .map((record) => ({
      kind: record.kind,
      subjectKey: evidenceSubjectKey(record),
      evidenceContentHash: record.evidenceContentHash,
    }))
    .toSorted((left, right) =>
      compareUnicodeScalars(
        `${left.kind}:${left.subjectKey}:${left.evidenceContentHash}`,
        `${right.kind}:${right.subjectKey}:${right.evidenceContentHash}`,
      ),
    );
  const result: MetricCalculationPreimage["result"] = {
    status:
      decision.state === "calculated" || decision.state === "indeterminate"
        ? "available"
        : decision.state === "unavailable"
          ? "missing-evidence"
          : decision.state === "not-applicable"
            ? "not-applicable"
            : "failed",
    ...(decision.value === undefined ? {} : { value: decision.value }),
  };
  const thresholdsApplied = definition.thresholds.map((threshold) => ({
    thresholdId: threshold.thresholdId,
    classification: threshold.classification,
    matched: compareThreshold(
      decision.value,
      threshold.operator,
      threshold.value,
    ),
  }));
  const source: MetricCalculationPreimage = {
    schemaVersion: "0.1",
    metricId: definition.metricId,
    metricVersion: definition.metricVersion,
    metricDefinitionHash: definition.metricDefinitionHash,
    calculationConfigurationHash: definition.calculation.configurationHash,
    deterministicParametersHash,
    calculationState: decision.state,
    evidence,
    parentCalculations: decision.parentCalculations ?? [],
    result,
    thresholdsApplied,
    confidence: {
      value:
        decision.state === "calculated"
          ? 1
          : decision.state === "indeterminate"
            ? 0
            : 0,
      basis:
        decision.state === "calculated"
          ? definition.resultKind === "heuristic-estimate"
            ? "complete-bounded-model-inputs"
            : "complete-deterministic-inputs"
          : decision.state === "indeterminate"
            ? "model-inputs-indeterminate"
            : "required-inputs-unavailable",
      limitations: unique(decision.limitations),
      sampleCount: evidence.length,
    },
    ...(decision.unavailableReason === undefined
      ? {}
      : { unavailableReason: decision.unavailableReason }),
    ...(decision.blockedBy === undefined
      ? {}
      : { blockedBy: decision.blockedBy }),
    limitations: unique(decision.limitations).map((text, index) => ({
      code: `limitation-${index + 1}`,
      text,
    })),
    reproduction: {
      method: {
        component: definition.calculation.methodId,
        version: definition.calculation.version,
      },
      inputEvidenceHashes: evidence.map((item) => item.evidenceContentHash),
      deterministicParametersHash,
    },
  };
  const finalized = {
    ...source,
    calculationHash: hashMetricCalculation(source).hash,
  };
  return verifyMetricCalculationIdentity(finalized);
}

function missingDecision(
  definition: MetricDefinition,
  evidence: EvidenceRecordContract[],
  missingKind: EvidenceKind,
): CalculationDecision {
  return {
    state: "unavailable",
    evidence,
    unavailableReason: {
      reasonCode: `missing-${missingKind}`,
      deferredCapability: definition.requiredCapabilities[0] ?? "route",
      responsibleProducer: "route-playability-evaluator",
    },
    limitations: [
      ...definition.limitationsTemplate,
      `Required ${missingKind} evidence is unavailable.`,
    ],
  };
}

function decisionForDefinition(
  definition: MetricDefinition,
  selectedEvidence: EvidenceSelection,
): CalculationDecision {
  const routeGraph = selectedEvidence.routeGraph;
  const summary = selectedEvidence.summary;
  const geometry = selectedEvidence.geometry;
  const transitions = selectedEvidence.transitions;
  const coarse = selectedEvidence.coarseTransitions;
  const checkpoints = selectedEvidence.checkpoints;
  const finishes = selectedEvidence.finishes;
  const hazards = selectedEvidence.hazards;
  const skips = selectedEvidence.skips;
  const limitations = [...definition.limitationsTemplate];

  switch (definition.metricId) {
    case "playability.route-completeness": {
      const selected = [
        ...(routeGraph === undefined ? [] : [routeGraph]),
        ...transitions,
        ...finishes,
      ];
      if (routeGraph === undefined)
        return missingDecision(definition, selected, "route-graph");
      if (finishes.length !== 1)
        return missingDecision(definition, selected, "finish-topology");
      const graph = routeGraph.payload;
      if (graph.kind !== "route-graph")
        return missingDecision(definition, selected, "route-graph");
      const transitionIds = new Set(
        transitions
          .filter((record) => record.payload.kind === "route-transition")
          .map((record) =>
            record.payload.kind === "route-transition"
              ? record.payload.transitionId
              : "",
          ),
      );
      const complete =
        graph.structuralState === "connected" &&
        graph.orderedTransitionIds.every((id) => transitionIds.has(id));
      return {
        state: "calculated",
        value: { kind: "number", value: complete ? 1 : 0, unit: "ratio" },
        evidence: selected,
        limitations,
      };
    }
    case "playability.required-transition-feasibility": {
      const selected = [...(summary === undefined ? [] : [summary]), ...coarse];
      if (summary === undefined)
        return missingDecision(
          definition,
          selected,
          "route-playability-summary",
        );
      if (
        coarse.some(
          (record) =>
            record.payload.kind === "coarse-transition-state" &&
            record.payload.state === "indeterminate",
        )
      ) {
        return {
          state: "indeterminate",
          value: { kind: "state", value: "indeterminate" },
          evidence: selected,
          limitations,
        };
      }
      const infeasible = coarse.some(
        (record) =>
          record.payload.kind === "coarse-transition-state" &&
          record.payload.state === "infeasible-under-model",
      );
      return {
        state: "calculated",
        value: {
          kind: "state",
          value: infeasible ? "infeasible-under-model" : "feasible-under-model",
        },
        evidence: selected,
        limitations,
      };
    }
    case "checkpoint.topology-validity": {
      const selected = [
        ...(routeGraph === undefined ? [] : [routeGraph]),
        ...checkpoints,
      ];
      if (routeGraph === undefined)
        return missingDecision(definition, selected, "route-graph");
      if (routeGraph.payload.kind !== "route-graph")
        return missingDecision(definition, selected, "route-graph");
      if (routeGraph.payload.checkpointObjectIds.length === 0) {
        return { state: "not-applicable", evidence: [routeGraph], limitations };
      }
      if (
        checkpoints.length !== routeGraph.payload.checkpointObjectIds.length
      ) {
        return missingDecision(definition, selected, "checkpoint-topology");
      }
      const valid = checkpoints.every(
        (record) =>
          record.payload.kind === "checkpoint-topology" &&
          record.payload.spawnReachable &&
          record.payload.finishReachableAfterCheckpoint &&
          record.payload.gameplayAuthoritative &&
          record.payload.progressionDirection === "forward",
      );
      return {
        state: "calculated",
        value: { kind: "boolean", value: valid },
        evidence: selected,
        limitations,
      };
    }
    case "finish.topology-validity": {
      if (finishes.length !== 1)
        return missingDecision(definition, finishes, "finish-topology");
      const finish = finishes[0];
      if (finish === undefined) throw new Error("unreachable finish evidence");
      const payload = finish.payload;
      const valid =
        payload.kind === "finish-topology" &&
        payload.requiredFinishCount === 1 &&
        payload.onRequiredRoute &&
        payload.afterAllCheckpoints &&
        payload.structurallyReachable &&
        payload.gameplayAuthoritative;
      return {
        state: "calculated",
        value: { kind: "boolean", value: valid },
        evidence: [finish],
        limitations,
      };
    }
    case "hazard.relationship-candidate-count": {
      if (summary === undefined)
        return missingDecision(
          definition,
          hazards,
          "route-playability-summary",
        );
      const count = hazards.filter(
        (record) =>
          record.payload.kind === "hazard-relationship" &&
          record.payload.assessment === "candidate",
      ).length;
      return {
        state: "calculated",
        value: { kind: "integer", value: count, unit: "candidates" },
        evidence: [summary, ...hazards],
        limitations,
      };
    }
    case "playability.skip-candidate-count": {
      if (summary === undefined)
        return missingDecision(definition, skips, "route-playability-summary");
      return {
        state: "calculated",
        value: { kind: "integer", value: skips.length, unit: "candidates" },
        evidence: [summary, ...skips],
        limitations,
      };
    }
    case "runtime.checkpoint-isolation-availability":
      return {
        state: "unavailable",
        evidence: [],
        unavailableReason: {
          reasonCode: "studio-runtime-deferred",
          deferredCapability: "runtime",
          responsibleProducer: "studio-runtime-collector",
        },
        limitations: [
          ...limitations,
          "Generic runtime observations do not establish multiplayer checkpoint isolation.",
        ],
      };
    case "policy.decorative-collision-violations": {
      if (geometry === undefined)
        return missingDecision(definition, [], "geometry-fact");
      const payload = geometry.payload;
      if (payload.kind !== "geometry-fact")
        return missingDecision(definition, [geometry], "geometry-fact");
      return {
        state: "calculated",
        value: {
          kind: "integer",
          value: payload.decorativeGameplayCollisionCount,
          unit: "objects",
        },
        evidence: [geometry],
        limitations,
      };
    }
    case "performance.native-part-count": {
      if (geometry === undefined)
        return missingDecision(definition, [], "geometry-fact");
      const payload = geometry.payload;
      if (payload.kind !== "geometry-fact")
        return missingDecision(definition, [geometry], "geometry-fact");
      return {
        state: "calculated",
        value: {
          kind: "integer",
          value: payload.objectIds.length,
          unit: "objects",
        },
        evidence: [geometry],
        limitations,
      };
    }
    case "policy.evidence-completeness":
      throw new ScoringContractError(
        "calculation-order",
        "evidence completeness must be calculated after other metrics",
      );
    default:
      return {
        state: "unavailable",
        evidence: [],
        unavailableReason: {
          reasonCode: "unsupported-e1-metric",
          deferredCapability: definition.requiredCapabilities[0] ?? "route",
          responsibleProducer: "scoring-engine",
        },
        limitations: [
          ...limitations,
          "The E1 scoring engine has no registered calculator for this metric.",
        ],
      };
  }
}

function findingForGate(
  invariantId: string,
  evidence: readonly EvidenceRecordContract[],
): Finding {
  return parseFinding({
    schemaVersion: "0.1",
    findingId: `finding.invariant.${invariantId}`,
    ruleId: `invariant.${invariantId}`,
    ruleVersion: "1.0.0",
    metricIds: [],
    title: `Invariant failed: ${invariantId}`,
    summary: `The non-overridable ${invariantId} invariant failed on validated E1 evidence.`,
    severity: "blocking",
    blocking: true,
    invariantId,
    sourceKind: "deterministic",
    subjects: [{ kind: "scene" }],
    evidenceIds: evidence.map(requiredEvidenceId),
    limitations: [],
  });
}

function gate(
  invariantId: string,
  state: InvariantGateResult["state"],
  evidence: readonly EvidenceRecordContract[],
  findingIds: readonly string[] = [],
  blockedMetricIds: readonly string[] = [],
): InvariantGateResult {
  return {
    invariantId,
    state,
    evidenceIds: unique(evidence.map(requiredEvidenceId)),
    evidenceContentHashes: unique(
      evidence.map((record) => record.evidenceContentHash),
    ),
    findingIds: unique(findingIds),
    blockedMetricIds: unique(blockedMetricIds),
  };
}

function structuralGates(selected: EvidenceSelection): {
  gates: InvariantGateResult[];
  findings: Finding[];
} {
  const route = selected.routeGraph;
  const geometry = selected.geometry;
  const transitions = selected.transitions;
  const checkpoints = selected.checkpoints;
  const finishes = selected.finishes;
  const results: InvariantGateResult[] = [];
  const findings: Finding[] = [];
  const add = (
    id: string,
    state: InvariantGateResult["state"],
    records: EvidenceRecordContract[],
  ) => {
    if (state === "fail") {
      const finding = findingForGate(id, records);
      findings.push(finding);
      results.push(gate(id, state, records, [finding.findingId]));
    } else {
      results.push(gate(id, state, records));
    }
  };
  const routePayload =
    route?.payload.kind === "route-graph" ? route.payload : undefined;
  add(
    "required-route-topology",
    routePayload === undefined
      ? "missing-evidence"
      : routePayload.structuralState === "connected"
        ? "pass"
        : "fail",
    route === undefined ? [] : [route],
  );
  const transitionIds = new Set(
    transitions.flatMap((record) =>
      record.payload.kind === "route-transition"
        ? [record.payload.transitionId]
        : [],
    ),
  );
  add(
    "required-reference-resolution",
    routePayload === undefined
      ? "missing-evidence"
      : routePayload.orderedTransitionIds.length === transitions.length &&
          routePayload.orderedTransitionIds.every((id) => transitionIds.has(id))
        ? "pass"
        : "fail",
    [...(route === undefined ? [] : [route]), ...transitions],
  );
  const checkpointValid =
    routePayload?.checkpointObjectIds.length === checkpoints.length &&
    checkpoints.every(
      (record) =>
        record.payload.kind === "checkpoint-topology" &&
        routePayload.checkpointObjectIds.includes(
          record.payload.checkpointObjectId,
        ) &&
        record.payload.progressionDirection === "forward" &&
        record.payload.spawnReachable &&
        record.payload.finishReachableAfterCheckpoint,
    );
  add(
    "checkpoint-ordering",
    routePayload === undefined
      ? "missing-evidence"
      : checkpointValid
        ? "pass"
        : "fail",
    [...(route === undefined ? [] : [route]), ...checkpoints],
  );
  const finishValid =
    finishes.length === 1 &&
    finishes[0]?.payload.kind === "finish-topology" &&
    finishes[0].payload.requiredFinishCount === 1 &&
    finishes[0].payload.onRequiredRoute &&
    finishes[0].payload.afterAllCheckpoints &&
    finishes[0].payload.structurallyReachable;
  add(
    "finish-topology",
    finishes.length === 0 ? "missing-evidence" : finishValid ? "pass" : "fail",
    finishes,
  );
  const geometryPayload =
    geometry?.payload.kind === "geometry-fact" ? geometry.payload : undefined;
  const authoritative = new Set(
    geometryPayload?.gameplayAuthoritativeObjectIds ?? [],
  );
  const authorityValid =
    routePayload !== undefined &&
    geometryPayload !== undefined &&
    routePayload.orderedNodeIds.every((id) => authoritative.has(id)) &&
    checkpoints.every(
      (record) =>
        record.payload.kind === "checkpoint-topology" &&
        record.payload.gameplayAuthoritative,
    ) &&
    finishes.every(
      (record) =>
        record.payload.kind === "finish-topology" &&
        record.payload.gameplayAuthoritative,
    );
  add(
    "gameplay-route-authority",
    routePayload === undefined || geometryPayload === undefined
      ? "missing-evidence"
      : authorityValid
        ? "pass"
        : "fail",
    [
      ...(route === undefined ? [] : [route]),
      ...(geometry === undefined ? [] : [geometry]),
      ...checkpoints,
      ...finishes,
    ],
  );
  add(
    "evidence-graph-integrity",
    route === undefined ? "missing-evidence" : "pass",
    route === undefined ? [] : [route],
  );
  add(
    "decorative-gameplay-collision",
    geometryPayload === undefined
      ? "missing-evidence"
      : geometryPayload.decorativeGameplayCollisionCount === 0
        ? "pass"
        : "fail",
    geometry === undefined ? [] : [geometry],
  );
  return {
    gates: results.toSorted((left, right) =>
      compareUnicodeScalars(left.invariantId, right.invariantId),
    ),
    findings: findings.toSorted((left, right) =>
      compareUnicodeScalars(left.findingId, right.findingId),
    ),
  };
}

function metricResult(
  definition: MetricDefinition,
  calculation: MetricCalculationPreimage,
  categories: readonly { categoryId: string; metricIds: readonly string[] }[],
  evidenceByHash: ReadonlyMap<string, EvidenceRecordContract>,
): EvaluationMetric | undefined {
  if (
    calculation.calculationState !== "calculated" &&
    calculation.calculationState !== "indeterminate"
  ) {
    return undefined;
  }
  const value = calculation.result.value;
  if (value === undefined || calculation.calculationHash === undefined) {
    throw new ScoringContractError(
      "incomplete-calculation",
      `calculated metric ${definition.metricId} lacks value or hash`,
    );
  }
  const evidenceIds = calculation.evidence.map((entry) => {
    const record = evidenceByHash.get(entry.evidenceContentHash);
    if (record === undefined) {
      throw new ScoringContractError(
        "unresolved-calculation-evidence",
        `calculation ${definition.metricId} references missing evidence ${entry.evidenceContentHash}`,
      );
    }
    return requiredEvidenceId(record);
  }) as [string, ...string[]];
  const thresholdsApplied = calculation.thresholdsApplied;
  const thresholdFailure = thresholdsApplied.some((item) => !item.matched);
  const candidateWarning =
    (definition.metricId === "hazard.relationship-candidate-count" ||
      definition.metricId === "playability.skip-candidate-count") &&
    typeof value.value === "number" &&
    value.value > 0;
  const base = {
    schemaVersion: "0.1" as const,
    metricId: definition.metricId,
    metricVersion: definition.metricVersion,
    metricDefinitionHash: definition.metricDefinitionHash,
    category: categoryForMetric(definition.metricId, categories),
    status: "available" as const,
    value,
    severity: thresholdFailure
      ? definition.blockingEligibility === "invariant"
        ? ("blocking" as const)
        : ("error" as const)
      : candidateWarning
        ? ("warning" as const)
        : ("info" as const),
    blocking: thresholdFailure && definition.blockingEligibility !== "none",
    ...(definition.invariantGateId === undefined
      ? {}
      : { invariantId: definition.invariantGateId }),
    evidenceIds,
    thresholdsApplied,
    limitations: calculation.limitations.map((item) => item.text),
    calculationHash: calculation.calculationHash,
  };
  return parseEvaluationMetric(
    definition.resultKind === "heuristic-estimate"
      ? {
          ...base,
          resultKind: "heuristic-estimate",
          sourceKind: "heuristic",
          confidence: calculation.confidence,
        }
      : {
          ...base,
          resultKind: "deterministic-fact",
          sourceKind: "deterministic",
          confidence: { ...calculation.confidence, value: 1 },
          method: {
            component: definition.calculation.methodId,
            version: definition.calculation.version,
          },
        },
  );
}

function normalizeInputFindings(
  inputs: readonly unknown[],
  evidence: readonly EvidenceRecordContract[],
  knownMetricIds: ReadonlySet<string>,
): Finding[] {
  const evidenceIds = new Set(evidence.map(requiredEvidenceId));
  const findings = inputs.map(parseFinding).map((finding) => ({
    ...finding,
    metricIds: finding.metricIds.map((metricId) =>
      metricId === "playability.coarse-transition-state"
        ? "playability.required-transition-feasibility"
        : metricId,
    ),
  }));
  const ids = new Set<string>();
  for (const finding of findings) {
    if (ids.has(finding.findingId)) {
      throw new ScoringContractError(
        "duplicate-finding",
        `duplicate finding ${finding.findingId}`,
      );
    }
    ids.add(finding.findingId);
    for (const evidenceId of finding.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        throw new ScoringContractError(
          "unresolved-finding-evidence",
          `finding ${finding.findingId} references unknown evidence ${evidenceId}`,
        );
      }
    }
    for (const metricId of finding.metricIds) {
      if (!knownMetricIds.has(metricId)) {
        throw new ScoringContractError(
          "unresolved-finding-metric",
          `finding ${finding.findingId} references unknown metric ${metricId}`,
        );
      }
    }
  }
  return findings.toSorted((left, right) =>
    compareUnicodeScalars(left.findingId, right.findingId),
  );
}

export function validateMetricCalculations(
  inputs: readonly unknown[],
  definitions: readonly MetricDefinition[],
  evidenceInputs: readonly unknown[],
): MetricCalculationPreimage[] {
  const definitionById = new Map(
    definitions.map((definition) => [definition.metricId, definition]),
  );
  const evidence = assertValidEvidenceGraph(
    evidenceInputs,
  ) as EvidenceRecordContract[];
  const evidenceByHash = new Map(
    evidence.map((record) => [record.evidenceContentHash, record]),
  );
  const calculations = inputs
    .map(verifyMetricCalculationIdentity)
    .toSorted((left, right) =>
      compareUnicodeScalars(left.metricId, right.metricId),
    );
  const metricIdentities = new Map<string, string>();
  const hashes = new Set<string>();
  for (const calculation of calculations) {
    const previousIdentity = metricIdentities.get(calculation.metricId);
    if (previousIdentity !== undefined) {
      throw new ScoringContractError(
        previousIdentity === calculation.calculationHash
          ? "duplicate-metric-calculation"
          : "conflicting-metric-calculation",
        previousIdentity === calculation.calculationHash
          ? `duplicate metric calculation ${calculation.metricId}`
          : `conflicting metric calculations ${calculation.metricId}`,
      );
    }
    metricIdentities.set(
      calculation.metricId,
      calculation.calculationHash ?? "missing",
    );
    if (
      calculation.calculationHash === undefined ||
      hashes.has(calculation.calculationHash)
    ) {
      throw new ScoringContractError(
        "conflicting-calculation-identity",
        `calculation ${calculation.metricId} has a missing or conflicting identity`,
      );
    }
    hashes.add(calculation.calculationHash);
    const definition = definitionById.get(calculation.metricId);
    if (
      definition?.metricVersion !== calculation.metricVersion ||
      definition.metricDefinitionHash !== calculation.metricDefinitionHash ||
      definition.calculation.configurationHash !==
        calculation.calculationConfigurationHash
    ) {
      throw new ScoringContractError(
        "calculation-definition-mismatch",
        `calculation ${calculation.metricId} does not bind its verified definition`,
      );
    }
    for (const reference of calculation.evidence) {
      const record = evidenceByHash.get(reference.evidenceContentHash);
      if (record === undefined) {
        throw new ScoringContractError(
          "unresolved-calculation-evidence",
          `calculation ${calculation.metricId} has unresolved evidence ${reference.evidenceContentHash}`,
        );
      }
      if (
        record.kind !== reference.kind ||
        evidenceSubjectKey(record) !== reference.subjectKey
      ) {
        throw new ScoringContractError(
          "unresolved-calculation-evidence",
          `calculation ${calculation.metricId} has unresolved evidence ${reference.evidenceContentHash}`,
        );
      }
    }
  }
  for (const calculation of calculations) {
    for (const parent of calculation.parentCalculations) {
      const resolved = calculations.find(
        (candidate) => candidate.metricId === parent.metricId,
      );
      if (resolved?.calculationHash !== parent.calculationHash) {
        throw new ScoringContractError(
          "unresolved-parent-calculation",
          `calculation ${calculation.metricId} has unresolved parent ${parent.metricId}`,
        );
      }
    }
  }
  return calculations;
}

function requiredCalculationHash(
  calculation: MetricCalculationPreimage,
): `sha256:${string}` {
  if (calculation.calculationHash === undefined) {
    throw new ScoringContractError(
      "missing-calculation-hash",
      `calculation ${calculation.metricId} has no calculationHash`,
    );
  }
  return calculation.calculationHash as `sha256:${string}`;
}

function profileGates(
  calculations: readonly MetricCalculationPreimage[],
  thresholds: readonly {
    thresholdId: string;
    metricId: string;
    classification: "provisional" | "calibration-required";
    operator: "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
    value: boolean | number | string;
  }[],
  findings: Finding[],
): ProfileGateResult[] {
  const byMetric = new Map(
    calculations.map((calculation) => [calculation.metricId, calculation]),
  );
  return thresholds
    .map((threshold) => {
      const calculation = byMetric.get(threshold.metricId);
      const state: ProfileGateResult["state"] =
        calculation === undefined ||
        calculation.calculationState === "unavailable"
          ? "missing-evidence"
          : calculation.calculationState === "not-applicable"
            ? "not-applicable"
            : calculation.calculationState === "indeterminate"
              ? "missing-evidence"
              : compareThreshold(
                    calculation.result.value,
                    threshold.operator,
                    threshold.value,
                  )
                ? "pass"
                : "fail";
      const relatedFindings = findings
        .filter((finding) => finding.metricIds.includes(threshold.metricId))
        .map((finding) => finding.findingId);
      return {
        gateId: threshold.thresholdId,
        metricId: threshold.metricId,
        state,
        classification: threshold.classification,
        evidenceContentHashes:
          calculation?.evidence.map((entry) => entry.evidenceContentHash) ?? [],
        findingIds: unique(relatedFindings),
      };
    })
    .toSorted((left, right) =>
      compareUnicodeScalars(left.gateId, right.gateId),
    );
}

function categories(
  profileCategories: readonly {
    categoryId: string;
    metricIds: readonly string[];
  }[],
  calculations: readonly MetricCalculationPreimage[],
  gates: readonly InvariantGateResult[],
  catalogGates: MetricCatalog["invariantGates"],
  optionalMetricIds: ReadonlySet<string>,
): ReportCategoryResult[] {
  const byMetric = new Map(
    calculations.map((calculation) => [calculation.metricId, calculation]),
  );
  const catalogById = new Map(
    catalogGates.map((gate) => [gate.invariantId, gate]),
  );
  return profileCategories
    .map((category): ReportCategoryResult => {
      const members = category.metricIds.map((metricId) =>
        byMetric.get(metricId),
      );
      const requiredMembers = category.metricIds
        .filter((metricId) => !optionalMetricIds.has(metricId))
        .map((metricId) => byMetric.get(metricId));
      const affectedGateState = gates.find((gate) => {
        if (gate.state === "pass") return false;
        const policy = catalogById.get(gate.invariantId);
        return (
          policy?.dependencyScope === "global" ||
          policy?.affectedCategoryIds.includes(category.categoryId) === true ||
          gate.blockedMetricIds.some((metricId) =>
            category.metricIds.includes(metricId),
          )
        );
      })?.state;
      const status: ReportCategoryResult["status"] =
        affectedGateState === "fail"
          ? "incomplete"
          : affectedGateState === "missing-evidence"
            ? "missing-evidence"
            : requiredMembers.some(
                  (item) =>
                    item === undefined ||
                    item.calculationState === "unavailable",
                )
              ? "incomplete"
              : members.every(
                    (item) => item?.calculationState === "not-applicable",
                  )
                ? "not-applicable"
                : members.some(
                      (item) => item?.calculationState === "indeterminate",
                    )
                  ? "incomplete"
                  : "available";
      const available = members.filter(
        (item): item is MetricCalculationPreimage => item !== undefined,
      );
      return {
        categoryId: category.categoryId,
        status,
        metricIds: unique(category.metricIds),
        ...(available.length === 0
          ? {}
          : {
              confidence: {
                value: Math.min(
                  ...available.map((item) => item.confidence.value),
                ),
                basis: "minimum-member-confidence",
                limitations: unique(
                  available.flatMap((item) => item.confidence.limitations),
                ),
              },
            }),
        classification: "provisional",
      };
    })
    .toSorted((left, right) =>
      compareUnicodeScalars(left.categoryId, right.categoryId),
    );
}

export function assembleE1Evaluation(
  input: E1EvaluationInput,
): E1EvaluationResult {
  const resolvedLimits = limits(input.limits);
  enforceCount(
    "metric-definitions",
    input.metricDefinitions.length,
    resolvedLimits.maxMetricDefinitions,
  );
  enforceCount("findings", input.findings.length, resolvedLimits.maxFindings);
  enforceCount(
    "evidence-records",
    input.evidence.length,
    resolvedLimits.maxEvidenceRecords,
  );
  enforceCount(
    "availability-records",
    input.availabilityRecords?.length ?? 0,
    resolvedLimits.maxAvailabilityRecords,
  );
  const work = new WorkBudget(resolvedLimits.maxWorkUnits);
  work.use(input.metricDefinitions.length * 2);
  work.use(input.evidence.length * 2);
  work.use(input.findings.length);
  work.use((input.availabilityRecords?.length ?? 0) * 2);
  const graph = assertValidEvaluatorConfigurationGraph({
    metricDefinitions: input.metricDefinitions,
    catalog: input.catalog,
    profile: input.profile,
    plan: input.plan,
    request: input.request,
    evaluatorVersion: input.evaluatorVersion,
    componentVersions: input.componentVersions,
  });
  const evidence = assertValidEvidenceGraph(
    input.evidence,
  ) as EvidenceRecordContract[];
  for (const record of evidence) {
    work.use();
    if (record.manifestHash !== graph.plan.scene.manifestHash) {
      throw new ScoringContractError(
        "evidence-manifest-scope",
        `evidence ${record.evidenceContentHash} is outside the requested manifest`,
      );
    }
  }
  const availability = resolveRuntimeCapabilityAvailability(
    input.availabilityRecords ?? [],
    graph.plan.scene.manifestHash,
  );
  const selectedEvidence = selectAuthoritativeE1Evidence(evidence, (units) =>
    work.use(units),
  );
  const authoritativeCandidates = [
    ...(selectedEvidence.routeGraph === undefined
      ? []
      : [selectedEvidence.routeGraph]),
    ...(selectedEvidence.summary === undefined
      ? []
      : [selectedEvidence.summary]),
    ...(selectedEvidence.geometry === undefined
      ? []
      : [selectedEvidence.geometry]),
    ...selectedEvidence.transitions,
    ...selectedEvidence.coarseTransitions,
    ...selectedEvidence.checkpoints,
    ...selectedEvidence.finishes,
    ...selectedEvidence.hazards,
    ...selectedEvidence.skips,
  ];
  const authoritativeByHash = new Map<string, EvidenceRecordContract>();
  for (const record of authoritativeCandidates) {
    work.use(2);
    authoritativeByHash.set(record.evidenceContentHash, record);
  }
  work.use(
    authoritativeByHash.size *
      Math.ceil(Math.log2(Math.max(1, authoritativeByHash.size))),
  );
  const authoritativeEvidence = [...authoritativeByHash.values()].toSorted(
    (left, right) =>
      compareUnicodeScalars(
        left.evidenceContentHash,
        right.evidenceContentHash,
      ),
  );
  const selectedMetricIds = new Set(
    graph.plan.metricInclude.filter(
      (metricId) => !graph.plan.metricExclude.includes(metricId),
    ),
  );
  const definitions = graph.metricDefinitions
    .filter((definition) => selectedMetricIds.has(definition.metricId))
    .toSorted((left, right) =>
      compareUnicodeScalars(left.metricId, right.metricId),
    );
  enforceCount(
    "calculations",
    definitions.length,
    resolvedLimits.maxCalculations,
  );
  const knownMetricIds = new Set(
    definitions.map((definition) => definition.metricId),
  );
  let findings = normalizeInputFindings(
    input.findings,
    authoritativeEvidence,
    knownMetricIds,
  );
  const structural = structuralGates(selectedEvidence);
  findings = [...findings, ...structural.findings].toSorted((left, right) =>
    compareUnicodeScalars(left.findingId, right.findingId),
  );
  const completenessDefinition = definitions.find(
    (definition) => definition.metricId === "policy.evidence-completeness",
  );
  if (completenessDefinition === undefined) {
    throw new ScoringContractError(
      "missing-completeness-definition",
      "E1 profile requires policy.evidence-completeness",
    );
  }
  let calculations = definitions
    .filter((definition) => definition !== completenessDefinition)
    .map((definition) => {
      work.use(3);
      return finalizeCalculation(
        definition,
        decisionForDefinition(definition, selectedEvidence),
        graph.plan.configurationHash,
      );
    });
  const failedStructuralGate = structural.gates.find(
    (item) => item.state === "fail",
  );
  const requiredIds = new Set(graph.profile.requiredMetricIds);
  const completenessEvidence =
    selectedEvidence.routeGraph === undefined
      ? []
      : [selectedEvidence.routeGraph];
  const requestedMetricIds = [...selectedMetricIds].toSorted(
    compareUnicodeScalars,
  );
  const expectedCalculatedIds = definitions
    .map((definition) => definition.metricId)
    .toSorted(compareUnicodeScalars);
  const missingMetricIds = requestedMetricIds.filter(
    (metricId) => !expectedCalculatedIds.includes(metricId),
  );
  const unavailable = calculations
    .filter(
      (
        calculation,
      ): calculation is MetricCalculationPreimage & {
        unavailableReason: NonNullable<
          MetricCalculationPreimage["unavailableReason"]
        >;
      } => calculation.unavailableReason !== undefined,
    )
    .map((calculation) => ({
      metricId: calculation.metricId,
      reasonCode: calculation.unavailableReason.reasonCode,
      deferredCapability: calculation.unavailableReason.deferredCapability,
      ...(calculation.unavailableReason.responsibleProducer === undefined
        ? {}
        : {
            responsibleProducer:
              calculation.unavailableReason.responsibleProducer,
          }),
    }));
  const unexplainedUnavailable = unavailable.filter(
    (item) =>
      item.deferredCapability !== "runtime" || availability.length === 0,
  );
  const missingRequiredIds = calculations
    .filter((calculation) => {
      if (!requiredIds.has(calculation.metricId)) return false;
      if (
        calculation.calculationState === "unavailable" ||
        calculation.calculationState === "indeterminate"
      ) {
        return true;
      }
      if (calculation.calculationState !== "not-applicable") return false;
      const definition = definitions.find(
        (candidate) => candidate.metricId === calculation.metricId,
      );
      return definition?.applicability !== "conditional";
    })
    .map((calculation) => calculation.metricId)
    .toSorted(compareUnicodeScalars);
  const completenessState: EvaluationCompleteness["state"] =
    failedStructuralGate !== undefined
      ? "blocked"
      : missingMetricIds.length > 0 ||
          missingRequiredIds.length > 0 ||
          unexplainedUnavailable.length > 0
        ? "incomplete"
        : "complete";
  const completenessDecision: CalculationDecision =
    completenessEvidence.length === 0
      ? {
          state: "unavailable",
          evidence: [],
          unavailableReason: {
            reasonCode: "missing-required-evidence",
            deferredCapability: "route",
            responsibleProducer: "route-playability-evaluator",
          },
          limitations: [
            ...completenessDefinition.limitationsTemplate,
            "Completeness cannot be calculated without authoritative route-graph evidence.",
          ],
        }
      : failedStructuralGate === undefined
        ? {
            state: "calculated",
            value: {
              kind: "boolean",
              value: completenessState === "complete",
            },
            evidence: completenessEvidence,
            parentCalculations: calculations
              .filter((calculation) => requiredIds.has(calculation.metricId))
              .map((calculation) => ({
                metricId: calculation.metricId,
                calculationHash: requiredCalculationHash(calculation),
              })),
            limitations: [...completenessDefinition.limitationsTemplate],
          }
        : {
            state: "blocked-by-invariant",
            evidence: completenessEvidence,
            blockedBy: {
              invariantId: failedStructuralGate.invariantId,
              evidenceContentHashes:
                failedStructuralGate.evidenceContentHashes as [
                  `sha256:${string}`,
                  ...`sha256:${string}`[],
                ],
            },
            limitations: [
              ...completenessDefinition.limitationsTemplate,
              `Completeness calculation is blocked by ${failedStructuralGate.invariantId}.`,
            ],
          };
  calculations.push(
    finalizeCalculation(
      completenessDefinition,
      completenessDecision,
      graph.plan.configurationHash,
    ),
  );
  work.use(3);
  calculations = validateMetricCalculations(
    calculations,
    definitions,
    authoritativeEvidence,
  );
  const calculatedIds = calculations.map((item) => item.metricId);
  const completeness: EvaluationCompleteness = {
    state: completenessState,
    requestedMetricIds,
    calculatedMetricIds: calculatedIds,
    missingMetricIds,
    missingEvidenceKinds: unique(
      calculations
        .filter((calculation) => calculation.unavailableReason !== undefined)
        .flatMap(
          (calculation) =>
            definitions
              .find(
                (definition) => definition.metricId === calculation.metricId,
              )
              ?.requiredEvidenceKinds.map((kind) => kind) ?? [],
        ),
    ) as EvidenceKind[],
    unresolvedEvidenceHashes: [],
    unresolvedFindingIds: [],
    unavailable,
  };
  const requiredMetricGateIndex = structural.gates.findIndex(
    (item) => item.invariantId === "required-metric-availability",
  );
  const requiredMetricGate = gate(
    "required-metric-availability",
    completeness.state === "complete" ? "pass" : "missing-evidence",
    completenessEvidence,
    [],
    failedStructuralGate === undefined ? [] : ["policy.evidence-completeness"],
  );
  const invariantGates = [...structural.gates];
  if (requiredMetricGateIndex >= 0) {
    invariantGates[requiredMetricGateIndex] = requiredMetricGate;
  } else {
    invariantGates.push(requiredMetricGate);
  }
  invariantGates.sort((left, right) =>
    compareUnicodeScalars(left.invariantId, right.invariantId),
  );
  const invariantPolicyById = new Map(
    graph.catalog.invariantGates.map((policy) => [policy.invariantId, policy]),
  );
  for (const invariantGate of invariantGates) {
    const policy = invariantPolicyById.get(invariantGate.invariantId);
    if (policy === undefined) continue;
    invariantGate.blockedMetricIds =
      invariantGate.state === "pass"
        ? []
        : policy.dependencyScope === "global"
          ? definitions.map((definition) => definition.metricId)
          : policy.affectedMetricIds.filter((metricId) =>
              selectedMetricIds.has(metricId),
            );
  }
  const metrics = definitions
    .flatMap((definition) => {
      const calculation = calculations.find(
        (item) => item.metricId === definition.metricId,
      );
      if (calculation === undefined) return [];
      const result = metricResult(
        definition,
        calculation,
        graph.profile.categories,
        new Map(
          authoritativeEvidence.map((record) => [
            record.evidenceContentHash,
            record,
          ]),
        ),
      );
      return result === undefined ? [] : [result];
    })
    .toSorted((left, right) =>
      compareUnicodeScalars(
        `${left.category}:${left.metricId}`,
        `${right.category}:${right.metricId}`,
      ),
    );
  const evaluatedProfileGates = profileGates(
    calculations,
    graph.profile.thresholds,
    findings,
  );
  const categoryResults = categories(
    graph.profile.categories,
    calculations,
    invariantGates,
    graph.catalog.invariantGates,
    new Set(graph.profile.optionalMetricIds),
  );
  work.use(
    calculations.length +
      invariantGates.length +
      evaluatedProfileGates.length +
      categoryResults.length,
  );
  const ruleVersions = unique([
    ...authoritativeEvidence.map(
      (record) => `${record.producer.component}@${record.producer.version}`,
    ),
    `scoring-engine@${input.evaluatorVersion}`,
  ]).map((identity) => {
    const separator = identity.lastIndexOf("@");
    return {
      component: identity.slice(0, separator),
      version: identity.slice(separator + 1),
    };
  });
  const calculationBundleSource: CalculationBundlePreimage = {
    schemaVersion: "0.1",
    manifestHash: graph.plan.scene.manifestHash,
    configurationHash: graph.plan.configurationHash,
    evaluatorVersion: input.evaluatorVersion,
    metricCatalogHash: graph.catalog.metricCatalogHash,
    scoringProfileHash: graph.profile.scoringProfileHash,
    environmentCompatibilityClass: graph.profile.compatibilityClass,
    evidence: authoritativeEvidence.map((record) => ({
      kind: record.kind,
      subjectKey: evidenceSubjectKey(record),
      evidenceContentHash: record.evidenceContentHash,
    })),
    ruleVersions,
  };
  work.use(authoritativeEvidence.length + ruleVersions.length + 1);
  const calculationBundle = {
    ...calculationBundleSource,
    calculationBundleHash: hashCalculationBundle(calculationBundleSource).hash,
  };
  const runtimeAvailabilityHashes = availability
    .filter((record) => record.subject.stableId === "capability:runtime")
    .map((record) => record.availabilityRecordHash);
  const missingEvidence = unavailable.map((item) => ({
    capability: item.deferredCapability,
    metricId: item.metricId,
    reasonCode: item.reasonCode,
    consequence: `Metric ${item.metricId} is unavailable because ${item.reasonCode}.`,
    ...(item.deferredCapability === "runtime" &&
    runtimeAvailabilityHashes.length > 0
      ? { availabilityRecordHashes: runtimeAvailabilityHashes }
      : {}),
  }));
  missingEvidence.push(
    ...unexplainedUnavailable.map((item) => ({
      capability: item.deferredCapability,
      metricId: item.metricId,
      reasonCode: "missing-availability-record",
      consequence: `Metric ${item.metricId} is unavailable without a verified availability record for capability ${item.deferredCapability}.`,
    })),
  );
  enforceCount(
    "report-items",
    calculations.length +
      invariantGates.length +
      evaluatedProfileGates.length +
      categoryResults.length +
      findings.length +
      authoritativeEvidence.length +
      missingEvidence.length,
    resolvedLimits.maxReportItems,
  );
  work.use(
    calculations.length +
      invariantGates.length +
      evaluatedProfileGates.length +
      categoryResults.length +
      findings.length +
      authoritativeEvidence.length +
      missingEvidence.length,
  );
  const report = finalizeAssembledReport({
    identities: {
      calculationBundleHash: calculationBundle.calculationBundleHash,
      manifestHash: graph.plan.scene.manifestHash,
      manifestSchemaVersion: graph.plan.scene.manifestSchemaVersion,
      configurationHash: graph.plan.configurationHash,
      evaluationRequestHash: graph.request.evaluationRequestHash,
      evaluator: {
        component: "scoring-engine",
        version: input.evaluatorVersion,
      },
    },
    catalog: graph.catalog,
    scoringProfile: graph.profile,
    invariantGates,
    profileGates: evaluatedProfileGates,
    categories: categoryResults,
    calculations,
    completeness,
    availabilityRecordHashes: availability.map(
      (record) => record.availabilityRecordHash,
    ),
    metrics,
    findings,
    evidence: authoritativeEvidence,
    missingEvidence,
    limitations: [
      {
        code: "coarse-model-only",
        text: "Model-relative transition feasibility is not universal Roblox physics proof.",
      },
      {
        code: "candidate-semantics",
        text: "Hazard and skip candidates are not confirmed gameplay failures.",
      },
      {
        code: "runtime-deferred",
        text: "Studio/runtime checkpoint isolation evidence is unavailable in E1c.",
      },
    ],
    compatibleDimensions: ["geometry", "route", "coarse-jump"],
  });
  return {
    metricDefinitions: definitions,
    plan: graph.plan,
    request: graph.request,
    calculations,
    metrics,
    invariantGates,
    profileGates: evaluatedProfileGates,
    completeness,
    categories: categoryResults,
    calculationBundle,
    report,
    workUnitsUsed: work.totalUsed,
  };
}

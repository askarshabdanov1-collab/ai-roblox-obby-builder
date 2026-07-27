import { readFile } from "node:fs/promises";

import {
  canonicalizeEvaluatorSnapshot,
  type JsonValue,
} from "@obby/canonical-json";
import type { SceneManifest } from "@obby/contracts";
import {
  hashAvailabilityRecord,
  hashControllerProfile,
  hashEvaluationPlanConfiguration,
  hashEvaluationRequest,
  hashEvidenceContent,
  hashMetricCalculation,
  type AvailabilityRecord,
  type ControllerProfile,
  type EvaluationPlan,
  type EvaluationRequest,
  type EvidenceRecordContract,
  type MetricCatalog,
  type MetricDefinition,
  type ScoringProfile,
} from "@obby/obby-evaluator-contracts";
import {
  createDefaultControllerProfile,
  evaluateRoutePlayability,
} from "@obby/route-playability-evaluator";
import {
  assembleE1Evaluation,
  renderMarkdownReport,
  RUNTIME_CAPABILITY_VERSION,
  runtimeCapabilitySubjectHash,
} from "@obby/scoring-engine";

const ROOT = new URL("../", import.meta.url);

async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(path, ROOT), "utf8")) as unknown;
}

function canonical(value: unknown): string {
  return `${canonicalizeEvaluatorSnapshot(value as JsonValue).canonicalText}\n`;
}

function planAndRequest(
  manifestHash: string,
  definitions: readonly MetricDefinition[],
  catalog: MetricCatalog,
  profile: ScoringProfile,
): { plan: EvaluationPlan; request: EvaluationRequest } {
  const planSource: EvaluationPlan = {
    schemaVersion: "0.1",
    planId: "e1-static-plan",
    scene: { manifestHash, manifestSchemaVersion: "1.0.0" },
    profile: {
      profileId: profile.profileId,
      profileVersion: profile.profileVersion,
      scoringProfileHash: profile.scoringProfileHash,
      compatibilityClass: profile.compatibilityClass,
    },
    catalog: {
      catalogId: catalog.catalogId,
      catalogVersion: catalog.catalogVersion,
      metricCatalogHash: catalog.metricCatalogHash,
    },
    requiredCapabilities: ["geometry", "route", "coarse-jump"],
    views: [],
    avatarProfiles: ["roblox-default-r15"],
    deviceProfiles: [],
    metricInclude: definitions.map((item) => item.metricId),
    metricExclude: [],
    budgets: {
      maxObjects: 2048,
      maxEvidenceRecords: 4096,
      maxBytes: 8_388_608,
      maxDepth: 64,
    },
    partialEvidencePolicy: "finalize-with-missing",
    seed: 42,
    createdAt: "2030-01-01T00:00:00Z",
    configurationHash: manifestHash,
  };
  const plan = {
    ...planSource,
    configurationHash: hashEvaluationPlanConfiguration(planSource).hash,
  };
  const requestSource: EvaluationRequest = {
    schemaVersion: "0.1",
    requestId: "e1c-fixture-request",
    submittedAt: "2030-01-01T00:00:00Z",
    callerId: "e1c-fixture-generator",
    transport: "test-harness",
    retryAttempt: 0,
    scene: plan.scene,
    configurationHash: plan.configurationHash,
    evaluatorVersionConstraint: ">=0.1.0 <0.2.0",
    profile: plan.profile,
    catalog: plan.catalog,
    requestedEvidenceRequirements: {
      requiredCapabilityIds: ["geometry", "route", "coarse-jump"],
      evidenceKindIds: [
        "geometry-fact",
        "route-graph",
        "route-transition",
        "coarse-transition-state",
        "route-playability-summary",
        "checkpoint-topology",
        "finish-topology",
        "hazard-relationship",
        "skip-candidate",
      ],
      coverageProfileIds: ["e1-static-complete"],
    },
    deterministicRequestOptions: {
      seed: 42,
      partialEvidencePolicy: "finalize-with-missing",
    },
    requestedOutputs: [
      { outputKind: "report-payload", outputFormat: "json" },
      { outputKind: "rendered-report", outputFormat: "markdown" },
    ],
    evaluationRequestHash: manifestHash,
  };
  const request = {
    ...requestSource,
    evaluationRequestHash: hashEvaluationRequest(requestSource).hash,
  };
  return { plan, request };
}

function availability(manifestHash: `sha256:${string}`): AvailabilityRecord {
  const subjectHash = runtimeCapabilitySubjectHash(manifestHash);
  const source: AvailabilityRecord = {
    schemaVersion: "0.1",
    subject: {
      kind: "reference",
      stableId: "capability:runtime",
      contentHash: subjectHash,
    },
    availabilityState: "restricted",
    reasonCode: "phase-deferred",
    reasonDetails: [
      { code: "capability-id", value: "runtime" },
      { code: "capability-version", value: RUNTIME_CAPABILITY_VERSION },
      { code: "manifest-hash", value: manifestHash },
    ],
    authority: {
      authorityKind: "evaluator-policy",
      authorityId: "evaluator-policy:e1c",
    },
    producer: { component: "scoring-engine", version: "0.1.0" },
    effectiveSequence: 1,
    supersedesAvailabilityRecordHashes: [],
    policy: { component: "e1-scope-policy", version: "1.0.0" },
    impactScope: {
      scopeKind: "subject-only",
      affectedIdentityHashes: [subjectHash],
    },
    availabilityRecordHash: subjectHash,
  };
  return {
    ...source,
    availabilityRecordHash: hashAvailabilityRecord(source).hash,
  };
}

function profileWith(
  modify: (profile: ControllerProfile) => void,
): ControllerProfile {
  const profile = structuredClone(createDefaultControllerProfile());
  modify(profile);
  profile.controllerProfileHash = hashControllerProfile(profile).hash;
  return profile;
}

function invalidFinish(
  evidence: readonly EvidenceRecordContract[],
): EvidenceRecordContract[] {
  return evidence.map((record) => {
    if (record.kind !== "finish-topology") return structuredClone(record);
    const source = structuredClone(record);
    source.payload.onRequiredRoute = false;
    source.payload.structurallyReachable = false;
    source.evidenceContentHash = hashEvidenceContent(source).hash;
    return source;
  });
}

type Scenario = {
  evidence: EvidenceRecordContract[];
  findings: unknown[];
};

export async function expectedE1cFixtures(): Promise<Record<string, string>> {
  const definitions = (await json(
    "packages/obby-evaluator-contracts/fixtures/generated/e1-metric-definitions.json",
  )) as MetricDefinition[];
  const catalog = (await json(
    "packages/obby-evaluator-contracts/fixtures/generated/e1-metric-catalog.json",
  )) as MetricCatalog;
  const profile = (await json(
    "packages/obby-evaluator-contracts/fixtures/generated/e1-scoring-profile.json",
  )) as ScoringProfile;
  const manifest = (await json(
    "examples/vertical-slice/scene-manifest.json",
  )) as SceneManifest;
  const normal = evaluateRoutePlayability({
    manifest,
    controllerProfile: createDefaultControllerProfile(),
  });
  const modelFailure = evaluateRoutePlayability({
    manifest,
    controllerProfile: profileWith((item) => {
      item.maximumHorizontalGap.value = 0.1;
    }),
  });
  const indeterminate = evaluateRoutePlayability({
    manifest,
    controllerProfile: profileWith((item) => {
      item.supportedSurfaceKinds = ["planar-face"];
    }),
  });
  const candidates = evaluateRoutePlayability({
    manifest,
    controllerProfile: profileWith((item) => {
      item.maximumHorizontalGap.value = 24;
    }),
  });
  const scenarios = new Map<string, Scenario>([
    [
      "passing-structural-route",
      { evidence: [...normal.evidence], findings: [...normal.findings] },
    ],
    [
      "model-relative-transition-failure",
      {
        evidence: [...modelFailure.evidence],
        findings: [...modelFailure.findings],
      },
    ],
    [
      "indeterminate-route",
      {
        evidence: [...indeterminate.evidence],
        findings: [...indeterminate.findings],
      },
    ],
    [
      "invariant-failure",
      {
        evidence: invalidFinish(normal.evidence),
        findings: [...normal.findings],
      },
    ],
    [
      "candidate-only-issues",
      {
        evidence: [...candidates.evidence],
        findings: [...candidates.findings],
      },
    ],
    [
      "missing-runtime-evidence",
      { evidence: [...normal.evidence], findings: [...normal.findings] },
    ],
  ]);
  const outputs: Record<string, string> = {};
  const availabilityRecords = [
    availability(manifest.manifestHash as `sha256:${string}`),
  ];
  for (const [name, scenario] of scenarios) {
    const { plan, request } = planAndRequest(
      manifest.manifestHash,
      definitions,
      catalog,
      profile,
    );
    const evidenceBundle = {
      schemaVersion: "0.1",
      manifestHash: manifest.manifestHash,
      evidence: scenario.evidence,
      findings: scenario.findings,
    };
    const result = assembleE1Evaluation({
      metricDefinitions: definitions,
      catalog,
      profile,
      plan,
      request,
      evaluatorVersion: "0.1.0",
      componentVersions: {
        "obby-evaluator-contracts": "0.1.0",
        "geometry-evaluator": "0.1.0",
        "route-playability-evaluator": "0.1.0",
        "scoring-engine": "0.1.0",
      },
      evidence: scenario.evidence,
      findings: scenario.findings,
      availabilityRecords,
    });
    const rendered = renderMarkdownReport(result.report);
    const root = `packages/scoring-engine/fixtures/generated/${name}`;
    outputs[`${root}/plan.json`] = canonical(plan);
    outputs[`${root}/request.json`] = canonical(request);
    outputs[`${root}/evidence-bundle.json`] = canonical(evidenceBundle);
    outputs[`${root}/availability-records.json`] =
      canonical(availabilityRecords);
    outputs[`${root}/calculation-bundle.json`] = canonical(
      result.calculationBundle,
    );
    outputs[`${root}/report.json`] = canonical(result.report);
    outputs[`${root}/report.md`] = new TextDecoder().decode(rendered.bytes);
    const { bytes: _bytes, ...renderIdentity } = rendered;
    void _bytes;
    outputs[`${root}/render-identity.json`] = canonical(renderIdentity);
  }
  const { plan, request } = planAndRequest(
    manifest.manifestHash,
    definitions,
    catalog,
    profile,
  );
  const base = assembleE1Evaluation({
    metricDefinitions: definitions,
    catalog,
    profile,
    plan,
    request,
    evaluatorVersion: "0.1.0",
    componentVersions: {
      "obby-evaluator-contracts": "0.1.0",
      "geometry-evaluator": "0.1.0",
      "route-playability-evaluator": "0.1.0",
      "scoring-engine": "0.1.0",
    },
    evidence: normal.evidence,
    findings: normal.findings,
    availabilityRecords,
  });
  const first = structuredClone(base.calculations[0]);
  if (first === undefined) throw new Error("E1c fixture has no calculation");
  const stale = structuredClone(first);
  stale.result.value = { kind: "boolean", value: false };
  const unresolved = structuredClone(first);
  const unresolvedEvidence = unresolved.evidence[0];
  if (unresolvedEvidence === undefined) {
    throw new Error("E1c fixture calculation has no evidence");
  }
  unresolvedEvidence.evidenceContentHash = `sha256:${"f".repeat(64)}`;
  unresolved.reproduction.inputEvidenceHashes = unresolved.evidence.map(
    (item) => item.evidenceContentHash,
  );
  unresolved.calculationHash = hashMetricCalculation(unresolved).hash;
  const conflict = structuredClone(first);
  conflict.result.value = { kind: "boolean", value: false };
  conflict.calculationHash = hashMetricCalculation(conflict).hash;
  outputs[
    "packages/scoring-engine/fixtures/generated/invalid/stale-calculation.json"
  ] = canonical(stale);
  outputs[
    "packages/scoring-engine/fixtures/generated/invalid/unresolved-evidence.json"
  ] = canonical(unresolved);
  outputs[
    "packages/scoring-engine/fixtures/generated/invalid/duplicate-calculations.json"
  ] = canonical([first, first]);
  outputs[
    "packages/scoring-engine/fixtures/generated/invalid/conflicting-calculations.json"
  ] = canonical([first, conflict]);
  return outputs;
}

import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  canonicalStringify,
  evaluatorCanonicalStringify,
} from "@obby/canonical-json";
import { validatePlaceSpec, validateSceneManifest } from "@obby/contracts";
import { normalizeGeometryObject } from "@obby/geometry-evaluator";
import { compilePlaceSpec } from "@obby/obby-compiler";
import { parseGeometryObjectInput } from "@obby/obby-evaluator-contracts";
import {
  createDefaultControllerProfile,
  evaluateRoutePlayability,
} from "@obby/route-playability-evaluator";
import { emitManifestModule } from "@obby/roblox-emitter";
import {
  assembleE1Evaluation,
  renderMarkdownReport,
} from "@obby/scoring-engine";
import { runEvaluatorCli } from "@obby/evaluator-cli";
import {
  DEFAULT_GENERATOR_CONFIGURATION,
  DEFAULT_MECHANIC_CATALOG,
  assertValidGenerationBundle,
  assertValidNormalizedGenerationRequest,
  estimateGenerationWorkUnits,
  generateObby,
  hashGeneratorPreimage,
} from "@obby/obby-generator";
import { runGeneratorCli } from "@obby/generator-cli";
import { hashLayoutConfiguration } from "@obby/obby-layout-contracts";
import {
  DEFAULT_LAYOUT_CONFIGURATION,
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS,
  generateLayout,
} from "@obby/obby-layout-engine";

const spec = JSON.parse(
  await readFile(
    new URL("../examples/vertical-slice/place-spec.json", import.meta.url),
    "utf8",
  ),
);
if (!validatePlaceSpec(spec).ok)
  throw new Error("built contracts rejected fixture");

const manifest = compilePlaceSpec(spec);
if (!validateSceneManifest(manifest).ok)
  throw new Error("built contracts rejected compiled manifest");
if (!canonicalStringify(manifest).includes('"navigation"'))
  throw new Error("built canonical-json omitted navigation");
if (!emitManifestModule(manifest).startsWith("-- This file is generated"))
  throw new Error("built Roblox emitter returned invalid output");
const geometryInput = {
  schemaVersion: "0.1",
  objectId: "smoke-platform",
  shape: "Block",
  authority: "native-gameplay",
  collision: { canCollide: true, canTouch: true, canQuery: true },
  gameplayOwnership: "native-part",
  promotionStatus: "not-applicable",
  transform: {
    position: { x: 0, y: 1, z: 0 },
    rotationDegrees: { x: 0, y: 0, z: 0 },
  },
  size: { x: 8, y: 2, z: 8 },
};
parseGeometryObjectInput(geometryInput);
if (normalizeGeometryObject(geometryInput).topSurface.maximumY !== 2)
  throw new Error("built geometry evaluator returned invalid bounds");
const routeResult = evaluateRoutePlayability({
  manifest,
  controllerProfile: createDefaultControllerProfile(),
});
if (routeResult.routeGraph.finishObjectId !== "FinishPlatform")
  throw new Error("built route evaluator returned invalid topology");
if (
  typeof assembleE1Evaluation !== "function" ||
  typeof renderMarkdownReport !== "function"
)
  throw new Error("built scoring engine exports are unavailable");
if (typeof runEvaluatorCli !== "function")
  throw new Error("built evaluator CLI library export is unavailable");
const builtRequest = {
  schemaVersion: "0.1",
  requestId: "built-smoke",
  workingName: "Built Smoke",
  genre: "obby",
  stageCount: 5,
  checkpointFrequency: 3,
  seed: 1,
};
const generated = generateObby(builtRequest);
if (generated.obbySpec.stages.length !== 5)
  throw new Error("built generator returned an invalid stage plan");
const expectGeneratorFailure = (label, action) => {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(`built generator accepted ${label}`);
};
const expectGeneratorCode = (label, code, action) => {
  try {
    action();
  } catch (error) {
    if (error?.code === code) return;
    throw new Error(`built generator returned the wrong code for ${label}`);
  }
  throw new Error(`built generator accepted ${label}`);
};
expectGeneratorFailure("missing full-validation context", () =>
  assertValidGenerationBundle(generated),
);
const unknownWithoutContext = structuredClone(generated);
unknownWithoutContext.obbySpec.mechanicIntents[0].mechanicId =
  "unknown-mechanic";
expectGeneratorFailure("unknown mechanic without authority context", () =>
  assertValidGenerationBundle(unknownWithoutContext),
);
const invalidNormalized = structuredClone(generated.normalizedRequest);
invalidNormalized.workingName = "";
invalidNormalized.normalizedRequestHash = hashGeneratorPreimage(
  invalidNormalized,
  "normalizedRequestHash",
);
expectGeneratorFailure("fresh-hash invalid normalized semantics", () =>
  assertValidNormalizedGenerationRequest(
    invalidNormalized,
    DEFAULT_MECHANIC_CATALOG,
  ),
);
const graphCases = [
  [
    "unknown mechanic",
    (bundle) => {
      bundle.obbySpec.mechanicIntents[0].mechanicId = "unknown-mechanic";
      bundle.obbySpec.mechanicIntents[0].mechanicIntentHash =
        hashGeneratorPreimage(
          bundle.obbySpec.mechanicIntents[0],
          "mechanicIntentHash",
        );
    },
  ],
  [
    "stage without mechanic",
    (bundle) => {
      bundle.obbySpec.stages[0].mechanicIntentIds = [];
      bundle.obbySpec.stages[0].stageHash = hashGeneratorPreimage(
        bundle.obbySpec.stages[0],
        "stageHash",
      );
    },
  ],
  [
    "checkpoint node without specification",
    (bundle) => {
      bundle.obbySpec.checkpoints = [];
    },
  ],
  [
    "external asset under native policy",
    (bundle) => {
      bundle.obbySpec.assetIntents[0].preferredSourcePolicy =
        "external-assets-allowed-later";
      bundle.obbySpec.assetIntents[0].assetIntentHash = hashGeneratorPreimage(
        bundle.obbySpec.assetIntents[0],
        "assetIntentHash",
      );
    },
  ],
  [
    "incompatible hazard",
    (bundle) => {
      const hazard = bundle.obbySpec.hazards[0];
      if (hazard === undefined) throw new Error("built smoke hazard missing");
      hazard.kind = "moving-obstacle-intent";
      hazard.hazardHash = hashGeneratorPreimage(hazard, "hazardHash");
    },
  ],
];
for (const [label, mutate] of graphCases) {
  const invalid = structuredClone(generated);
  mutate(invalid);
  invalid.obbySpec.obbySpecHash = hashGeneratorPreimage(
    invalid.obbySpec,
    "obbySpecHash",
  );
  invalid.generationBundleHash = hashGeneratorPreimage(
    invalid,
    "generationBundleHash",
  );
  expectGeneratorFailure(label, () =>
    assertValidGenerationBundle(
      invalid,
      DEFAULT_MECHANIC_CATALOG,
      DEFAULT_GENERATOR_CONFIGURATION,
    ),
  );
}
if (typeof runGeneratorCli !== "function")
  throw new Error("built generator CLI library export is unavailable");
if (typeof hashLayoutConfiguration !== "function")
  throw new Error("built G1a layout contracts export is unavailable");
const builtLayout = generateLayout(generated);
if (
  !builtLayout.layoutBundleHash.startsWith("sha256:") ||
  builtLayout.layoutSpec.stages.length !== 5 ||
  DEFAULT_LAYOUT_CONFIGURATION.limits.maxStages !== 50 ||
  DEFAULT_MECHANIC_LAYOUT_DEFINITIONS.length !== 9
)
  throw new Error("built G1b layout engine returned an invalid bundle");

const withWorkBudget = (maximum) => {
  const preimage = {
    ...DEFAULT_GENERATOR_CONFIGURATION,
    limits: {
      ...DEFAULT_GENERATOR_CONFIGURATION.limits,
      maxWorkUnits: maximum,
    },
  };
  return {
    ...preimage,
    configurationHash: hashGeneratorPreimage(preimage, "configurationHash"),
  };
};
const workN = estimateGenerationWorkUnits(
  builtRequest.stageCount,
  DEFAULT_MECHANIC_CATALOG.mechanics.length,
);
const exactBudgetBundle = generateObby(builtRequest, withWorkBudget(workN));
const extraBudgetBundle = generateObby(builtRequest, withWorkBudget(workN + 1));
if (
  evaluatorCanonicalStringify(exactBudgetBundle) !==
  evaluatorCanonicalStringify(extraBudgetBundle)
)
  throw new Error("built generator made execution budget semantic");

for (const callbackSeam of ["onWorkAdmitted", "input-snapshot"]) {
  const callbackRequest = structuredClone(builtRequest);
  const callbackConfiguration = structuredClone(withWorkBudget(workN));
  const callbackCatalog = structuredClone(DEFAULT_MECHANIC_CATALOG);
  const control = generateObby(
    structuredClone(callbackRequest),
    structuredClone(callbackConfiguration),
    structuredClone(callbackCatalog),
  );
  let callbackAdmission;
  let callbackPhases;
  const mutateCallerInputs = () => {
    callbackRequest.stageCount = 50;
    callbackRequest.difficulty = "hard";
    callbackRequest.checkpointFrequency = 2;
    callbackRequest.assetPolicy = "approved-local-assets";
    callbackRequest.seed = 999;
    callbackConfiguration.limits.maxWorkUnits = 1;
    callbackCatalog.mechanics[0].label = "mutated caller mechanic";
    callbackCatalog.mechanics.push(
      structuredClone(callbackCatalog.mechanics[0]),
    );
  };
  const callbackOutput = generateObby(
    callbackRequest,
    callbackConfiguration,
    callbackCatalog,
    {
      onWorkAdmitted: (admission) => {
        callbackAdmission = admission;
        if (callbackSeam === "onWorkAdmitted") mutateCallerInputs();
      },
      onCoveredOperation: (operation) => {
        if (callbackSeam === "input-snapshot" && operation === "input-snapshot")
          mutateCallerInputs();
      },
      onPhaseTrace: (phases) => {
        callbackPhases = phases;
      },
    },
  );
  if (
    !Object.isFrozen(callbackAdmission) ||
    callbackAdmission.requiredWorkUnits !== workN ||
    callbackOutput.obbySpec.stages.length !== builtRequest.stageCount ||
    evaluatorCanonicalStringify(callbackOutput) !==
      evaluatorCanonicalStringify(control)
  )
    throw new Error(`built generator retained ${callbackSeam} caller input`);
  if (
    callbackPhases?.join(",") !==
    "safe-shape-check,snapshot-complete,work-admission,callbacks,semantic-validation,normalization,generation"
  )
    throw new Error(`built generator misordered ${callbackSeam}`);
}
expectGeneratorCode("throwing callback", "callback-failed", () =>
  generateObby(builtRequest, undefined, undefined, {
    onWorkAdmitted: () => {
      throw new Error("private callback detail");
    },
  }),
);

const underfundedConfiguration = withWorkBudget(workN - 1);
const accessorCases = [];
const accessorCase = (label, target, key, value, placement) => {
  let calls = 0;
  Object.defineProperty(target, key, {
    enumerable: true,
    get: () => {
      calls += 1;
      hashGeneratorPreimage(builtRequest);
      return value;
    },
  });
  accessorCases.push({ label, target, placement, calls: () => calls });
};
accessorCase(
  "request.stageCount",
  { ...builtRequest },
  "stageCount",
  builtRequest.stageCount,
  "request",
);
accessorCase(
  "configuration.limits",
  { ...underfundedConfiguration },
  "limits",
  underfundedConfiguration.limits,
  "configuration",
);
const accessorLimits = { ...underfundedConfiguration.limits };
accessorCase(
  "limits.maxWorkUnits",
  accessorLimits,
  "maxWorkUnits",
  workN - 1,
  "limits",
);
accessorCase(
  "catalog.mechanics",
  { ...DEFAULT_MECHANIC_CATALOG },
  "mechanics",
  DEFAULT_MECHANIC_CATALOG.mechanics,
  "catalog",
);
for (const testCase of accessorCases) {
  const configuration =
    testCase.placement === "configuration"
      ? testCase.target
      : testCase.placement === "limits"
        ? { ...underfundedConfiguration, limits: testCase.target }
        : underfundedConfiguration;
  expectGeneratorCode(testCase.label, "validation", () =>
    generateObby(
      testCase.placement === "request" ? testCase.target : builtRequest,
      configuration,
      testCase.placement === "catalog"
        ? testCase.target
        : DEFAULT_MECHANIC_CATALOG,
    ),
  );
  if (testCase.calls() !== 0)
    throw new Error(`built generator invoked ${testCase.label}`);
}

let inheritedCalls = 0;
const inheritedPrototype = Object.create(null);
Object.defineProperty(inheritedPrototype, "stageCount", {
  get: () => {
    inheritedCalls += 1;
    return builtRequest.stageCount;
  },
});
const inheritedRequest = Object.create(inheritedPrototype);
const inheritedDescriptors = Object.getOwnPropertyDescriptors(builtRequest);
Reflect.deleteProperty(inheritedDescriptors, "stageCount");
Object.defineProperties(inheritedRequest, inheritedDescriptors);
expectGeneratorCode("inherited stageCount", "validation", () =>
  generateObby(inheritedRequest, underfundedConfiguration),
);
if (inheritedCalls !== 0)
  throw new Error("built generator invoked an inherited accessor");

for (const [label, target, placement] of [
  ["request Proxy", builtRequest, "request"],
  ["catalog Proxy", DEFAULT_MECHANIC_CATALOG, "catalog"],
]) {
  let proxyTraps = 0;
  const proxy = new Proxy(target, {
    get: (object, key, receiver) => {
      proxyTraps += 1;
      return Reflect.get(object, key, receiver);
    },
    getOwnPropertyDescriptor: (object, key) => {
      proxyTraps += 1;
      return Reflect.getOwnPropertyDescriptor(object, key);
    },
    getPrototypeOf: (object) => {
      proxyTraps += 1;
      return Reflect.getPrototypeOf(object);
    },
    ownKeys: (object) => {
      proxyTraps += 1;
      return Reflect.ownKeys(object);
    },
  });
  expectGeneratorCode(label, "validation", () =>
    generateObby(
      placement === "request" ? proxy : builtRequest,
      underfundedConfiguration,
      placement === "catalog" ? proxy : DEFAULT_MECHANIC_CATALOG,
    ),
  );
  if (proxyTraps !== 0)
    throw new Error(`built generator invoked a trap on ${label}`);
}

let arrayAccessorCalls = 0;
const accessorMechanics = [...DEFAULT_MECHANIC_CATALOG.mechanics];
Object.defineProperty(accessorMechanics, "0", {
  enumerable: true,
  get: () => {
    arrayAccessorCalls += 1;
    return DEFAULT_MECHANIC_CATALOG.mechanics[0];
  },
});
const accessorCatalog = {
  ...DEFAULT_MECHANIC_CATALOG,
  mechanics: accessorMechanics,
};
expectGeneratorCode("underfunded accessor array", "validation", () =>
  generateObby(builtRequest, underfundedConfiguration, accessorCatalog),
);
expectGeneratorCode("admitted accessor array", "validation", () =>
  generateObby(builtRequest, withWorkBudget(workN), accessorCatalog),
);
if (arrayAccessorCalls !== 0)
  throw new Error("built generator invoked a mechanics index accessor");

let fakeLengthCalls = 0;
const fakeArray = Object.create(Array.prototype);
Object.defineProperty(fakeArray, "length", {
  get: () => {
    fakeLengthCalls += 1;
    return DEFAULT_MECHANIC_CATALOG.mechanics.length;
  },
});
expectGeneratorCode("array-like length accessor", "validation", () =>
  generateObby(builtRequest, underfundedConfiguration, {
    ...DEFAULT_MECHANIC_CATALOG,
    mechanics: fakeArray,
  }),
);
if (fakeLengthCalls !== 0)
  throw new Error("built generator invoked an array-like length accessor");
if (Object.getOwnPropertyDescriptor([], "length")?.configurable !== false)
  throw new Error("built runtime unexpectedly permits Array length accessors");

class MechanicArray extends Array {}
expectGeneratorCode("array subclass", "validation", () =>
  generateObby(builtRequest, underfundedConfiguration, {
    ...DEFAULT_MECHANIC_CATALOG,
    mechanics: MechanicArray.from(DEFAULT_MECHANIC_CATALOG.mechanics),
  }),
);
for (const coercionKey of ["valueOf", Symbol.toPrimitive]) {
  let coercionCalls = 0;
  expectGeneratorCode("stage-count coercion hook", "validation", () =>
    generateObby(
      {
        ...builtRequest,
        stageCount: {
          [coercionKey]: () => {
            coercionCalls += 1;
            return builtRequest.stageCount;
          },
        },
      },
      underfundedConfiguration,
    ),
  );
  if (coercionCalls !== 0)
    throw new Error("built generator invoked a stage-count coercion hook");
}

const pathExists = async (path) => {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
};
const nullStreams = {
  stdout: { write: () => true },
  stderr: { write: () => true },
};
const publicationRoot = await mkdtemp(join(tmpdir(), "g0-built-smoke-"));
try {
  await writeFile(
    join(publicationRoot, "request.json"),
    JSON.stringify(builtRequest),
  );
  const finalName = `obby-${generated.obbySpec.obbySpecHash.slice(7)}`;
  const finalPath = join(publicationRoot, "out", finalName);
  let observedAbsent = false;
  const exit = await runGeneratorCli(
    ["generate", "--request", "request.json", "--output", "out"],
    nullStreams,
    {
      cwd: publicationRoot,
      onAtomicStep: async (step) => {
        if (step !== "final-commit") return;
        observedAbsent = !(await pathExists(finalPath));
      },
    },
  );
  if (
    exit !== 0 ||
    !observedAbsent ||
    (await readdir(finalPath)).join(",") !== "generation-bundle.json"
  )
    throw new Error("built generator CLI exposed incomplete public output");

  await rm(finalPath, { recursive: true });
  const syscallWindowSentinel = "foreign-syscall-window-owner";
  let conflictStderr = "";
  let foreignIdentity;
  const syscallWindowExit = await runGeneratorCli(
    [
      "generate",
      "--request",
      "request.json",
      "--output",
      "out",
      "--json-errors",
    ],
    {
      stdout: { write: () => true },
      stderr: {
        write: (text) => {
          conflictStderr += text;
        },
      },
    },
    {
      cwd: publicationRoot,
      onAtomicStep: async (step) => {
        if (step !== "before-no-replace-commit") return;
        await mkdir(finalPath);
        await writeFile(join(finalPath, "owner.txt"), syscallWindowSentinel);
        foreignIdentity = await lstat(finalPath);
      },
    },
  );
  const preservedIdentity = await lstat(finalPath);
  if (
    syscallWindowExit !== 1 ||
    JSON.parse(conflictStderr).error.code !== "output-conflict" ||
    preservedIdentity.dev !== foreignIdentity?.dev ||
    preservedIdentity.ino !== foreignIdentity?.ino ||
    preservedIdentity.birthtimeMs !== foreignIdentity?.birthtimeMs ||
    (await readdir(finalPath)).join(",") !== "owner.txt" ||
    (await readFile(join(finalPath, "owner.txt"), "utf8")) !==
      syscallWindowSentinel ||
    (await readdir(join(publicationRoot, "out"))).some(
      (name) => name.endsWith(".tmp") || name.endsWith(".lock"),
    )
  )
    throw new Error("built generator CLI replaced a syscall-window owner");
  await rm(finalPath, { recursive: true });
  const foreignTarget = join(publicationRoot, "foreign-target");
  await mkdir(foreignTarget);
  const replacementExit = await runGeneratorCli(
    [
      "generate",
      "--request",
      "request.json",
      "--output",
      "out",
      "--json-errors",
    ],
    nullStreams,
    {
      cwd: publicationRoot,
      onAtomicStep: async (step) => {
        if (step !== "destination-claim") return;
        const lockName = (await readdir(join(publicationRoot, "out"))).find(
          (name) => name.endsWith(".lock"),
        );
        if (lockName === undefined) throw new Error("built smoke lock missing");
        const lockPath = join(publicationRoot, "out", lockName);
        await rm(lockPath, { recursive: true });
        await symlink(
          foreignTarget,
          lockPath,
          process.platform === "win32" ? "junction" : "dir",
        );
      },
    },
  );
  if (
    replacementExit !== 1 ||
    (await readdir(foreignTarget)).length !== 0 ||
    (await pathExists(finalPath))
  )
    throw new Error("built generator CLI wrote through a replaced lock");
} finally {
  await rm(publicationRoot, { recursive: true, force: true });
}

const compiledReportModule = await import(
  new URL("../packages/scoring-engine/dist/report.js", import.meta.url)
);
if ("finalizeValidatedE1Report" in compiledReportModule)
  throw new Error("built scoring engine exposes unchecked report finalization");
const compiledReportDeclaration = await readFile(
  new URL("../packages/scoring-engine/dist/report.d.ts", import.meta.url),
  "utf8",
);
if (compiledReportDeclaration.includes("finalizeValidatedE1Report"))
  throw new Error(
    "built scoring declaration exposes unchecked report finalization",
  );

console.log("plain Node imported Phase 0, E1, G0, G1a, and G1b packages");

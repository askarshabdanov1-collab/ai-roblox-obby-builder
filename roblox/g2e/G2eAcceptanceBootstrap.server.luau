local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local BuilderV03 = require(ReplicatedStorage.ObbyRuntime.BuilderV03)
local G2eAcceptanceHarness = require(ServerScriptService.G2eAcceptanceHarness)

local manifests = ServerStorage.G2eManifests
local fixtures = table.freeze({
    reference = table.freeze({
        module = manifests.G2ReferenceManifestV03,
        expectedHash = "sha256:8dc98269de8b816f3d91f43aef930a5b5cc002e69a6a44eb5464e9e87a130b9b",
    }),
    ["maximum-50"] = table.freeze({
        module = manifests.G2Maximum50ManifestV03,
        expectedHash = "sha256:4aa20d8ab637e64fe9a86274ac6cb135987b2f169403f1f37d4dfb7b3036a12e",
    }),
    ["minimum-zero-checkpoint"] = table.freeze({
        module = manifests.G2ZeroCheckpointManifestV03,
        expectedHash = "sha256:746bb14aa99ef4149e2b49fbe7ddf0dadc6f4504284fe38179475ee64021dad8",
    }),
    ["replacement-b"] = table.freeze({
        module = manifests.G2ReplacementManifestV03,
        expectedHash = "sha256:9ad8d1f5188d23418b091ff0f90212d39c2a249e89a623e3ceb514de0ec1f58e",
    }),
    wedge = table.freeze({
        module = manifests.G2WedgeManifestV03,
        expectedHash = "sha256:ed6065f9ae384cec965fa362292fadba74a9636f536482dea6ddce9c28a9756a",
    }),
    decorative = table.freeze({
        module = manifests.G2DecorativeManifestV03,
        expectedHash = "sha256:b172d42a1b717b82364ae5715c09a1fd34c6805749907074c357241deca917db",
    }),
})

local environment = table.freeze({
    repositoryCommit = "9a92540aad3183342096501f268eb1f966d640bf",
    studioVersion = "0.732.0.7321040",
    osBuild = "Windows 10 Pro 10.0.19045 build 19045",
})

local builder, builderError = BuilderV03.new()
assert(builder ~= nil, builderError and builderError.message or "BuilderV03 initialization failed")

local api = {
    builder = builder,
    environment = environment,
    fixtures = fixtures,
    measurements = {},
}

local function reportBuildFailure(buildError)
    local code = if type(buildError) == "table" and type(buildError.code) == "string"
        then string.sub(buildError.code, 1, 64)
        else "unknown"
    local field = if type(buildError) == "table" and type(buildError.field) == "string"
        then string.sub(buildError.field, 1, 64)
        else "none"
    warn(string.format("[G2 acceptance diagnostic] code=%s field=%s", code, field))
end

function api:build(fixtureId, runKind, runIndex, options)
    local fixture = fixtures[fixtureId]
    assert(fixture ~= nil, "unknown G2e fixture: " .. tostring(fixtureId))
    local manifest = require(fixture.module)
    local beforeHeap = collectgarbage("count")
    local started = os.clock()
    local result, buildError = builder:build(fixture.module, fixture.expectedHash, options)
    local elapsed = os.clock() - started
    if result == nil then
        reportBuildFailure(buildError)
    end
    assert(result ~= nil, buildError and (buildError.code .. ": " .. buildError.message) or "G2e build failed")
    assert(manifest.manifestHash == fixture.expectedHash, "configured expected hash changed")
    local measurement = G2eAcceptanceHarness.emitMeasurement(
        environment,
        fixtureId,
        manifest,
        runKind or "manual",
        runIndex or 1,
        elapsed,
        result,
        beforeHeap
    )
    table.insert(self.measurements, measurement)
    self.current = result
    self.currentFixtureId = fixtureId
    return result
end

function api:runReferenceReplacementSequence()
    for index = 1, 5 do
        self:build("reference", "repeated", index)
    end
    self:build("replacement-b", "replacement", 1)
    self:build("reference", "replacement", 2)
    G2eAcceptanceHarness.assertSingleActiveRoot()
    print("[G2 acceptance] reference replacement sequence PASS")
end

function api:runMaximumSequence()
    self:build("maximum-50", "cold", 1)
    for index = 1, 5 do
        self:build("maximum-50", "repeated", index)
    end
    print("[G2 acceptance] maximum-50 sequence PASS")
end

function api:runFailureBoundary(boundary)
    local previous = self.current and self.current.root or G2eAcceptanceHarness.assertSingleActiveRoot()
    local result, buildError = builder:build(fixtures["replacement-b"].module, fixtures["replacement-b"].expectedHash, {
        failAt = if boundary == "before-commit" then boundary else nil,
        commitOptions = if boundary == "before-commit" then nil else { failAt = boundary },
    })
    assert(result == nil and buildError ~= nil, boundary .. " failure was not surfaced")
    assert(builder:currentSession().candidate.root == previous, boundary .. " changed the active session")
    assert(G2eAcceptanceHarness.assertSingleActiveRoot() == previous, boundary .. " changed the active root")
    print("[G2 acceptance] failure boundary PASS", boundary, buildError.code)
end

G2eAcceptanceHarness.bindControl(api)
api:build("reference", "cold", 1)
workspace:SetAttribute("G2eAcceptanceReady", true)
print("[G2 acceptance] Reference ready; use ServerStorage.G2eControl from the server Command Bar")

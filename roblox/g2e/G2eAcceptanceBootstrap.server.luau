local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local ServerScriptService = game:GetService("ServerScriptService")
local Players = game:GetService("Players")

local BuilderV03 = require(ReplicatedStorage.ObbyRuntime.BuilderV03)
local G2eAcceptanceHarness = require(ServerScriptService.G2eAcceptanceHarness)

local manifests = ServerStorage.G2eManifests
local fixtures = table.freeze({
    reference = table.freeze({
        module = manifests.G2ReferenceManifestV03,
        expectedHash = "sha256:606e679659ba1461ba1baaa87f1f10bf7953dfc071da40ebaa6d39c2caa62146",
        hazardObjectId = "Stage04Hazard001",
    }),
    ["maximum-50"] = table.freeze({
        module = manifests.G2Maximum50ManifestV03,
        expectedHash = "sha256:508ca29e776560a4a8919323555f481837687ae3504137b34574698245daad82",
    }),
    ["minimum-zero-checkpoint"] = table.freeze({
        module = manifests.G2ZeroCheckpointManifestV03,
        expectedHash = "sha256:3aa06678bdf7d7d30e6eb15b1b11745659d041e4a4c983cac16d1f7bb87cc717",
    }),
    ["replacement-b"] = table.freeze({
        module = manifests.G2ReplacementManifestV03,
        expectedHash = "sha256:2a14a42cf7d9dfaea45a1f01e0a4624581aa484b6b7472af7471e24cc3475e0e",
    }),
    wedge = table.freeze({
        module = manifests.G2WedgeManifestV03,
        expectedHash = "sha256:622588a04e957269e79319c0f6c94bcc2cf13088fd8a1b61d94580e572f645ee",
    }),
    decorative = table.freeze({
        module = manifests.G2DecorativeManifestV03,
        expectedHash = "sha256:6b40484c8e8ba1de1460b1ddea72d9b676b63144df02ca6fbd45609304f0260f",
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
    replacementCount = 0,
    staleCallbackRejections = 0,
    staleAcceptedActions = 0,
}

local function boundedText(value, fallback, maximum)
    if type(value) ~= "string" or value == "" then
        return fallback
    end
    return string.sub(value, 1, maximum)
end

local function reportBuildFailure(buildError)
    local value = if type(buildError) == "table" then buildError else {}
    local code = boundedText(value.code, "acceptance-build-error-shape", 80)
    local field = boundedText(value.field, "none", 80)
    local message = boundedText(value.message, "none", 160)
    local diagnostic = G2eAcceptanceHarness.formatTypedDiagnostic(code, field, message)
    warn("[G2 acceptance diagnostic] " .. diagnostic)
    return diagnostic
end

function api:build(fixtureId, runKind, runIndex, options)
    local replacing = self.current ~= nil
    local previous = self.current
    local previousFixtureId = self.currentFixtureId
    local fixture = fixtures[fixtureId]
    assert(fixture ~= nil, "unknown G2e fixture: " .. tostring(fixtureId))
    local manifest = require(fixture.module)
    local beforeHeap = collectgarbage("count")
    local started = os.clock()
    local result, buildError = builder:build(fixture.module, fixture.expectedHash, options)
    local elapsed = os.clock() - started
    local buildDiagnostic = "code=unknown field=none message=none"
    if result == nil then
        buildDiagnostic = reportBuildFailure(buildError)
    end
    assert(result ~= nil, buildDiagnostic)
    assert(manifest.manifestHash == fixture.expectedHash, "configured expected hash changed")
    local measurement, observation = G2eAcceptanceHarness.emitMeasurement(
        environment,
        fixtureId,
        manifest,
        runKind or "manual",
        runIndex or 1,
        elapsed,
        result,
        beforeHeap
    )
    local observationPassed, observationDiagnostic = G2eAcceptanceHarness.formatObservationResult(observation)
    assert(observationPassed, observationDiagnostic)
    table.insert(self.measurements, measurement)
    self.current = result
    self.currentFixtureId = fixtureId
    if replacing then
        self.replacementCount += 1
        self.previous = previous
        self.previousFixtureId = previousFixtureId
    end
    return result
end

local function hazardRecord(result, configuredObjectId)
    for _, record in ipairs(result.session.candidate.plan.gameplayRecords) do
        if record.role == "kill" and (configuredObjectId == nil or record.id == configuredObjectId) then
            return record
        end
    end
    return nil
end

function api:inspectHazard(objectId)
    assert(self.current ~= nil, "a G2e fixture must be active")
    local fixture = fixtures[self.currentFixtureId]
    assert(fixture ~= nil, "active G2e fixture identity changed")
    local selectedObjectId = objectId or fixture.hazardObjectId
    assert(selectedObjectId ~= nil, "active G2e fixture has no configured hazard trace")
    return G2eAcceptanceHarness.emitHazardTrace(
        self.currentFixtureId,
        require(fixture.module),
        self.current,
        selectedObjectId
    )
end

function api:verifyStaleHazardCallback()
    assert(self.previous ~= nil and self.current ~= nil, "a successful G2e replacement is required")
    local currentFixture = fixtures[self.currentFixtureId]
    local configuredObjectId = currentFixture and currentFixture.hazardObjectId or nil
    local record = hazardRecord(self.previous, configuredObjectId) or hazardRecord(self.previous, nil)
    assert(record ~= nil, "previous G2e session has no hazard record")
    local part = self.previous.session.candidate.partById[record.id]
    assert(part ~= nil, "previous G2e hazard Part is unavailable")
    local players = Players:GetPlayers()
    local player = players[1]
    local character = player and player.Character or nil
    local hit = character
        and (character:FindFirstChild("HumanoidRootPart") or character:FindFirstChildWhichIsA("BasePart"))
    assert(hit ~= nil, "an active player character Part is required for stale-callback verification")
    local before = self.previous.session:acceptanceSnapshot()
    local accepted = self.previous.session:_handleTouch(part, record, hit)
    local after = self.previous.session:acceptanceSnapshot()
    local rejectionDelta = after.staleCallbackRejections - before.staleCallbackRejections
    local lethalDelta = after.lethalActions - before.lethalActions
    assert(accepted == false and rejectionDelta == 1 and lethalDelta == 0, "stale hazard callback was not rejected")
    self.staleCallbackRejections += rejectionDelta
    self.staleAcceptedActions += lethalDelta
    print("[G2 acceptance] stale hazard callback rejection PASS", record.id)
    return table.freeze({
        status = "PASS",
        objectId = record.id,
        staleCallbackRejections = rejectionDelta,
        staleAcceptedActions = lethalDelta,
    })
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

function api:observeGameplay()
    assert(self.current ~= nil, "a G2e fixture must be active")
    local fixture = fixtures[self.currentFixtureId]
    assert(fixture ~= nil, "active G2e fixture identity changed")
    self:inspectHazard(fixture.hazardObjectId)
    return G2eAcceptanceHarness.emitGameplayObservation(
        self.currentFixtureId,
        require(fixture.module),
        self.current.session,
        self.replacementCount,
        {
            staleCallbackRejections = self.staleCallbackRejections,
            staleAcceptedActions = self.staleAcceptedActions,
        }
    )
end

G2eAcceptanceHarness.bindControl(api)
api:build("reference", "cold", 1)
workspace:SetAttribute("G2eAcceptanceReady", true)
print("[G2 acceptance] Reference ready; use ServerStorage.G2eControl from the server Command Bar")

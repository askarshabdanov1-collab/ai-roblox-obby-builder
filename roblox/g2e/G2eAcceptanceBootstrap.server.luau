local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local ServerScriptService = game:GetService("ServerScriptService")
local Players = game:GetService("Players")

local runtimeConfiguration = ServerStorage.RuntimeConfiguration
local RuntimeSelector = require(ReplicatedStorage.ObbyRuntime.RuntimeSelector)
local selection, selectionError =
    RuntimeSelector.resolve(runtimeConfiguration.Version.Value, runtimeConfiguration.ExecutionMode.Value)
assert(selection ~= nil, selectionError)
assert(selection.executionMode == "studio-acceptance", "G2e controls require Studio acceptance mode")

local BuilderV03 = require(ReplicatedStorage.ObbyRuntime.BuilderV03)
local G2eAcceptanceHarness = require(ServerScriptService.G2eAcceptanceHarness)
local G2eCharacterPartReadinessV1 = require(ServerScriptService.G2eCharacterPartReadinessV1)
local G2eControlProtocol = require(ServerScriptService.G2eControlProtocol)
local G2eBuildProvenance = require(ServerStorage.G2eBuildProvenance)

assert(G2eBuildProvenance.schemaVersion == "g2e-build-provenance-v1", "G2e provenance schema changed")
assert(
    type(G2eBuildProvenance.repositoryCommit) == "string"
        and #G2eBuildProvenance.repositoryCommit == 40
        and string.match(G2eBuildProvenance.repositoryCommit, "^[0-9a-f]+$") ~= nil,
    "G2e repository commit provenance is invalid"
)

local defaultManifests = ServerStorage.GeneratedManifests
local manifests = ServerStorage.G2eManifests
local fixtures = table.freeze({
    reference = table.freeze({
        module = defaultManifests.G2ReferenceManifestV03,
        expectedHash = runtimeConfiguration.ExpectedManifestHash.Value,
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
    repositoryCommit = G2eBuildProvenance.repositoryCommit,
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
    protocol = G2eControlProtocol.newState(),
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

local function heapMeasurement()
    local ok, value = pcall(collectgarbage, "count")
    if ok and type(value) == "number" then
        return value, "available"
    end
    return 0, "unavailable"
end

function api:build(fixtureId, runKind, runIndex, options)
    local replacing = self.current ~= nil
    local previous = self.current
    local previousFixtureId = self.currentFixtureId
    local fixture = fixtures[fixtureId]
    assert(fixture ~= nil, "unknown G2e fixture: " .. tostring(fixtureId))
    local manifest = require(fixture.module)
    local beforeHeap, beforeHeapStatus = heapMeasurement()
    local started = os.clock()
    local result, buildError = builder:build(fixture.module, fixture.expectedHash, options)
    local finished = os.clock()
    local afterHeap, afterHeapStatus = heapMeasurement()
    local heapStatus = if beforeHeapStatus == "available" and afterHeapStatus == "available"
        then "available"
        else "unavailable"
    local buildDiagnostic = "code=unknown field=none message=none"
    if result == nil then
        buildDiagnostic = reportBuildFailure(buildError)
    end
    assert(result ~= nil, buildDiagnostic)
    assert(manifest.manifestHash == fixture.expectedHash, "configured expected hash changed")
    G2eAcceptanceHarness.attachPlacementCapture(result.session)
    local measurement, observation = G2eAcceptanceHarness.emitMeasurement(
        environment,
        fixtureId,
        manifest,
        runKind or "manual",
        runIndex or 1,
        started,
        finished,
        result,
        beforeHeap,
        afterHeap,
        heapStatus,
        builder
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

function api:manualBuild(fixtureId)
    local run = self.protocol:nextManual(fixtureId)
    self:build(run.fixtureId, run.runKind, run.runIndex)
    return run
end

local function claimCold(apiValue, fixtureId)
    local run, failure = apiValue.protocol:claimCold(fixtureId)
    assert(run ~= nil, failure and failure.diagnosticMessage or "cold sequence requires a fresh server")
end

local function hazardRecord(result, configuredObjectId)
    for _, record in ipairs(result.session.candidate.plan.gameplayRecords) do
        if record.role == "kill" and (configuredObjectId == nil or record.id == configuredObjectId) then
            return record
        end
    end
    return nil
end

local function readinessPlayers()
    return Players:GetPlayers()
end

local function readinessPlayerKey(player)
    return player.UserId
end

local function readinessBasePart(character)
    return character:FindFirstChildWhichIsA("BasePart")
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
    local readiness, readinessFailure =
        G2eCharacterPartReadinessV1.awaitAny(readinessPlayers, readinessPlayerKey, readinessBasePart, task.wait)
    if readiness == nil then
        return nil, readinessFailure
    end
    local hit = readiness.hit
    local before = self.previous.session:acceptanceSnapshot()
    local accepted = self.previous.session:_handleTouch(part, record, hit)
    local after = self.previous.session:acceptanceSnapshot()
    local rejectionDelta = after.staleCallbackRejections - before.staleCallbackRejections
    local lethalDelta = after.lethalActions - before.lethalActions
    assert(accepted == false and rejectionDelta == 1 and lethalDelta == 0, "stale hazard callback was not rejected")
    self.staleCallbackRejections += rejectionDelta
    self.staleAcceptedActions += lethalDelta
    print(
        "[G2 acceptance] stale hazard callback rejection PASS",
        record.id,
        "selectedSlot=" .. tostring(readiness.selectedSlot),
        "characterWaitIterations=" .. tostring(readiness.waitIterations)
    )
    return table.freeze({
        status = "PASS",
        objectId = record.id,
        staleCallbackRejections = rejectionDelta,
        staleAcceptedActions = lethalDelta,
        characterWaitIterations = readiness.waitIterations,
    }),
        nil
end

function api:checkPlayerCharacterReadiness()
    local readiness, readinessFailure =
        G2eCharacterPartReadinessV1.requireAll(readinessPlayers, readinessPlayerKey, readinessBasePart, 2)
    if readiness == nil then
        return nil, readinessFailure
    end
    print(
        "[G2 acceptance] player character readiness PASS",
        "players=" .. tostring(readiness.playerCount),
        "characters=" .. tostring(readiness.characterCount),
        "baseParts=" .. tostring(readiness.basePartCount)
    )
    return readiness, nil
end

function api:runReferenceColdAndReplacementSequence()
    claimCold(self, "reference")
    local runs = G2eControlProtocol.referenceSequence()
    for _, run in ipairs(runs) do
        self:build(run.fixtureId, run.runKind, run.runIndex)
    end
    G2eAcceptanceHarness.assertSingleActiveRoot()
    print("[G2 acceptance] reference replacement sequence PASS")
    return #runs
end

function api:runMaximumColdAndRepeatedSequence()
    claimCold(self, "maximum-50")
    local runs = G2eControlProtocol.maximumSequence()
    for _, run in ipairs(runs) do
        self:build(run.fixtureId, run.runKind, run.runIndex)
    end
    print("[G2 acceptance] maximum-50 sequence PASS")
    return #runs
end

function api:runZeroCheckpointColdSequence()
    claimCold(self, "minimum-zero-checkpoint")
    local runs = G2eControlProtocol.zeroCheckpointSequence()
    for _, run in ipairs(runs) do
        self:build(run.fixtureId, run.runKind, run.runIndex)
    end
    print("[G2 acceptance] minimum-zero-checkpoint sequence PASS")
    return #runs
end

function api:runFailureBoundarySequence(boundary)
    assert(
        boundary == "before-commit"
            or boundary == "after-retire"
            or boundary == "after-publish"
            or boundary == "before-pointer",
        "unknown failure boundary"
    )
    claimCold(self, "reference")
    self:build("reference", "cold", 1)
    local previous = self.current.root
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

local function awaitCurrentPlacementCaptures(apiValue)
    local players = Players:GetPlayers()
    local captureWaitIterations = 0
    while
        captureWaitIterations < 120
        and not G2eAcceptanceHarness.placementCapturesReady(apiValue.current.session, players)
    do
        captureWaitIterations += 1
        task.wait()
    end
    return captureWaitIterations
end

function api:observePlayerPlacement(phase)
    assert(self.current ~= nil, "a G2e fixture must be active")
    local fixture = fixtures[self.currentFixtureId]
    local captureWaitIterations = awaitCurrentPlacementCaptures(self)
    local receipt = G2eAcceptanceHarness.emitPlacementObservation(
        environment.repositoryCommit,
        self.currentFixtureId,
        require(fixture.module),
        self.current.session,
        phase,
        captureWaitIterations
    )
    assert(receipt.status == "PASS", receipt.firstFailingField)
    return receipt
end

function api:observeFinishIsolation(phase)
    assert(self.current ~= nil and self.currentFixtureId == "reference", "reference fixture must be active")
    local receipt = G2eAcceptanceHarness.emitFinishObservation(
        environment.repositoryCommit,
        self.currentFixtureId,
        require(fixtures.reference.module),
        self.current.session,
        phase
    )
    assert(receipt.status == "PASS", receipt.firstFailingField)
    return receipt
end

local function gameplayRecordByRole(result, role)
    for _, record in ipairs(result.session.candidate.plan.gameplayRecords) do
        if record.role == role then
            return record
        end
    end
    return nil
end

local function playerHit(player)
    local character = player and player.Character or nil
    local hit = character
        and (character:FindFirstChild("HumanoidRootPart") or character:FindFirstChildWhichIsA("BasePart"))
    assert(hit ~= nil, "active player character Part is required")
    return hit, character
end

function api:runProgressAndStaleCallbackSequence()
    assert(self.current ~= nil and self.currentFixtureId == "reference", "reference fixture must be active")
    local players = Players:GetPlayers()
    assert(#players == 2, "progress sequence requires exactly two players")
    local oldResult = self.current
    local oldSession = oldResult.session
    local checkpointOrder = oldSession:checkpointOrder(players[1])
    assert(checkpointOrder ~= nil, "player A checkpoint progress is required")
    assert(oldSession:finished(players[1]) and oldSession:finished(players[2]), "both finish states are required")

    local sameResult = self:build("reference", "functional", 1)
    local sameHashCheckpointPreserved = sameResult.session:checkpointOrder(players[1]) == checkpointOrder
    local sameHashFinishPreserved = sameResult.session:finished(players[1]) and sameResult.session:finished(players[2])

    local differentResult = self:build("replacement-b", "functional", 2)
    local differentHashCheckpointCleared = differentResult.session:checkpointOrder(players[1]) == nil
        and differentResult.session:checkpointOrder(players[2]) == nil
    local differentHashFinishCleared = not differentResult.session:finished(players[1])
        and not differentResult.session:finished(players[2])

    local hit, character = playerHit(players[1])
    local placed, placementError = oldSession:placeCharacter(players[1], character)
    local staleCharacterPlacementRejected = placed == nil
        and placementError ~= nil
        and placementError.code == "session-stale"

    local checkpointRecord = gameplayRecordByRole(oldResult, "checkpoint")
    local killRecord = gameplayRecordByRole(oldResult, "kill")
    local finishRecord = gameplayRecordByRole(oldResult, "finish")
    assert(
        checkpointRecord ~= nil and killRecord ~= nil and finishRecord ~= nil,
        "stale callback records are incomplete"
    )
    local checkpointAccepted =
        oldSession:_handleTouch(oldResult.session.candidate.partById[checkpointRecord.id], checkpointRecord, hit)
    local staleCheckpointRejected = checkpointAccepted == false
        and differentResult.session:checkpointOrder(players[1]) == nil
    local beforeLethal = differentResult.session:acceptanceSnapshot().lethalActions
    local killAccepted = oldSession:_handleTouch(oldResult.session.candidate.partById[killRecord.id], killRecord, hit)
    local staleKillRejected = killAccepted == false
        and differentResult.session:acceptanceSnapshot().lethalActions == beforeLethal
    local finishAccepted =
        oldSession:_handleTouch(oldResult.session.candidate.partById[finishRecord.id], finishRecord, hit)
    local staleFinishRejected = finishAccepted == false and not differentResult.session:finished(players[1])

    local restored = self:build("reference", "functional", 3)
    local restoredReference = restored.root:GetAttribute("ManifestHash") == fixtures.reference.expectedHash
        and G2eAcceptanceHarness.assertSingleActiveRoot() == restored.root
    local receipt =
        G2eAcceptanceHarness.emitProgressObservation(environment.repositoryCommit, fixtures.reference.expectedHash, {
            sameHashCheckpointPreserved = sameHashCheckpointPreserved,
            sameHashFinishPreserved = sameHashFinishPreserved,
            differentHashCheckpointCleared = differentHashCheckpointCleared,
            differentHashFinishCleared = differentHashFinishCleared,
            staleCharacterPlacementRejected = staleCharacterPlacementRejected,
            staleCheckpointRejected = staleCheckpointRejected,
            staleKillRejected = staleKillRejected,
            staleFinishRejected = staleFinishRejected,
            restoredReference = restoredReference,
        })
    assert(receipt.status == "PASS", receipt.firstFailingField)
    print("[G2 acceptance] progress and stale callback sequence PASS")
    return receipt
end

local function ownershipCase(apiValue, scenario, owner, ambiguous)
    local preservedRoot = apiValue.current.root
    local preservedSession = apiValue.current.session
    local originalName = preservedRoot.Name
    if not ambiguous then
        preservedRoot.Name = "_G2ePreservedRoot"
    end
    local adversarial = Instance.new("Model")
    adversarial.Name = "GeneratedObby"
    if owner ~= nil then
        adversarial:SetAttribute("GeneratedBy", owner)
        adversarial:SetAttribute("SchemaVersion", if owner == "AIObbyBuilder/0.3" then "0.3" else "0.2")
    end
    adversarial.Parent = workspace
    local invoked, result, buildError = pcall(function()
        return apiValue.builder:build(fixtures["replacement-b"].module, fixtures["replacement-b"].expectedHash)
    end)
    adversarial:Destroy()
    preservedRoot.Name = originalName
    local expectedCode = if ambiguous then "active-root-ambiguous" else "active-root-ownership"
    local preserved = invoked
        and result == nil
        and buildError ~= nil
        and buildError.code == expectedCode
        and apiValue.builder:currentSession() == preservedSession
        and preservedRoot.Parent == workspace
        and G2eAcceptanceHarness.assertSingleActiveRoot() == preservedRoot
    return table.freeze({
        scenario = scenario,
        status = if preserved then "PASS" else "FAIL",
        expectedCode = expectedCode,
        observedCode = if buildError ~= nil then boundedText(buildError.code, "none", 80) else "none",
        transactionPreserved = preserved,
    })
end

function api:runOwnershipRefusalSequence()
    assert(self.current ~= nil and self.currentFixtureId == "reference", "reference fixture must be active")
    local preservedRoot = self.current.root
    local preservedSession = self.current.session
    local cases = {
        ownershipCase(self, "unowned-root", nil, false),
        ownershipCase(self, "ambiguous-roots", "AIObbyBuilder/0.3", true),
        ownershipCase(self, "other-version-root", "AIObbyBuilder/0.2", false),
    }
    local preserved = self.current.root == preservedRoot
        and self.current.session == preservedSession
        and G2eAcceptanceHarness.assertSingleActiveRoot() == preservedRoot
    local receipt = G2eAcceptanceHarness.emitOwnershipObservation(
        environment.repositoryCommit,
        fixtures.reference.expectedHash,
        cases,
        preserved
    )
    assert(receipt.status == "PASS", receipt.firstFailingField)
    print("[G2 acceptance] ownership refusal sequence PASS")
    return receipt
end

function api:runStaticFixtureSequence()
    assert(self.current ~= nil, "an active fixture is required before the static sequence")
    local wedgeResult = self:build("wedge", "static", 1)
    local wedgeReceipt = G2eAcceptanceHarness.emitPartInspection(
        environment.repositoryCommit,
        "wedge",
        require(fixtures.wedge.module),
        wedgeResult
    )
    assert(wedgeReceipt.status == "PASS", wedgeReceipt.firstFailingField)
    local decorativeResult = self:build("decorative", "static", 2)
    local decorativeReceipt = G2eAcceptanceHarness.emitPartInspection(
        environment.repositoryCommit,
        "decorative",
        require(fixtures.decorative.module),
        decorativeResult
    )
    assert(decorativeReceipt.status == "PASS", decorativeReceipt.firstFailingField)
    local restored = self:build("reference", "static", 3)
    assert(G2eAcceptanceHarness.assertSingleActiveRoot() == restored.root, "static sequence did not restore reference")
    print("[G2 acceptance] static fixture sequence PASS")
    return table.freeze({ wedge = wedgeReceipt, decorative = decorativeReceipt })
end

function api:observeZeroCheckpointPlayers()
    assert(
        self.current ~= nil and self.currentFixtureId == "minimum-zero-checkpoint",
        "minimum-zero-checkpoint fixture must be active"
    )
    local captureWaitIterations = awaitCurrentPlacementCaptures(self)
    local receipt, placement = G2eAcceptanceHarness.emitZeroCheckpointObservation(
        environment.repositoryCommit,
        require(fixtures["minimum-zero-checkpoint"].module),
        self.current.session,
        captureWaitIterations
    )
    assert(receipt.status == "PASS", receipt.firstFailingField)
    assert(placement.status == "PASS", placement.firstFailingField)
    print("[G2 acceptance] minimum-zero-checkpoint players PASS")
    return receipt
end

G2eAcceptanceHarness.bindControl(api)
local precondition = G2eAcceptanceHarness.emitPrecondition(environment.repositoryCommit)
assert(precondition.status == "PASS", precondition.firstFailingField)
workspace:SetAttribute("G2eAcceptanceReady", true)
print("[G2 acceptance] Controls ready with zero active roots; use ServerStorage.G2eControl from the server Command Bar")

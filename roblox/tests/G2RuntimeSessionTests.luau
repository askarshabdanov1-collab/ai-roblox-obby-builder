local ManifestLoaderV03 = require("../src/ReplicatedStorage/ObbyRuntime/ManifestLoaderV03")
local RuntimeSessionV03 = require("../src/ReplicatedStorage/ObbyRuntime/RuntimeSessionV03")
local SceneBuilderCoreV03 = require("../src/ReplicatedStorage/ObbyRuntime/SceneBuilderCoreV03")
local G2RuntimeHarnessV03 = require("./support/G2RuntimeHarnessV03")

local reference = require("../generated/G2ReferenceManifestV03")

local function admit(value)
    local admitted, admissionError = ManifestLoaderV03.load({}, value.manifestHash, {
        requireModule = function()
            return value
        end,
    })
    assert(admitted ~= nil, admissionError and admissionError.message or "fixture admission failed")
    return admitted
end

local function sessionHarness(token)
    local harness = G2RuntimeHarnessV03.new()
    local admitted = admit(reference)
    local candidate, buildError = SceneBuilderCoreV03.buildCandidate(admitted, harness.runtime.partRuntime)
    assert(candidate ~= nil, buildError and buildError.message or "candidate failed")
    local pointer = SceneBuilderCoreV03.newRootState()
    local root, commitError = SceneBuilderCoreV03.commitCandidate(candidate, harness.workspace, pointer)
    assert(root ~= nil, commitError and commitError.message or "candidate commit failed")
    local session, sessionError = RuntimeSessionV03.new(admitted, candidate, token, pointer, harness.runtime)
    assert(session ~= nil, sessionError and sessionError.message or "session failed")
    pointer.currentSession = session
    pointer.currentGenerationToken = token
    root:SetAttribute("GenerationToken", token)
    return harness, admitted, candidate, pointer, session
end

return function(test, expect)
    test("initializes deterministic inactive 0.3 sessions", function()
        local _, _, _, _, first = sessionHarness("g2d-generation-v1:1")
        local _, _, _, _, second = sessionHarness("g2d-generation-v1:1")
        expect(first:status() == "inactive", "new session was not inactive")
        expect(first.identity == second.identity, "same generation input changed session identity")
        expect(first.manifestHash == reference.manifestHash, "session lost manifest identity")
        expect(first.generationToken == "g2d-generation-v1:1", "session lost generation token")
    end)

    test("prepares bounded explicit gameplay connections and activates once", function()
        local harness, _, _, _, session = sessionHarness("g2d-generation-v1:1")
        local prepared, prepareError = session:prepare()
        expect(prepared, prepareError and prepareError.message or "session preparation failed")
        expect(session:connectionCount() == 9, "unexpected gameplay connection count")
        expect(harness.tracker.activeConnections == 9, "prepared connections were not retained")
        local activated, activationError = session:activate()
        expect(activated, activationError and activationError.message or "session activation failed")
        expect(session:status() == "active", "session did not become active")
        local duplicate, duplicateError = session:activate()
        expect(duplicate == nil and duplicateError.code == "session-state", "double activation was accepted")
    end)

    test("rejects stale token manifest root object and character identity", function()
        local harness, _, candidate, pointer, session = sessionHarness("g2d-generation-v1:1")
        session:prepare()
        session:activate()
        local player = harness:newPlayer(101)
        local character = harness:newCharacter(player)
        local checkpoint = candidate.partById.Checkpoint001
        local valid = session:checkCurrent({
            manifestHash = reference.manifestHash,
            generationToken = session.generationToken,
            root = candidate.root,
            objectId = "Checkpoint001",
            part = checkpoint,
            player = player,
            character = character,
        })
        expect(valid == true, "valid current identity was rejected")

        pointer.currentGenerationToken = "g2d-generation-v1:2"
        local _, staleError = session:checkCurrent({})
        expect(staleError.code == "session-stale", "stale token was accepted")
        pointer.currentGenerationToken = session.generationToken

        local _, manifestError = session:checkCurrent({ manifestHash = string.rep("x", 71) })
        expect(manifestError.code == "session-manifest", "manifest mismatch was accepted")
        local _, rootError = session:checkCurrent({ root = {} })
        expect(rootError.code == "session-root", "root mismatch was accepted")
        local _, objectError = session:checkCurrent({ objectId = "Checkpoint001", part = {} })
        expect(objectError.code == "session-object", "object mismatch was accepted")
        local _, characterError = session:checkCurrent({ player = player, character = {} })
        expect(characterError.code == "session-character", "character mismatch was accepted")
    end)

    test("disposes all connections and state idempotently", function()
        local harness, _, _, _, session = sessionHarness("g2d-generation-v1:1")
        session:prepare()
        session:activate()
        local disposed, disposeError = session:dispose()
        expect(disposed, disposeError and disposeError.message or "session disposal failed")
        expect(session:status() == "disposed", "session did not become disposed")
        expect(session:connectionCount() == 0, "disposed session retained connections")
        expect(harness.tracker.activeConnections == 0, "disposed connections remained active")
        expect(session:dispose() == true, "double disposal was not idempotent")
        local current, staleError = session:checkCurrent({})
        expect(current == nil and staleError.code == "session-stale", "disposed session remained current")
    end)
end

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

local function activate(session)
    local prepared, prepareError = session:prepare()
    assert(prepared, prepareError and prepareError.message or "session preparation failed")
    local activated, activationError = session:activate()
    assert(activated, activationError and activationError.message or "session activation failed")
end

local function approximately(actual, expected)
    return math.abs(actual - expected) < 0.000001
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
        local harness, _, candidate, _, session = sessionHarness("g2d-generation-v1:1")
        session:prepare()
        session:activate()
        local player = harness:newPlayer(101)
        local character = harness:newCharacter(player)
        harness:touch(candidate.partById.Checkpoint001, harness:hit(player, character))
        harness:touch(candidate.partById[reference.navigation.finishObjectId], harness:hit(player, character))
        local disposed, disposeError = session:dispose()
        expect(disposed, disposeError and disposeError.message or "session disposal failed")
        expect(session:status() == "disposed", "session did not become disposed")
        expect(session:connectionCount() == 0, "disposed session retained connections")
        expect(harness.tracker.activeConnections == 0, "disposed connections remained active")
        expect(session:checkpointOrder(player) == nil and not session:finished(player), "disposed progress survived")
        expect(session:dispose() == true, "double disposal was not idempotent")
        local current, staleError = session:checkCurrent({})
        expect(current == nil and staleError.code == "session-stale", "disposed session remained current")
    end)

    test("places initial characters at the exact spawn center facing the safe route", function()
        local harness, admitted, candidate, _, session = sessionHarness("g2d-generation-v1:1")
        activate(session)
        local player = harness:newPlayer(101)
        local character = harness:newCharacter(player)
        local placed, placementError = session:placeCharacter(player, character)
        expect(placed, placementError and placementError.message or "initial placement failed")
        local spawn = admitted.indexes.gameplayById[admitted.manifest.navigation.spawnObjectId]
        local root = character.rootPart
        expect(root.CFrame.position.x == spawn.transform.position.x, "spawn X center changed")
        expect(root.CFrame.position.z == spawn.transform.position.z, "spawn Z center changed")
        expect(
            root.CFrame.position.y
                == spawn.transform.position.y
                    + spawn.size.y / 2
                    + admitted.manifest.navigation.characterPlacement.verticalOffset,
            "spawn vertical offset changed"
        )
        expect(approximately(root.CFrame.rotation.y, 270), "spawn did not face the +X route target")
        expect(harness.tracker.waits == 1, "bounded root lookup was not used")
        expect(candidate.helper:GetAttribute("NonAuthoritative") == true, "helper became placement authority")
    end)

    test("uses shared cardinal diagonal and explicit-yaw placement semantics", function()
        local placement = {
            strategy = "humanoid-root-part-cframe-v1",
            orientationPolicy = "face-next-safe-route-object",
            verticalOffset = 3,
        }
        local source = {
            transform = { position = { x = 0, y = 1, z = 0 }, rotation = { x = 0, y = 37, z = 0 } },
            size = { x = 8, y = 2, z = 8 },
        }
        local diagonal = {
            transform = { position = { x = 10, y = 100, z = 10 }, rotation = { x = 0, y = 0, z = 0 } },
        }
        local diagonalTransform = RuntimeSessionV03.CharacterPlacement.transformFor(source, placement, diagonal)
        expect(approximately(diagonalTransform.rotation.y, 225), "diagonal route-facing changed")
        placement.orientationPolicy = "explicit-yaw"
        expect(
            RuntimeSessionV03.CharacterPlacement.transformFor(source, placement, diagonal).rotation.y == 37,
            "explicit-yaw fallback changed"
        )
    end)

    test("rejects placement when delayed root lookup crosses a generation", function()
        local harness, _, _, pointer, session = sessionHarness("g2d-generation-v1:1")
        activate(session)
        local player = harness:newPlayer(101)
        local character = harness:newCharacter(player)
        character.waitHook = function()
            pointer.currentGenerationToken = "g2d-generation-v1:2"
        end
        local placed, placementError = session:placeCharacter(player, character)
        expect(placed == nil and placementError.code == "session-stale", "stale delayed placement succeeded")
        expect(character.rootPart.CFrame == nil, "stale delayed placement changed HumanoidRootPart")
    end)

    test("activates checkpoints idempotently prevents regression and respawns from current IDs", function()
        local harness, admitted, candidate, _, session = sessionHarness("g2d-generation-v1:1")
        activate(session)
        local player = harness:newPlayer(101)
        local character = harness:newCharacter(player)
        local hit = harness:hit(player, character)
        harness:touch(candidate.partById.Checkpoint001, hit)
        expect(session:checkpointOrder(player) == 1, "first checkpoint was not stored")
        expect(player:GetAttribute(RuntimeSessionV03.CHECKPOINT_ATTRIBUTE) == 1, "checkpoint attribute changed")
        harness:touch(candidate.partById.Checkpoint001, hit)
        expect(session:checkpointOrder(player) == 1, "duplicate checkpoint changed progress")
        harness:touch(candidate.partById.Checkpoint002, hit)
        expect(session:checkpointOrder(player) == 2, "second checkpoint was not stored")
        harness:touch(candidate.partById.Checkpoint001, hit)
        expect(session:checkpointOrder(player) == 2, "checkpoint route regressed")

        local respawn = harness:newCharacter(player)
        local placed, placementError = session:placeCharacter(player, respawn)
        expect(placed, placementError and placementError.message or "checkpoint respawn failed")
        local checkpoint = admitted.indexes.gameplayById.Checkpoint002
        expect(respawn.rootPart.CFrame.position.x == checkpoint.transform.position.x, "checkpoint X center changed")
        expect(respawn.rootPart.CFrame.position.z == checkpoint.transform.position.z, "checkpoint Z center changed")
        expect(approximately(respawn.rootPart.CFrame.rotation.y, 90), "checkpoint did not face its -X next route")
    end)

    test("ignores stale checkpoint callbacks", function()
        local harness, _, candidate, pointer, session = sessionHarness("g2d-generation-v1:1")
        activate(session)
        local player = harness:newPlayer(101)
        local character = harness:newCharacter(player)
        pointer.currentGenerationToken = "g2d-generation-v1:2"
        harness:touch(candidate.partById.Checkpoint001, harness:hit(player, character))
        expect(session:checkpointOrder(player) == nil, "stale checkpoint callback mutated progress")
        expect(player:GetAttribute(RuntimeSessionV03.CHECKPOINT_ATTRIBUTE) == nil, "stale callback set attributes")
    end)

    test("kills only from explicit current hazards with per-player character debounce", function()
        local harness, admitted, candidate, _, session = sessionHarness("g2d-generation-v1:1")
        activate(session)
        local hazardId = nil
        local platformId = nil
        for _, object in ipairs(admitted.manifest.layers.gameplay.objects) do
            if hazardId == nil and object.role == "kill" then
                hazardId = object.id
            elseif platformId == nil and object.role == "platform" then
                platformId = object.id
            end
        end
        local playerA = harness:newPlayer(101)
        local playerB = harness:newPlayer(202)
        local characterA = harness:newCharacter(playerA)
        local characterB = harness:newCharacter(playerB)
        harness:touch(candidate.partById[platformId], harness:hit(playerA, characterA))
        expect(harness.tracker.kills == 0, "non-hazard Part killed a character")
        harness:touch(candidate.partById[hazardId], harness:hit(playerA, characterA))
        harness:touch(candidate.partById[hazardId], harness:hit(playerA, characterA))
        expect(harness.tracker.kills == 1 and characterA.humanoid.Health == 0, "hazard debounce failed")
        harness:touch(candidate.partById[hazardId], harness:hit(playerB, characterB))
        expect(harness.tracker.kills == 2 and characterB.humanoid.Health == 0, "player debounce leaked")
        local nextCharacter = harness:newCharacter(playerA)
        harness:touch(candidate.partById[hazardId], harness:hit(playerA, nextCharacter))
        expect(harness.tracker.kills == 3, "new character inherited old hazard debounce")
    end)

    test("ignores stale replaced-object and mismatched-character hazard callbacks", function()
        local harness, admitted, candidate, pointer, session = sessionHarness("g2d-generation-v1:1")
        activate(session)
        local hazardRecord = nil
        for _, record in ipairs(candidate.plan.gameplayRecords) do
            if record.role == "kill" then
                hazardRecord = record
                break
            end
        end
        local player = harness:newPlayer(101)
        local character = harness:newCharacter(player)
        local hit = harness:hit(player, character)
        local replacementPart = candidate.partById[admitted.manifest.navigation.spawnObjectId]
        session:_handleTouch(replacementPart, hazardRecord, hit)
        expect(harness.tracker.kills == 0, "replaced object identity killed a character")
        local otherCharacter = { humanoid = { Health = 100 } }
        session:_handleTouch(candidate.partById[hazardRecord.id], hazardRecord, harness:hit(player, otherCharacter))
        expect(harness.tracker.kills == 0, "mismatched character was killed")
        pointer.currentGenerationToken = "g2d-generation-v1:2"
        session:_handleTouch(candidate.partById[hazardRecord.id], hazardRecord, hit)
        expect(harness.tracker.kills == 0, "stale hazard callback killed a character")
    end)

    test("finishes idempotently per player only from the explicit finish", function()
        local harness, admitted, candidate, _, session = sessionHarness("g2d-generation-v1:1")
        activate(session)
        local playerA = harness:newPlayer(101)
        local playerB = harness:newPlayer(202)
        local characterA = harness:newCharacter(playerA)
        local characterB = harness:newCharacter(playerB)
        local finish = candidate.partById[admitted.manifest.navigation.finishObjectId]
        harness:touch(finish, harness:hit(playerA, characterA))
        harness:touch(finish, harness:hit(playerA, characterA))
        expect(session:finished(playerA), "player A finish was not stored")
        expect(not session:finished(playerB), "player B inherited player A finish")
        expect(
            playerA:GetAttribute(RuntimeSessionV03.FINISH_ATTRIBUTE) == session.manifestHash,
            "finish attribute identity changed"
        )
        harness:touch(finish, harness:hit(playerB, characterB))
        expect(session:finished(playerB), "player B could not finish independently")
    end)

    test("ignores stale finish callbacks", function()
        local harness, admitted, candidate, pointer, session = sessionHarness("g2d-generation-v1:1")
        activate(session)
        local player = harness:newPlayer(101)
        local character = harness:newCharacter(player)
        pointer.currentRoot = nil
        harness:touch(candidate.partById[admitted.manifest.navigation.finishObjectId], harness:hit(player, character))
        expect(not session:finished(player), "stale finish callback mutated progress")
        expect(player:GetAttribute(RuntimeSessionV03.FINISH_ATTRIBUTE) == nil, "stale finish set attributes")
    end)
end

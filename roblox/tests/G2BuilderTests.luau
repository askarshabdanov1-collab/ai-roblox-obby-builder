local BuilderV03 = require("../src/ReplicatedStorage/ObbyRuntime/BuilderV03")
local RuntimeSessionV03 = require("../src/ReplicatedStorage/ObbyRuntime/RuntimeSessionV03")
local G2RuntimeHarnessV03 = require("./support/G2RuntimeHarnessV03")

local maximum50 = require("../generated/G2Maximum50ManifestV03")
local reference = require("../generated/G2ReferenceManifestV03")
local replacement = require("../generated/G2ReplacementManifestV03")
local zeroCheckpoint = require("../generated/G2ZeroCheckpointManifestV03")

local function build(builder, manifest, options)
    options = options or {}
    options.requireModule = function()
        return manifest
    end
    return builder:build({}, manifest.manifestHash, options)
end

local function firstByRole(manifest, role)
    for _, object in ipairs(manifest.layers.gameplay.objects) do
        if object.role == role then
            return object.id
        end
    end
    return nil
end

return function(test, expect)
    test("orchestrates admission candidate session activation and existing-player placement", function()
        local harness = G2RuntimeHarnessV03.new()
        local playerA = harness:newPlayer(101)
        local playerB = harness:newPlayer(202)
        local characterA = harness:newCharacter(playerA)
        local characterB = harness:newCharacter(playerB)
        harness:addPlayer(playerA)
        harness:addPlayer(playerB)
        local builder, builderError = BuilderV03.new(harness.runtime)
        expect(builder ~= nil, builderError and builderError.message or "builder failed")
        local result, buildError = build(builder, reference)
        expect(result ~= nil, buildError and buildError.message or "build failed")
        expect(result.session:status() == "active", "new session was not activated")
        expect(result.root.Parent == harness.workspace, "new root is not active")
        expect(result.root:GetAttribute("GenerationToken") == result.session.generationToken, "token marker changed")
        expect(builder:currentSession() == result.session, "builder pointer did not switch")
        harness:runDeferred()
        expect(characterA.rootPart.CFrame ~= nil and characterB.rootPart.CFrame ~= nil, "existing players not placed")
        expect(result.session:connectionCount() == 9, "gameplay connection bound changed")
    end)

    test("preserves the old complete scene and session on a pre-commit failure", function()
        local harness = G2RuntimeHarnessV03.new()
        local builder = BuilderV03.new(harness.runtime)
        local first = build(builder, reference)
        local failed, buildError = build(builder, replacement, {
            commitOptions = { failAt = "after-retire" },
        })
        expect(failed == nil and buildError.code == "commit-injected-failure", "failure was not surfaced")
        expect(builder:currentSession() == first.session, "old session pointer changed")
        expect(first.session:status() == "active", "old session was invalidated before commit")
        expect(first.root.Parent == harness.workspace and not first.root.Destroyed, "old scene was not preserved")
    end)

    test("invalidates old callbacks before retired-root cleanup", function()
        local harness = G2RuntimeHarnessV03.new()
        local player = harness:newPlayer(101)
        local character = harness:newCharacter(player)
        harness:addPlayer(player)
        local builder = BuilderV03.new(harness.runtime)
        local first = build(builder, reference)
        local oldFinish = first.session.candidate.partById[reference.navigation.finishObjectId]
        local newWasActiveAtOldDestroy = false
        harness.tracker.onDestroy = function(instance)
            if instance == first.root then
                local current = builder:currentSession()
                newWasActiveAtOldDestroy = current ~= first.session and current:status() == "active"
            end
        end
        local second, buildError = build(builder, replacement)
        expect(second ~= nil, buildError and buildError.message or "replacement failed")
        expect(first.session:status() == "disposed", "old session survived replacement")
        expect(newWasActiveAtOldDestroy, "old root was destroyed before new session activation")
        harness:touch(oldFinish, harness:hit(player, character))
        expect(not second.session:finished(player), "old finish callback mutated new session")
        expect(harness.tracker.activeConnections == second.session:connectionCount() + 3, "old connections leaked")
    end)

    test("preserves ID-based progress across a same-manifest rebuild", function()
        local harness = G2RuntimeHarnessV03.new()
        local player = harness:newPlayer(101)
        local character = harness:newCharacter(player)
        harness:addPlayer(player)
        local builder = BuilderV03.new(harness.runtime)
        local first = build(builder, reference)
        local hit = harness:hit(player, character)
        harness:touch(first.session.candidate.partById.Checkpoint001, hit)
        harness:touch(first.session.candidate.partById[reference.navigation.finishObjectId], hit)
        local second, buildError = build(builder, reference)
        expect(second ~= nil, buildError and buildError.message or "same-manifest rebuild failed")
        expect(second.session:checkpointOrder(player) == 1, "checkpoint ID progress was not preserved")
        expect(second.session:finished(player), "finish progress was not preserved")
        expect(first.session:status() == "disposed", "old same-manifest session remained active")
        local respawn = harness:newCharacter(player)
        local placed = second.session:placeCharacter(player, respawn)
        expect(placed == true, "preserved checkpoint could not resolve in the new scene")
        expect(
            respawn.rootPart.CFrame.position.x
                == second.session.admitted.indexes.gameplayById.Checkpoint001.transform.position.x,
            "same-manifest rebuild retained an old Part instead of an ID"
        )
    end)

    test("clears both players independently on a new manifest and removal", function()
        local harness = G2RuntimeHarnessV03.new()
        local playerA = harness:newPlayer(101)
        local playerB = harness:newPlayer(202)
        local characterA = harness:newCharacter(playerA)
        local characterB = harness:newCharacter(playerB)
        harness:addPlayer(playerA)
        harness:addPlayer(playerB)
        local builder = BuilderV03.new(harness.runtime)
        local first = build(builder, reference)
        harness:touch(first.session.candidate.partById.Checkpoint001, harness:hit(playerA, characterA))
        harness:touch(first.session.candidate.partById.Checkpoint002, harness:hit(playerB, characterB))
        expect(first.session:checkpointOrder(playerA) == 1, "player A checkpoint changed")
        expect(first.session:checkpointOrder(playerB) == 2, "player B checkpoint changed")
        local second = build(builder, replacement)
        expect(second.session:checkpointOrder(playerA) == nil, "player A old-manifest state survived")
        expect(second.session:checkpointOrder(playerB) == nil, "player B old-manifest state survived")
        expect(playerA:GetAttribute(RuntimeSessionV03.CHECKPOINT_ATTRIBUTE) == nil, "player A attribute survived")
        expect(playerB:GetAttribute(RuntimeSessionV03.CHECKPOINT_ATTRIBUTE) == nil, "player B attribute survived")
        harness:touch(second.session.candidate.partById.Checkpoint001, harness:hit(playerA, characterA))
        harness:touch(second.session.candidate.partById.Checkpoint002, harness:hit(playerB, characterB))
        harness:removePlayer(playerA)
        expect(second.session:checkpointOrder(playerA) == nil, "removed player state survived")
        expect(second.session:checkpointOrder(playerB) == 2, "player removal cleared another player")
    end)

    test("supports zero checkpoints and bounds 50-stage connections by gameplay objects", function()
        for _, fixture in ipairs({ zeroCheckpoint, maximum50 }) do
            local harness = G2RuntimeHarnessV03.new()
            local builder = BuilderV03.new(harness.runtime)
            local result, buildError = build(builder, fixture)
            expect(result ~= nil, buildError and buildError.message or "boundary build failed")
            expect(
                result.session:connectionCount() <= #fixture.layers.gameplay.objects,
                "connections exceeded gameplay-object count"
            )
            if fixture == zeroCheckpoint then
                expect(result.session:checkpointOrder(harness:newPlayer(303)) == nil, "zero checkpoint gained progress")
            end
        end
    end)

    test("binds behavior only to explicit role and behavior pairs", function()
        local harness = G2RuntimeHarnessV03.new()
        local builder = BuilderV03.new(harness.runtime)
        local result = build(builder, reference)
        local expected = 0
        for _, object in ipairs(reference.layers.gameplay.objects) do
            local kind = object.behavior.kind
            if
                (object.role == "checkpoint" and kind == "checkpoint")
                or (object.role == "kill" and kind == "kill")
                or (object.role == "finish" and kind == "finish")
            then
                expected += 1
            end
        end
        expect(result.session:connectionCount() == expected, "explicit behavior connection count changed")
        expect(firstByRole(reference, "kill") ~= nil, "reference hazard coverage disappeared")
    end)
end

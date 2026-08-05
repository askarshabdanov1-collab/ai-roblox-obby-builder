local BuilderV03 = require("../src/ReplicatedStorage/ObbyRuntime/BuilderV03")
local RuntimeSessionV03 = require("../src/ReplicatedStorage/ObbyRuntime/RuntimeSessionV03")
local G2ePlacementCaptureV1 = require("../g2e/G2ePlacementCaptureV1")
local FakeInstanceV03 = require("./support/FakeInstanceV03")
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
    test("defers replacement placement until yield and applies only the final session", function()
        local harness = G2RuntimeHarnessV03.new()
        local player = harness:newPlayer(101)
        harness:newCharacter(player)
        harness:addPlayer(player)
        local builder = BuilderV03.new(harness.runtime)
        local captureByResult = {}
        for _, manifest in ipairs({ reference, replacement, reference }) do
            local result = build(builder, manifest)
            captureByResult[result] = G2ePlacementCaptureV1.attach(result.session, function(_, _, value)
                return table.freeze({ observedCFrame = value.rootPart.CFrame })
            end)
        end
        local finalResult = builder:currentSession()
        local finalCapture = nil
        for result, capture in pairs(captureByResult) do
            if result.session == finalResult then
                finalCapture = capture
            else
                expect(not capture.completeFor({ player }), "stale replacement placement ran before yield")
            end
        end
        expect(finalCapture ~= nil and not finalCapture.completeFor({ player }), "final placement ran synchronously")

        harness:runDeferred()

        expect(finalCapture.completeFor({ player }), "final replacement placement did not run after yield")
        for result, capture in pairs(captureByResult) do
            if result.session ~= finalResult then
                expect(not capture.completeFor({ player }), "stale replacement placement was accepted")
            end
        end
    end)

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
        for _, boundary in ipairs({ "before-commit", "after-retire", "after-publish", "before-pointer" }) do
            local harness = G2RuntimeHarnessV03.new()
            local builder = BuilderV03.new(harness.runtime)
            local first = build(builder, reference)
            local options = if boundary == "before-commit"
                then { failAt = boundary }
                else { commitOptions = { failAt = boundary } }
            local failed, buildError = build(builder, replacement, options)
            local expectedCode = if boundary == "before-commit"
                then "builder-injected-failure"
                else "commit-injected-failure"
            expect(
                failed == nil and buildError.code == expectedCode,
                string.format("%s failure was not surfaced", boundary)
            )
            expect(builder:currentSession() == first.session, "old session pointer changed at " .. boundary)
            expect(first.session:status() == "active", "old session was invalidated at " .. boundary)
            expect(
                first.root.Parent == harness.workspace and not FakeInstanceV03.isDestroyed(first.root),
                "old scene was not preserved at " .. boundary
            )
        end
    end)

    test("invalidates old callbacks before retired-root cleanup", function()
        local harness = G2RuntimeHarnessV03.new()
        local player = harness:newPlayer(101)
        local character = harness:newCharacter(player)
        harness:addPlayer(player)
        local builder = BuilderV03.new(harness.runtime)
        local first = build(builder, reference)
        local oldFinish = first.session.candidate.partById[reference.navigation.finishObjectId]
        local oldCheckpoint = first.session.candidate.partById.Checkpoint001
        local oldHazard = first.session.candidate.partById[firstByRole(reference, "kill")]
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
        harness:touch(oldCheckpoint, harness:hit(player, character))
        harness:touch(oldHazard, harness:hit(player, character))
        expect(not second.session:finished(player), "old finish callback mutated new session")
        expect(second.session:checkpointOrder(player) == nil, "old checkpoint callback mutated new session")
        expect(harness.tracker.kills == 0, "old hazard callback mutated the player")
        expect(harness.tracker.activeConnections == second.session:connectionCount() + 3, "old connections leaked")
    end)

    test("rejects a direct stale hazard callback without current-scene mutation", function()
        local harness = G2RuntimeHarnessV03.new()
        local player = harness:newPlayer(101)
        local character = harness:newCharacter(player)
        harness:addPlayer(player)
        local builder = BuilderV03.new(harness.runtime)
        local first = build(builder, reference)
        local hazardRecord = nil
        for _, record in ipairs(first.session.candidate.plan.gameplayRecords) do
            if record.role == "kill" then
                hazardRecord = record
                break
            end
        end
        expect(hazardRecord ~= nil, "reference hazard record is unavailable")
        local hazardPart = first.session.candidate.partById[hazardRecord.id]
        local second = build(builder, replacement)
        local currentRoot = second.root
        local currentBefore = second.session:acceptanceSnapshot()
        local staleBefore = first.session:acceptanceSnapshot()
        local healthBefore = character.humanoid.Health

        local accepted = first.session:_handleTouch(hazardPart, hazardRecord, harness:hit(player, character))

        local currentAfter = second.session:acceptanceSnapshot()
        local staleAfter = first.session:acceptanceSnapshot()
        expect(accepted == false, "direct stale hazard callback was accepted")
        expect(
            staleAfter.staleCallbackRejections == staleBefore.staleCallbackRejections + 1,
            "direct stale callback did not reach the generation rejection"
        )
        expect(staleAfter.lethalActions == staleBefore.lethalActions, "stale session performed a lethal action")
        expect(character.humanoid.Health == healthBefore, "stale callback mutated the character")
        expect(
            builder:currentSession() == second.session and second.root == currentRoot,
            "current scene identity changed"
        )
        expect(
            currentAfter.lethalActions == currentBefore.lethalActions,
            "stale callback mutated current acceptance state"
        )
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
        harness:touch(
            first.session.candidate.partById[reference.navigation.finishObjectId],
            harness:hit(playerA, characterA)
        )
        expect(first.session:checkpointOrder(playerA) == 1, "player A checkpoint changed")
        expect(first.session:checkpointOrder(playerB) == 2, "player B checkpoint changed")
        local second = build(builder, replacement)
        expect(second.session:checkpointOrder(playerA) == nil, "player A old-manifest state survived")
        expect(second.session:checkpointOrder(playerB) == nil, "player B old-manifest state survived")
        expect(not second.session:finished(playerA), "player A old-manifest finish survived")
        expect(playerA:GetAttribute(RuntimeSessionV03.CHECKPOINT_ATTRIBUTE) == nil, "player A attribute survived")
        expect(playerB:GetAttribute(RuntimeSessionV03.CHECKPOINT_ATTRIBUTE) == nil, "player B attribute survived")
        expect(playerA:GetAttribute(RuntimeSessionV03.FINISH_ATTRIBUTE) == nil, "player A finish attribute survived")
        harness:touch(second.session.candidate.partById.Checkpoint001, harness:hit(playerA, characterA))
        harness:touch(second.session.candidate.partById.Checkpoint002, harness:hit(playerB, characterB))
        harness:removePlayer(playerA)
        expect(second.session:checkpointOrder(playerA) == nil, "removed player state survived")
        expect(second.session:checkpointOrder(playerB) == 2, "player removal cleared another player")
        expect(builder.playerConnectionByPlayer[playerA] == nil, "removed player connection survived")
        for _, retainedPlayer in ipairs(builder.playerOrder) do
            expect(retainedPlayer ~= playerA, "removed player reference survived")
        end
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

    test("places delayed CharacterAdded and rejects queued placement from a replaced session", function()
        local harness = G2RuntimeHarnessV03.new()
        local player = harness:newPlayer(101)
        harness:addPlayer(player)
        local builder = BuilderV03.new(harness.runtime)
        build(builder, reference)
        local delayed = harness:newCharacter(player)
        harness:fireCharacter(player, delayed)
        harness:runDeferred()
        expect(delayed.rootPart.CFrame ~= nil, "delayed CharacterAdded was not placed")

        local staleCharacter = harness:newCharacter(player)
        harness:fireCharacter(player, staleCharacter)
        local currentCharacter = harness:newCharacter(player)
        build(builder, replacement)
        harness:runDeferred()
        expect(staleCharacter.rootPart.CFrame == nil, "queued old-session placement crossed replacement")
        expect(currentCharacter.rootPart.CFrame ~= nil, "current replacement character was not placed")
    end)

    test("cleans partial new-session connections and preserves old session on preparation failure", function()
        local harness = G2RuntimeHarnessV03.new()
        local builder = BuilderV03.new(harness.runtime)
        local first = build(builder, reference)
        local activeBefore = harness.tracker.activeConnections
        harness.tracker.failTouchConnectionAt = harness.tracker.touchConnectionAttempts + 2
        local failed, buildError = build(builder, replacement)
        expect(failed == nil and buildError.code == "session-connection", "connection failure was hidden")
        expect(builder:currentSession() == first.session, "connection failure changed current session")
        expect(first.session:status() == "active", "connection failure invalidated old session")
        expect(harness.tracker.activeConnections == activeBefore, "partial new-session connection leaked")
        expect(
            first.root.Parent == harness.workspace and not FakeInstanceV03.isDestroyed(first.root),
            "connection failure changed scene"
        )
    end)
end

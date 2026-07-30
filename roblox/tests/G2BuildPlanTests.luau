local BuildPlanV03 = require("../src/ReplicatedStorage/ObbyRuntime/BuildPlanV03")
local ManifestLoaderV03 = require("../src/ReplicatedStorage/ObbyRuntime/ManifestLoaderV03")

local reference = require("../generated/G2ReferenceManifestV03")

local function clone(value)
    if type(value) ~= "table" then
        return value
    end
    local result = {}
    for key, child in next, value do
        result[clone(key)] = clone(child)
    end
    return result
end

local function admit(value)
    local admitted, admissionError = ManifestLoaderV03.load({}, value.manifestHash, {
        requireModule = function()
            return value
        end,
    })
    assert(admitted ~= nil, admissionError and admissionError.message or "fixture admission failed")
    return admitted
end

return function(test, expect)
    test("creates a deterministic immutable 0.3 construction plan", function()
        local admitted = admit(reference)
        local first, firstError = BuildPlanV03.create(admitted)
        local second, secondError = BuildPlanV03.create(admitted)
        expect(first ~= nil, firstError and firstError.message or "first plan failed")
        expect(second ~= nil, secondError and secondError.message or "second plan failed")
        expect(first.structuralIdentity == second.structuralIdentity, "repeated plan identity changed")
        expect(first.planVersion == "g2c-build-plan-v1", "plan version changed")
        expect(first.schemaVersion == "0.3", "plan lost schema version")
        expect(first.sceneId == reference.sceneId, "plan lost scene identity")
        expect(first.manifestHash == reference.manifestHash, "plan lost manifest identity")
        expect(#first.gameplayRecords == #reference.layers.gameplay.objects, "gameplay count changed")
        expect(#first.decorativeRecords == #reference.layers.decorative.objects, "decorative count changed")
        expect(first.counts.manifestParts == #reference.layers.gameplay.objects, "manifest Part count changed")
        expect(
            first.counts.helperParts == 1 and first.counts.totalParts == first.counts.manifestParts + 1,
            "helper count changed"
        )
        expect(table.isfrozen(first) and table.isfrozen(first.gameplayRecords), "plan is mutable")
        expect(table.isfrozen(first.gameplayRecords[1]), "construction record is mutable")
    end)

    test("preserves admitted ordering source references routes and zones exactly", function()
        local admitted = admit(reference)
        local plan = BuildPlanV03.create(admitted)
        for index, record in ipairs(plan.gameplayRecords) do
            local source = admitted.manifest.layers.gameplay.objects[index]
            expect(record.id == admitted.indexes.gameplayObjectIds[index], "gameplay ordering changed")
            expect(record.order == source.order and record.role == source.role, "object semantics changed")
            expect(
                record.sourceReferences.sourceStageId == source.sourceReferences.sourceStageId,
                "stage source changed"
            )
            expect(
                #record.sourceReferences.sourceAssetIntentIds == #source.sourceReferences.sourceAssetIntentIds,
                "asset sources changed"
            )
        end
        for index, objectId in ipairs(plan.navigation.safeRouteObjectIds) do
            expect(objectId == admitted.indexes.safeRouteObjectIds[index], "route ordering changed")
        end
        for index, zoneId in ipairs(plan.navigation.zoneIds) do
            expect(zoneId == admitted.indexes.zoneIds[index], "zone ordering changed")
        end
    end)

    test("detaches planning from caller mutation without allocating Instances", function()
        local caller = clone(reference)
        local admitted = admit(caller)
        local allocations = 0
        local plan = BuildPlanV03.create(admitted, {
            newInstance = function()
                allocations += 1
            end,
        })
        local originalId = plan.gameplayRecords[1].id
        local originalStage = plan.gameplayRecords[2].sourceReferences.sourceStageId
        caller.layers.gameplay.objects[1].id = "MutatedCaller"
        caller.layers.gameplay.objects[2].sourceReferences.sourceStageId = "mutated-stage"
        expect(plan.gameplayRecords[1].id == originalId, "caller changed planned object identity")
        expect(
            plan.gameplayRecords[2].sourceReferences.sourceStageId == originalStage,
            "caller changed planned sources"
        )
        expect(allocations == 0, "planning allocated an Instance")
        local mutable = pcall(function()
            plan.gameplayRecords[1].id = "MutablePlan"
        end)
        expect(not mutable, "construction record was mutable")
    end)

    test("separates the non-authoritative helper SpawnLocation from gameplay", function()
        local admitted = admit(reference)
        local plan = BuildPlanV03.create(admitted)
        local spawn = plan.gameplayRecords[1]
        local helper = plan.helperSpawnRecord
        expect(spawn.id == "Spawn" and spawn.role == "spawn", "manifest spawn authority changed")
        expect(spawn.className == "Part", "manifest spawn stopped being a Part")
        expect(helper.id == "_RuntimeSpawnLocation", "helper name changed")
        expect(helper.className == "SpawnLocation" and helper.shape == "Block", "helper mapping changed")
        expect(helper.nonAuthoritative == true and helper.transparency == 1, "helper became authoritative or visible")
        expect(
            not helper.collision.canCollide and not helper.collision.canTouch and not helper.collision.canQuery,
            "helper gained collision authority"
        )
        expect(helper.transform.position.x == spawn.transform.position.x, "helper lost horizontal centering")
        expect(helper.transform.position.z == spawn.transform.position.z, "helper lost horizontal centering")
        expect(
            helper.transform.position.y + helper.size.y / 2 == spawn.transform.position.y + spawn.size.y / 2,
            "helper top plane differs from spawn"
        )
    end)

    test("rejects data that is not an admitted immutable G2b result", function()
        local result, planError = BuildPlanV03.create(reference)
        expect(result == nil and planError.code == "plan-admission", "raw manifest bypassed G2b admission")
        local admitted = admit(reference)
        local fake = {
            manifest = admitted.manifest,
            indexes = admitted.indexes,
            hashTrust = "untrusted-runtime-table",
            structuralIdentity = admitted.structuralIdentity,
        }
        result, planError = BuildPlanV03.create(fake)
        expect(result == nil and planError.code == "plan-admission", "wrong trust boundary was planned")
    end)
end

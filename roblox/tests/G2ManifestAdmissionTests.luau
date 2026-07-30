local ManifestAdmissionV03 = require("../src/ReplicatedStorage/ObbyRuntime/ManifestAdmissionV03")
local ManifestLoaderV03 = require("../src/ReplicatedStorage/ObbyRuntime/ManifestLoaderV03")
local ManifestSnapshotV03 = require("../src/ReplicatedStorage/ObbyRuntime/ManifestSnapshotV03")
local ManifestValidatorV03 = require("../src/ReplicatedStorage/ObbyRuntime/ManifestValidatorV03")

local reference = require("../generated/G2ReferenceManifestV03")
local zeroCheckpoint = require("../generated/G2ZeroCheckpointManifestV03")
local boundary20 = require("../generated/G2Boundary20ManifestV03")
local boundary21 = require("../generated/G2Boundary21ManifestV03")
local maximum50 = require("../generated/G2Maximum50ManifestV03")
local maximumCheckpoints = require("../generated/G2MaximumCheckpointsManifestV03")

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

local function loadValue(value, expectedHash, overrides)
    local options = overrides or {}
    options.requireModule = options.requireModule or function()
        return value
    end
    return ManifestLoaderV03.load({}, expectedHash or value.manifestHash, options)
end

local function expectError(value, expectedCode)
    local result, admissionError = loadValue(value, value.manifestHash)
    assert(result == nil, "invalid manifest was admitted")
    assert(admissionError.code == expectedCode, admissionError.code .. " did not equal " .. expectedCode)
    assert(type(admissionError.message) == "string" and #admissionError.message > 0, "error was not sanitized")
end

return function(test, expect)
    test("admits the authoritative G1d transport without side effects", function()
        local allocations = 0
        local admitted, admissionError = loadValue(reference, reference.manifestHash, {
            onInstanceAllocation = function()
                allocations += 1
            end,
        })
        expect(admitted ~= nil, admissionError and admissionError.message or "reference admission failed")
        expect(allocations == 0, "admission allocated an Instance")
        expect(admitted.manifest.manifestHash == reference.manifestHash, "manifest identity changed")
        expect(admitted.indexes.gameplayById.Spawn.role == "spawn", "Spawn index is missing")
        expect(admitted.indexes.gameplayById.Finish.role == "finish", "Finish index is missing")
        expect(
            admitted.indexes.safeRouteObjectIds[#admitted.indexes.safeRouteObjectIds] == "Finish",
            "route order changed"
        )
        expect(table.isfrozen(admitted), "admitted envelope is mutable")
        expect(table.isfrozen(admitted.manifest), "admitted manifest is mutable")
        expect(table.isfrozen(admitted.indexes.gameplayById), "admitted indexes are mutable")
    end)

    test("protects module require and sanitizes failures", function()
        local result, admissionError = ManifestLoaderV03.load({}, reference.manifestHash, {
            requireModule = function()
                error("secret absolute path and uncontrolled manifest contents")
            end,
        })
        expect(result == nil and admissionError.code == "module-require-failed", "require failure was not typed")
        expect(not string.find(admissionError.message, "secret", 1, true), "require error leaked uncontrolled text")

        result, admissionError = loadValue("not-a-table", reference.manifestHash)
        expect(result == nil and admissionError.code == "module-result-type", "non-table module result was accepted")
    end)

    test("rejects cross-loaded versions and configured identity failures", function()
        local wrongVersion = clone(reference)
        wrongVersion.schemaVersion = "0.2"
        expectError(wrongVersion, "schema-version")

        local result, admissionError = loadValue(reference, "not-a-hash")
        expect(result == nil and admissionError.code == "expected-hash-format", "malformed expected hash was accepted")
        result, admissionError = loadValue(reference, "sha256:" .. string.rep("0", 64))
        expect(result == nil and admissionError.code == "expected-hash-mismatch", "stale expected hash was accepted")
    end)

    test("rejects metatables cycles sparse arrays and unsupported values", function()
        local touched = false
        local withMetatable = clone(reference)
        setmetatable(withMetatable, {
            __index = function()
                touched = true
                return nil
            end,
        })
        expectError(withMetatable, "snapshot-metatable")
        expect(not touched, "snapshot traversal executed a metatable")

        local cyclic = clone(reference)
        cyclic.cycle = cyclic
        expectError(cyclic, "snapshot-cycle")

        local aliased = clone(reference)
        aliased.layers.decorative.objects[1] = aliased.layers.gameplay.objects[1]
        expectError(aliased, "snapshot-cycle")

        local sparse = clone(reference)
        sparse.limitations = { [1] = clone(sparse.findings[1]), [3] = clone(sparse.findings[2]) }
        expectError(sparse, "array-shape")

        local numericRecordKey = clone(reference)
        numericRecordKey[1] = "not-a-record-field"
        expectError(numericRecordKey, "record-key")

        for _, unsupported in ipairs({
            function() end,
            coroutine.create(function() end),
            buffer.create(1),
        }) do
            local candidate = clone(reference)
            candidate.limitations = { unsupported }
            expectError(candidate, "snapshot-value-type")
        end
    end)

    test("detaches and freezes admitted data against caller mutation", function()
        local caller = clone(reference)
        local admitted = loadValue(caller, caller.manifestHash)
        local originalSceneId = admitted.manifest.sceneId
        local originalFirstRouteId = admitted.manifest.navigation.safeRouteObjectIds[1]
        caller.sceneId = "mutated-after-admission"
        caller.navigation.safeRouteObjectIds[1] = "MutatedRoute"
        expect(admitted.manifest.sceneId == originalSceneId, "caller changed admitted scalar data")
        expect(
            admitted.manifest.navigation.safeRouteObjectIds[1] == originalFirstRouteId,
            "caller changed admitted array"
        )
        local mutable = pcall(function()
            admitted.manifest.sceneId = "mutated"
        end)
        expect(not mutable, "admitted data was not frozen")
    end)

    test("rejects additional properties at every admitted record level", function()
        local mutations = {
            function(value)
                value.unknown = true
            end,
            function(value)
                value.provenance.unknown = true
            end,
            function(value)
                value.coordinateSystem.unknown = true
            end,
            function(value)
                value.worldBounds.minimum.unknown = true
            end,
            function(value)
                value.layers.unknown = true
            end,
            function(value)
                value.layers.gameplay.unknown = true
            end,
            function(value)
                value.layers.gameplay.objects[1].unknown = true
            end,
            function(value)
                value.layers.gameplay.objects[1].sourceReferences.unknown = true
            end,
            function(value)
                value.layers.gameplay.objects[1].transform.unknown = true
            end,
            function(value)
                value.layers.gameplay.objects[1].collision.unknown = true
            end,
            function(value)
                value.layers.gameplay.objects[1].appearance.unknown = true
            end,
            function(value)
                value.layers.gameplay.objects[1].geometry.unknown = true
            end,
            function(value)
                value.layers.gameplay.objects[1].behavior.unknown = true
            end,
            function(value)
                value.navigation.unknown = true
            end,
            function(value)
                value.navigation.characterPlacement.unknown = true
            end,
            function(value)
                value.navigation.routeEntries[1].unknown = true
            end,
            function(value)
                value.navigation.stages[1].unknown = true
            end,
            function(value)
                value.navigation.reachability.unknown = true
            end,
            function(value)
                value.navigation.reachability.controllerProfileRef.unknown = true
            end,
            function(value)
                value.navigation.reachability.requiredTransitions[1].unknown = true
            end,
            function(value)
                value.navigation.reachability.requiredTransitions[1].horizontalSeparation.unknown = true
            end,
            function(value)
                value.navigation.reachability.requiredTransitions[1].landingRegion.unknown = true
            end,
            function(value)
                value.decorativeZones[1].unknown = true
            end,
        }
        for index, mutate in ipairs(mutations) do
            local candidate = clone(reference)
            mutate(candidate)
            local valid, _, validationError = ManifestValidatorV03.validate(candidate)
            expect(
                not valid and validationError.code == "additional-property",
                "additional property case " .. index .. " passed"
            )
        end
    end)

    test("rejects non-finite unsafe and out-of-range numbers", function()
        local mutations = {
            function(value)
                value.seed = 0 / 0
            end,
            function(value)
                value.seed = math.huge
            end,
            function(value)
                value.seed = 9007199254740992
            end,
            function(value)
                value.navigation.characterPlacement.verticalOffset = 1
            end,
            function(value)
                value.layers.gameplay.objects[1].transform.position.x = 2049
            end,
            function(value)
                value.layers.gameplay.objects[1].size.x = 0
            end,
            function(value)
                value.navigation.reachability.requiredTransitions[1].horizontalSeparation.toleranceStuds = 0.1
            end,
        }
        for index, mutate in ipairs(mutations) do
            local candidate = clone(reference)
            mutate(candidate)
            local result = loadValue(candidate, candidate.manifestHash)
            expect(result == nil, "invalid numeric case " .. index .. " passed")
        end
    end)

    test("rejects duplicate dangling route transition and role data", function()
        local mutations = {
            function(value)
                value.layers.gameplay.objects[2].id = value.layers.gameplay.objects[1].id
            end,
            function(value)
                value.decorativeZones[2].zoneId = value.decorativeZones[1].zoneId
            end,
            function(value)
                value.navigation.stages[2].stageId = value.navigation.stages[1].stageId
            end,
            function(value)
                value.navigation.safeRouteObjectIds[1] = "UnknownObject"
            end,
            function(value)
                value.navigation.routeEntries[1].stageId = "unknown-stage"
            end,
            function(value)
                value.navigation.reachability.requiredTransitions[1].toObjectId = "UnknownObject"
            end,
            function(value)
                value.navigation.checkpointObjectIds[1] = "Finish"
            end,
            function(value)
                value.layers.gameplay.objects[1].behavior = { kind = "finish" }
            end,
            function(value)
                value.layers.gameplay.objects[1].collision.canCollide = false
            end,
            function(value)
                value.navigation.reachability.requiredTransitions[1].outcome = "indeterminate"
            end,
        }
        for index, mutate in ipairs(mutations) do
            local candidate = clone(reference)
            mutate(candidate)
            local valid = ManifestValidatorV03.validate(candidate)
            expect(not valid, "semantic parity case " .. index .. " passed")
        end
    end)

    test("admits zero checkpoint 20 21 50 and maximum-checkpoint fixtures", function()
        local cases = {
            { value = zeroCheckpoint, stages = 5, checkpoints = 0 },
            { value = boundary20, stages = 20 },
            { value = boundary21, stages = 21 },
            { value = maximum50, stages = 50 },
            { value = maximumCheckpoints, stages = 50, checkpoints = 49 },
        }
        for _, case in ipairs(cases) do
            local admitted, admissionError = loadValue(case.value, case.value.manifestHash)
            expect(admitted ~= nil, admissionError and admissionError.message or "boundary fixture failed")
            expect(#admitted.manifest.navigation.stages == case.stages, "stage boundary changed")
            if case.checkpoints ~= nil then
                expect(
                    #admitted.manifest.navigation.checkpointObjectIds == case.checkpoints,
                    "checkpoint boundary changed"
                )
            end
        end
    end)

    test("enforces collection and work N-1 N and N+1 boundaries", function()
        local limits = ManifestAdmissionV03.LIMITS
        local collectionCases = {
            { name = "gameplay", minimum = 7, maximum = 501 },
            { name = "safeRoute", minimum = 6, maximum = 500 },
            { name = "routeEntries", minimum = 6, maximum = 500 },
            { name = "transitions", minimum = 6, maximum = 500 },
            { name = "stages", minimum = 5, maximum = 50 },
            { name = "zones", minimum = 5, maximum = 128 },
        }
        for _, case in ipairs(collectionCases) do
            expect(not ManifestAdmissionV03.countWithin(case.name, case.minimum - 1), case.name .. " N-1 passed")
            expect(ManifestAdmissionV03.countWithin(case.name, case.minimum), case.name .. " minimum failed")
            expect(ManifestAdmissionV03.countWithin(case.name, case.maximum), case.name .. " maximum failed")
            expect(not ManifestAdmissionV03.countWithin(case.name, case.maximum + 1), case.name .. " N+1 passed")
        end
        expect(limits.checkpoints.maximum == 49, "checkpoint maximum changed")

        local admitted = loadValue(reference, reference.manifestHash)
        local required = admitted.requiredWorkUnits
        local rejected, rejection = loadValue(reference, reference.manifestHash, { maxWorkUnits = required - 1 })
        expect(rejected == nil and rejection.code == "work-limit", "work N-1 was admitted")
        local exact = loadValue(reference, reference.manifestHash, { maxWorkUnits = required })
        local extra = loadValue(reference, reference.manifestHash, { maxWorkUnits = required + 1 })
        expect(exact.structuralIdentity == extra.structuralIdentity, "work N/N+1 changed admitted identity")
    end)

    test("produces deterministic frozen lookup ordering and structural identity", function()
        local first = loadValue(clone(reference), reference.manifestHash)
        local second = loadValue(clone(reference), reference.manifestHash)
        expect(first.structuralIdentity == second.structuralIdentity, "admitted structure is nondeterministic")
        expect(
            #first.indexes.gameplayObjectIds == #reference.layers.gameplay.objects,
            "gameplay order index is incomplete"
        )
        for index, object in ipairs(reference.layers.gameplay.objects) do
            expect(first.indexes.gameplayObjectIds[index] == object.id, "gameplay lookup order changed")
        end
        expect(table.isfrozen(first.indexes.gameplayObjectIds), "ordered index is mutable")
    end)

    test("snapshot limits fail before semantic validation", function()
        local _, snapshotError = ManifestSnapshotV03.copy(reference, { maxEntries = 1 })
        expect(snapshotError.code == "snapshot-entry-limit", "snapshot entry limit was not enforced")
        local result, admissionError = loadValue(reference, reference.manifestHash, { maxSnapshotEntries = 1 })
        expect(result == nil and admissionError.code == "snapshot-entry-limit", "loader ignored snapshot limit")
    end)
end

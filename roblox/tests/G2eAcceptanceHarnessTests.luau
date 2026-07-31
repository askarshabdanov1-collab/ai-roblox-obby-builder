local G2eObservationV03 = require("../g2e/G2eObservationV03")
local G2eGameplayObservationV03 = require("../g2e/G2eGameplayObservationV03")
local G2eControlProtocol = require("../g2e/G2eControlProtocol")
local G2eAcceptanceRecordsV1 = require("../g2e/G2eAcceptanceRecordsV1")
local referenceManifest = require("../generated/G2ReferenceManifestV03")
local boundary20Manifest = require("../generated/G2Boundary20ManifestV03")
local boundary21Manifest = require("../generated/G2Boundary21ManifestV03")
local maximum50Manifest = require("../generated/G2Maximum50ManifestV03")

local function geometryObject(id, minimum, maximum)
    return {
        id = id,
        geometry = {
            axisAlignedBounds = {
                minimum = minimum,
                maximum = maximum,
            },
        },
    }
end

local function gameplayManifest(objects)
    return {
        manifestHash = "sha256:" .. string.rep("2", 64),
        layers = { gameplay = { objects = objects } },
    }
end

local function manifest()
    return {
        manifestHash = "sha256:" .. string.rep("1", 64),
        decorativeZones = {},
        navigation = {
            stages = {},
            routeEntries = {},
            reachability = {
                requiredTransitions = { { transitionId = "transition-1" } },
            },
        },
    }
end

local function counts()
    return {
        baseParts = 4,
        folders = 4,
        spawnLocations = 1,
    }
end

local function collections(overrides)
    local value = {
        observations = {},
        warnings = {},
        errors = {},
        evidence = { "scene-assertions" },
        requiredObservationIds = {},
        requiredEvidenceIds = { "scene-assertions" },
    }
    for key, fieldValue in pairs(overrides or {}) do
        value[key] = fieldValue
    end
    return value
end

local function buildWithCollections(collectionValue, manifestValue)
    return G2eObservationV03.build({
        fixtureId = "reference",
        manifest = manifestValue or manifest(),
        counts = counts(),
        collections = collectionValue,
    })
end

local function build(overrides, manifestValue)
    return buildWithCollections(collections(overrides), manifestValue)
end

local function mutableCopy(value)
    return table.clone(value)
end

return function(test, expect)
    test("defines deterministic official G2e run indices", function()
        local referenceRuns = G2eControlProtocol.referenceSequence()
        expect(#referenceRuns == 8, "reference sequence length changed")
        expect(referenceRuns[1].runKind == "cold" and referenceRuns[1].runIndex == 1, "cold index changed")
        for index = 1, 5 do
            local run = referenceRuns[index + 1]
            expect(run.runKind == "repeated" and run.runIndex == index, "reference repeated index changed")
        end
        expect(
            referenceRuns[7].runKind == "replacement" and referenceRuns[7].runIndex == 1,
            "first replacement index changed"
        )
        expect(
            referenceRuns[8].runKind == "replacement" and referenceRuns[8].runIndex == 2,
            "second replacement index changed"
        )
        local maximumRuns = G2eControlProtocol.maximumSequence()
        expect(#maximumRuns == 6 and maximumRuns[1].runKind == "cold", "maximum cold run changed")
        for index = 1, 5 do
            expect(maximumRuns[index + 1].runIndex == index, "maximum repeated index changed")
        end
    end)

    test("reserves cold evidence for the first build attempt in each server state", function()
        local state = G2eControlProtocol.newState()
        local first, firstError = state:claimCold("reference")
        expect(first ~= nil and firstError == nil and state:coldFixture() == "reference", "cold claim failed")
        local second, secondError = state:claimCold("maximum-50")
        expect(second == nil and secondError.status == "FAIL", "second cold claim was accepted")

        local manualState = G2eControlProtocol.newState()
        local manual = manualState:nextManual("wedge")
        expect(manual.runKind == "manual" and manual.runIndex == 1, "manual run label changed")
        local coldAfterManual, coldError = manualState:claimCold("reference")
        expect(coldAfterManual == nil and coldError.status == "FAIL", "manual build did not invalidate cold evidence")

        local freshState = G2eControlProtocol.newState()
        expect(freshState:claimCold("maximum-50") ~= nil, "fresh server state did not reset cold admission")
    end)

    test("returns only bounded acyclic control results", function()
        local success = G2eControlProtocol.invoke("Build", function()
            return G2eControlProtocol.success("Build", {
                fixtureId = "reference",
                runKind = "manual",
                runIndex = 1,
                recordCount = 1,
            })
        end)
        expect(success.status == "PASS" and G2eControlProtocol.validResult(success), "valid result was rejected")

        local cyclic = {}
        cyclic.self = cyclic
        local failure = G2eControlProtocol.invoke("Build", function()
            return cyclic
        end)
        expect(failure.status == "FAIL", "cyclic callback result crossed the control boundary")
        for _, key in ipairs({
            "schemaVersion",
            "status",
            "command",
            "fixtureId",
            "runKind",
            "runIndex",
            "recordCount",
            "diagnosticCode",
            "diagnosticField",
            "diagnosticMessage",
        }) do
            local kind = type(failure[key])
            expect(kind == "string" or kind == "number", "control result contains a non-primitive field")
        end
    end)

    test("sorts bounded part receipts and rejects ambiguous object IDs", function()
        local objects = {
            { objectId = "B", status = "PASS" },
            { objectId = "A", status = "PASS" },
        }
        local receipt = G2eAcceptanceRecordsV1.partInspection(
            string.rep("a", 40),
            "wedge",
            "sha256:" .. string.rep("b", 64),
            objects,
            { objectId = "_RuntimeSpawnLocation" },
            true
        )
        expect(receipt.status == "PASS" and receipt.objects[1].objectId == "A", "part receipt order changed")
        local ok = pcall(function()
            G2eAcceptanceRecordsV1.partInspection(
                string.rep("a", 40),
                "wedge",
                "sha256:" .. string.rep("b", 64),
                { { objectId = "A" }, { objectId = "A" } },
                {},
                true
            )
        end)
        expect(not ok, "ambiguous inspector object ID was accepted")
    end)

    test("keeps functional refusal and zero-checkpoint receipts fail closed", function()
        local repositoryCommit = string.rep("a", 40)
        local manifestHash = "sha256:" .. string.rep("b", 64)
        local progress = G2eAcceptanceRecordsV1.progress(repositoryCommit, manifestHash, {
            sameHashCheckpointPreserved = true,
            sameHashFinishPreserved = true,
            differentHashCheckpointCleared = true,
            differentHashFinishCleared = true,
            staleCharacterPlacementRejected = true,
            staleCheckpointRejected = true,
            staleKillRejected = true,
            staleFinishRejected = true,
            restoredReference = true,
        })
        expect(progress.status == "PASS", "complete progress receipt failed")
        local ownership = G2eAcceptanceRecordsV1.ownership(repositoryCommit, manifestHash, {
            { scenario = "unowned-root", status = "PASS" },
            { scenario = "ambiguous-roots", status = "FAIL" },
            { scenario = "other-version-root", status = "PASS" },
        }, true)
        expect(ownership.status == "FAIL", "failed ownership case reported PASS")
        local zero = G2eAcceptanceRecordsV1.zeroCheckpoint(repositoryCommit, manifestHash, {
            playerCount = 2,
            checkpointStateClear = true,
            checkpointAttributesClear = true,
            respawnsObserved = 2,
            spawnRespawnsObserved = 2,
        })
        expect(zero.status == "PASS", "complete zero-checkpoint receipt failed")
    end)

    test("finds no runtime-visible intersections in reference 20 21 and 50-stage fixtures", function()
        for _, value in ipairs({ referenceManifest, boundary20Manifest, boundary21Manifest, maximum50Manifest }) do
            local summary = G2eGameplayObservationV03.geometrySummary(value)
            expect(summary.unauthorizedGeometryIntersections == 0, "generated fixture contains penetration")
            expect(summary.coplanarVisibleSurfaces == 0, "generated fixture contains coplanar surfaces")
        end
    end)

    test("keeps final gameplay acceptance pending until every live observation exists", function()
        local value = G2eGameplayObservationV03.build(
            "reference",
            gameplayManifest({
                geometryObject("A", { x = 0, y = 0, z = 0 }, { x = 2, y = 2, z = 2 }),
                geometryObject("B", { x = 2, y = 0, z = 0 }, { x = 4, y = 2, z = 2 }),
            }),
            { hazardConnections = 1 }
        )
        expect(value.status == "FAIL", "missing live gameplay evidence reported PASS")
        expect(value.diagnosticCode == "gameplay-evidence-incomplete", "gameplay FAIL code changed")
        expect(value.diagnosticField == "hazard-touch-callback-fired", "first missing gameplay field changed")
        expect(value.unauthorizedGeometryIntersections == 0, "edge adjacency was rejected")
        expect(value.coplanarVisibleSurfaces == 0, "edge adjacency was called coplanar")
    end)

    test("keeps bounded gameplay evidence in deterministic diagnostic order", function()
        local value = G2eGameplayObservationV03.build(
            "reference",
            gameplayManifest({
                geometryObject("A", { x = 0, y = 0, z = 0 }, { x = 2, y = 1, z = 2 }),
                geometryObject("B", { x = 0, y = 1, z = 0 }, { x = 2, y = 2, z = 2 }),
            }),
            {}
        )
        local expectedIds = {
            "hazard-callback-bound",
            "hazard-touch-callback-fired",
            "valid-character-touch-observed",
            "humanoid-resolved",
            "lethal-action-observed",
            "expected-respawn-observed",
            "checkpoint-respawn-preserved",
            "initial-spawn-fallback-preserved",
            "second-player-independent",
            "stale-callback-rejected",
            "zero-stale-callback-actions",
            "zero-unauthorized-geometry-intersections",
            "zero-coplanar-visible-surfaces",
        }
        expect(#value.observations == #expectedIds, "gameplay observation count changed")
        for index, expectedId in ipairs(expectedIds) do
            expect(value.observations[index].id == expectedId, "gameplay evidence order changed")
        end
    end)

    test("passes bounded gameplay evidence only after two-player respawn and replacement", function()
        local value = G2eGameplayObservationV03.build(
            "reference",
            gameplayManifest({
                geometryObject("A", { x = 0, y = 0, z = 0 }, { x = 2, y = 1, z = 2 }),
                geometryObject("B", { x = 0, y = 1, z = 0 }, { x = 2, y = 2, z = 2 }),
            }),
            {
                hazardConnections = 1,
                hazardTouchCallbacks = 2,
                validCharacterTouches = 2,
                validHazardCharacterTouches = 2,
                humanoidsResolved = 2,
                lethalActions = 2,
                lethalPlayerCount = 2,
                respawnsObserved = 2,
                checkpointRespawnsObserved = 1,
                spawnRespawnsObserved = 1,
                staleCallbackRejections = 1,
                staleAcceptedActions = 0,
                replacementCount = 1,
            }
        )
        expect(value.status == "PASS", "complete bounded gameplay evidence did not pass")
        expect(value.checkedGeometryPairs == 1, "geometry work count changed")
    end)

    test("reports volumetric penetration and coplanar visible surfaces", function()
        local summary = G2eGameplayObservationV03.geometrySummary(gameplayManifest({
            geometryObject("A", { x = 0, y = 0, z = 0 }, { x = 4, y = 2, z = 4 }),
            geometryObject("B", { x = 1, y = 0, z = 0 }, { x = 5, y = 2, z = 4 }),
        }))
        expect(summary.unauthorizedGeometryIntersections == 1, "penetration was not reported")
        expect(summary.coplanarVisibleSurfaces == 1, "coplanar surface risk was not reported")
    end)

    test("reads required transitions from navigation reachability without the old nil crash", function()
        local observation = build()
        expect(observation.status == "PASS", "valid nested transition evidence failed")
        expect(observation.transitions == 1, "nested required-transition count changed")
    end)

    test("accepts an explicitly empty optional observation collection", function()
        local observation = build({ observations = {} })
        expect(observation.status == "PASS" and observation.observationCount == 0, "empty observations failed")
    end)

    test("accepts a nil optional observation collection without crashing", function()
        local collectionValue = collections()
        collectionValue.observations = nil
        local observation = buildWithCollections(collectionValue)
        expect(observation.status == "PASS" and observation.observationCount == 0, "nil observations failed")
    end)

    test("accepts populated successful bounded observations", function()
        local observation = build({
            observations = { { id = "scene-structure", status = "PASS" } },
            requiredObservationIds = { "scene-structure" },
        })
        expect(observation.status == "PASS" and observation.observationCount == 1, "successful observation failed")
    end)

    test("turns populated failed observations into a typed FAIL result", function()
        local observation = build({
            observations = { { id = "scene-structure", status = "FAIL" } },
            requiredObservationIds = { "scene-structure" },
        })
        expect(observation.status == "FAIL", "failed observation reported PASS")
        expect(observation.diagnosticCode == "acceptance-observation-failed", "failed observation code changed")
        expect(observation.diagnosticField == "scene-structure", "failed observation field changed")
    end)

    test("normalizes a nil warning collection explicitly", function()
        local collectionValue = collections()
        collectionValue.warnings = nil
        local observation = buildWithCollections(collectionValue)
        expect(observation.status == "PASS" and observation.warningCount == 0, "nil warning collection failed")
    end)

    test("normalizes a nil error collection explicitly", function()
        local collectionValue = collections()
        collectionValue.errors = nil
        local observation = buildWithCollections(collectionValue)
        expect(observation.status == "PASS" and observation.errorCount == 0, "nil error collection failed")
    end)

    test("orders successful measurement emission before observation emission", function()
        local measurement = { schemaVersion = "g2-studio-measurement-v1" }
        local observation = build()
        local records = G2eObservationV03.orderedRecords(measurement, observation)
        expect(records[1].kind == "measurement" and records[1].payload == measurement, "measurement was not first")
        expect(
            records[2].kind == "observation" and records[2].payload.status == observation.status,
            "observation was not second"
        )
    end)

    test("reports missing required observations as a typed FAIL", function()
        local observation = build({ observations = nil, requiredObservationIds = { "two-player-ready" } })
        expect(observation.status == "FAIL", "missing required observation reported PASS")
        expect(observation.diagnosticCode == "acceptance-required-observation", "missing observation code changed")
        expect(observation.diagnosticField == "two-player-ready", "missing observation field changed")
    end)

    test("reports missing required evidence as a typed FAIL", function()
        local observation = build({ evidence = {}, requiredEvidenceIds = { "scene-assertions" } })
        expect(observation.status == "FAIL", "missing required evidence reported PASS")
        expect(observation.diagnosticCode == "acceptance-required-evidence", "missing evidence code changed")
        expect(observation.diagnosticField == "scene-assertions", "missing evidence field changed")
    end)

    test("formats a PASS observation without reading its absent diagnostics", function()
        local observation = build()
        expect(observation.diagnosticCode == nil, "PASS unexpectedly acquired a diagnostic code")
        local ok, passed, message, normalized = pcall(G2eObservationV03.formatResult, observation)
        expect(ok, "PASS observation reproduced the nil string.format crash")
        expect(passed == true and message == "none", "PASS formatting result changed")
        expect(normalized.status == "PASS", "valid PASS observation was rejected")
    end)

    test("validates every required PASS observation field", function()
        local passed, _, normalized = G2eObservationV03.formatResult(build())
        expect(passed == true, "complete PASS observation was rejected")
        expect(normalized.schemaVersion == "g2-acceptance-observation-v1", "schema version changed")
        expect(normalized.fixtureId == "reference", "fixture identity changed")
        expect(normalized.manifestHash == manifest().manifestHash, "manifest identity changed")
    end)

    test("formats a FAIL observation with bounded code and field", function()
        local observation = build({
            observations = { { id = "scene-structure", status = "FAIL" } },
        })
        local passed, message, normalized = G2eObservationV03.formatResult(observation)
        expect(passed == false and normalized.status == "FAIL", "FAIL observation reported PASS")
        expect(string.find(message, "code=acceptance-observation-failed", 1, true) ~= nil, "code was omitted")
        expect(string.find(message, "field=scene-structure", 1, true) ~= nil, "field was omitted")
    end)

    test("uses an explicit placeholder for a missing optional diagnostic message", function()
        local observation = build({
            observations = { { id = "scene-structure", status = "FAIL" } },
        })
        local passed, message = G2eObservationV03.formatResult(observation)
        expect(passed == false, "FAIL observation reported PASS")
        expect(string.find(message, "message=none", 1, true) ~= nil, "optional message placeholder changed")
    end)

    test("turns a missing required status into a typed FAIL", function()
        local observation = mutableCopy(build())
        observation.status = nil
        local passed, message, normalized = G2eObservationV03.formatResult(observation)
        expect(passed == false, "missing status reported PASS")
        expect(normalized.diagnosticCode == "acceptance-result-shape", "missing status code changed")
        expect(normalized.diagnosticField == "status", "missing status field changed")
        expect(type(message) == "string", "missing status did not produce a safe message")
    end)

    test("turns a missing required diagnostic code into a typed FAIL", function()
        local observation = mutableCopy(build({
            observations = { { id = "scene-structure", status = "FAIL" } },
        }))
        observation.diagnosticCode = nil
        local passed, _, normalized = G2eObservationV03.formatResult(observation)
        expect(passed == false, "missing diagnostic code reported PASS")
        expect(normalized.diagnosticCode == "acceptance-result-shape", "replacement diagnostic code changed")
        expect(normalized.diagnosticField == "diagnosticCode", "missing diagnostic-code field changed")
    end)

    test("turns a missing required diagnostic field into a typed FAIL", function()
        local observation = mutableCopy(build({
            observations = { { id = "scene-structure", status = "FAIL" } },
        }))
        observation.diagnosticField = nil
        local passed, _, normalized = G2eObservationV03.formatResult(observation)
        expect(passed == false, "missing diagnostic field reported PASS")
        expect(normalized.diagnosticCode == "acceptance-result-shape", "replacement diagnostic code changed")
        expect(normalized.diagnosticField == "diagnosticField", "missing diagnostic-field result changed")
    end)

    test("formats every supported observation result shape without crashing", function()
        local hostileMetatable = setmetatable({}, {
            __index = function()
                error("result fields must not be read")
            end,
        })
        local shapes = {
            {},
            build(),
            build({ observations = { { id = "scene-structure", status = "FAIL" } } }),
            { status = "PASS" },
            { status = "FAIL" },
            "invalid",
            hostileMetatable,
        }
        for _, shape in ipairs(shapes) do
            local ok, passed, message, normalized = pcall(G2eObservationV03.formatResult, shape)
            expect(ok, "supported result shape crashed diagnostic formatting")
            expect(type(passed) == "boolean", "formatting did not return a boolean")
            expect(type(message) == "string", "formatting did not return a safe string")
            expect(type(normalized) == "table", "formatting did not return a bounded result")
        end
        local ok, _, message = pcall(G2eObservationV03.formatResult, nil)
        expect(ok and type(message) == "string", "nil result crashed diagnostic formatting")
    end)

    test("bounds diagnostic message text before formatting or concatenation", function()
        local observation = mutableCopy(build({
            observations = { { id = "scene-structure", status = "FAIL" } },
        }))
        observation.diagnosticMessage = string.rep("x", 500)
        local passed, message, normalized = G2eObservationV03.formatResult(observation)
        expect(passed == false, "FAIL observation reported PASS")
        expect(#normalized.diagnosticMessage <= 160, "diagnostic message was not bounded")
        expect(#message <= 360, "formatted diagnostic was not bounded")
    end)

    test("never crashes for supported nil empty populated or malformed bounded collection shapes", function()
        local nilOk, nilObservation = pcall(function()
            return G2eObservationV03.build({
                fixtureId = "reference",
                manifest = manifest(),
                counts = counts(),
                collections = nil,
            })
        end)
        expect(nilOk and type(nilObservation) == "table", "nil collection shape crashed the harness")
        for _, collectionValue in ipairs({
            {},
            collections(),
            { observations = "invalid", warnings = 3, errors = false, evidence = "invalid" },
            { observations = { { id = "x", status = "MAYBE" } } },
        }) do
            local ok, observation = pcall(function()
                return G2eObservationV03.build({
                    fixtureId = "reference",
                    manifest = manifest(),
                    counts = counts(),
                    collections = collectionValue,
                })
            end)
            expect(ok and type(observation) == "table", "bounded collection shape crashed the harness")
            if collectionValue ~= nil and collectionValue.observations == "invalid" then
                expect(observation.status == "FAIL", "malformed collections reported PASS")
            end
        end
    end)
end

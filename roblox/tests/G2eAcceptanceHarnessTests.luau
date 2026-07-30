local G2eObservationV03 = require("../g2e/G2eObservationV03")

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

return function(test, expect)
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
        expect(records[2].kind == "observation" and records[2].payload == observation, "observation was not second")
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

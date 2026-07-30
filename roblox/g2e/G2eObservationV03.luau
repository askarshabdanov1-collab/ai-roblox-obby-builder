local G2eObservationV03 = {}

local MAX_COLLECTION_ITEMS = 64
local MAX_MANIFEST_ITEMS = 1000
local MAX_IDENTIFIER_LENGTH = 80

local function appendDiagnostic(diagnostics, code, field)
    if diagnostics[1] == nil then
        diagnostics[1] = {
            code = code,
            field = field,
        }
    end
end

local function boundedIdentifier(value)
    if type(value) ~= "string" or value == "" then
        return nil
    end
    return string.sub(value, 1, MAX_IDENTIFIER_LENGTH)
end

local function arrayLength(value, maximum)
    if type(value) ~= "table" or getmetatable(value) ~= nil then
        return nil
    end
    local count = 0
    for key in pairs(value) do
        if type(key) ~= "number" or key < 1 or key ~= math.floor(key) or key > maximum then
            return nil
        end
        count += 1
    end
    for index = 1, count do
        if rawget(value, index) == nil then
            return nil
        end
    end
    return count
end

local function normalizeStringCollection(value, field, diagnostics)
    if value == nil then
        return {}, 0
    end
    local count = arrayLength(value, MAX_COLLECTION_ITEMS)
    if count == nil then
        appendDiagnostic(diagnostics, "acceptance-collection-shape", field)
        return {}, 0
    end
    local normalized = {}
    for index = 1, count do
        local item = boundedIdentifier(value[index])
        if item == nil then
            appendDiagnostic(diagnostics, "acceptance-collection-shape", field)
            return {}, 0
        end
        normalized[index] = item
    end
    return normalized, count
end

local function normalizeObservations(value, diagnostics)
    if value == nil then
        return {}, {}, 0
    end
    local count = arrayLength(value, MAX_COLLECTION_ITEMS)
    if count == nil then
        appendDiagnostic(diagnostics, "acceptance-collection-shape", "observations")
        return {}, {}, 0
    end
    local normalized = {}
    local statusById = {}
    for index = 1, count do
        local item = value[index]
        local id = if type(item) == "table" then boundedIdentifier(item.id) else nil
        local status = if type(item) == "table" then item.status else nil
        if id == nil or (status ~= "PASS" and status ~= "FAIL") or statusById[id] ~= nil then
            appendDiagnostic(diagnostics, "acceptance-collection-shape", "observations")
            return {}, {}, 0
        end
        normalized[index] = {
            id = id,
            status = status,
        }
        statusById[id] = status
        if status == "FAIL" then
            appendDiagnostic(diagnostics, "acceptance-observation-failed", id)
        end
    end
    return normalized, statusById, count
end

local function requireIds(requiredIds, availableById, code, diagnostics)
    for _, id in ipairs(requiredIds) do
        if availableById[id] ~= "PASS" and availableById[id] ~= true then
            appendDiagnostic(diagnostics, code, id)
            return
        end
    end
end

local function requiredArrayCount(value, field, diagnostics)
    local count = arrayLength(value, MAX_MANIFEST_ITEMS)
    if count == nil then
        appendDiagnostic(diagnostics, "acceptance-required-collection", field)
        return 0
    end
    return count
end

local function requiredNumber(value, field, diagnostics)
    if type(value) ~= "number" or value ~= value or value < 0 or value == math.huge then
        appendDiagnostic(diagnostics, "acceptance-result-shape", field)
        return 0
    end
    return value
end

function G2eObservationV03.build(context)
    context = if type(context) == "table" then context else {}
    local manifest = if type(context.manifest) == "table" then context.manifest else {}
    local navigation = if type(manifest.navigation) == "table" then manifest.navigation else {}
    local reachability = if type(navigation.reachability) == "table" then navigation.reachability else {}
    local counts = if type(context.counts) == "table" then context.counts else {}
    local collections = if type(context.collections) == "table" then context.collections else {}
    local diagnostics = {}

    local _, observationStatusById, observationCount = normalizeObservations(collections.observations, diagnostics)
    local _, warningCount = normalizeStringCollection(collections.warnings, "warnings", diagnostics)
    local _, errorCount = normalizeStringCollection(collections.errors, "errors", diagnostics)
    local evidence, evidenceCount = normalizeStringCollection(collections.evidence, "evidence", diagnostics)
    local requiredObservationIds =
        normalizeStringCollection(collections.requiredObservationIds, "requiredObservationIds", diagnostics)
    local requiredEvidenceIds =
        normalizeStringCollection(collections.requiredEvidenceIds, "requiredEvidenceIds", diagnostics)

    local evidenceById = {}
    for _, evidenceId in ipairs(evidence) do
        evidenceById[evidenceId] = true
    end
    requireIds(requiredObservationIds, observationStatusById, "acceptance-required-observation", diagnostics)
    requireIds(requiredEvidenceIds, evidenceById, "acceptance-required-evidence", diagnostics)
    if errorCount > 0 then
        appendDiagnostic(diagnostics, "acceptance-errors-present", "errors")
    end

    local observation = {
        schemaVersion = "g2-acceptance-observation-v1",
        fixtureId = boundedIdentifier(context.fixtureId) or "invalid",
        manifestHash = boundedIdentifier(manifest.manifestHash) or "invalid",
        stages = requiredArrayCount(navigation.stages, "navigation.stages", diagnostics),
        zones = requiredArrayCount(manifest.decorativeZones, "decorativeZones", diagnostics),
        routeEntries = requiredArrayCount(navigation.routeEntries, "navigation.routeEntries", diagnostics),
        transitions = requiredArrayCount(
            reachability.requiredTransitions,
            "navigation.reachability.requiredTransitions",
            diagnostics
        ),
        baseParts = requiredNumber(counts.baseParts, "counts.baseParts", diagnostics),
        containers = requiredNumber(counts.folders, "counts.folders", diagnostics),
        helperSpawnLocations = requiredNumber(counts.spawnLocations, "counts.spawnLocations", diagnostics),
        observationCount = observationCount,
        warningCount = warningCount,
        errorCount = errorCount,
        evidenceCount = evidenceCount,
        status = "PASS",
    }
    local diagnostic = diagnostics[1]
    if diagnostic ~= nil then
        observation.status = "FAIL"
        observation.diagnosticCode = diagnostic.code
        observation.diagnosticField = diagnostic.field
    end
    return table.freeze(observation)
end

function G2eObservationV03.orderedRecords(measurement, observation)
    local safeMeasurement = if type(measurement) == "table"
        then measurement
        else table.freeze({ schemaVersion = "g2-studio-measurement-v1", status = "INVALID" })
    local safeObservation = if type(observation) == "table"
        then observation
        else table.freeze({
            schemaVersion = "g2-acceptance-observation-v1",
            status = "FAIL",
            diagnosticCode = "acceptance-result-shape",
            diagnosticField = "observation",
        })
    return table.freeze({
        table.freeze({ kind = "measurement", payload = safeMeasurement }),
        table.freeze({ kind = "observation", payload = safeObservation }),
    })
end

return table.freeze(G2eObservationV03)

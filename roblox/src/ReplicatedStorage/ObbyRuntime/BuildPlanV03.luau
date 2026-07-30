local BuildPlanV03 = {}

local PLAN_VERSION = "g2c-build-plan-v1"
local OWNER_VALUE = "AIObbyBuilder/0.3"
local MAX_MANIFEST_PARTS = 757
local CONTAINER_COUNT = 5

local function failure(code, message)
    return nil, table.freeze({
        code = code,
        message = message,
    })
end

local function appendIdentity(parts, value)
    local text = tostring(value)
    table.insert(parts, string.format("%d:%s", #text, text))
end

local function constructionAttributes(manifest, object, layer)
    return table.freeze({
        ObjectId = object.id,
        Layer = layer,
        Role = object.role,
        ZoneId = object.zoneId,
        SceneId = manifest.sceneId,
        ManifestHash = manifest.manifestHash,
        SchemaVersion = manifest.schemaVersion,
    })
end

local function gameplayRecord(manifest, object)
    return table.freeze({
        id = object.id,
        layer = "gameplay",
        order = object.order,
        role = object.role,
        className = object.className,
        shape = object.shape,
        transform = object.transform,
        size = object.size,
        collision = object.collision,
        appearance = object.appearance,
        sourceReferences = object.sourceReferences,
        geometry = object.geometry,
        behavior = object.behavior,
        diagnosticAttributes = constructionAttributes(manifest, object, "gameplay"),
    })
end

local function decorativeRecord(manifest, object)
    return table.freeze({
        id = object.id,
        layer = "decorative",
        zoneId = object.zoneId,
        className = object.className,
        shape = object.shape,
        transform = object.transform,
        size = object.size,
        collision = object.collision,
        appearance = object.appearance,
        diagnosticAttributes = constructionAttributes(manifest, object, "decorative"),
    })
end

local function helperSpawnRecord(manifest, spawn)
    return table.freeze({
        id = "_RuntimeSpawnLocation",
        layer = "helper",
        role = "spawn-helper",
        className = "SpawnLocation",
        shape = "Block",
        transform = spawn.transform,
        size = spawn.size,
        collision = table.freeze({
            anchored = true,
            canCollide = false,
            canTouch = false,
            canQuery = false,
        }),
        appearance = spawn.appearance,
        transparency = 1,
        nonAuthoritative = true,
        neutral = true,
        enabled = true,
        duration = 0,
        diagnosticAttributes = table.freeze({
            Layer = "helper",
            Role = "spawn-helper",
            SceneId = manifest.sceneId,
            ManifestHash = manifest.manifestHash,
            SchemaVersion = manifest.schemaVersion,
            NonAuthoritative = true,
        }),
    })
end

local function admittedResult(value)
    return type(value) == "table"
        and table.isfrozen(value)
        and value.hashTrust == "repository-module-expected-hash-v1"
        and type(value.structuralIdentity) == "string"
        and type(value.requiredWorkUnits) == "number"
        and type(value.manifest) == "table"
        and table.isfrozen(value.manifest)
        and value.manifest.schemaVersion == "0.3"
        and type(value.indexes) == "table"
        and table.isfrozen(value.indexes)
end

function BuildPlanV03.create(admitted)
    if not admittedResult(admitted) then
        return failure("plan-admission", "build planning requires an admitted immutable SceneManifest 0.3")
    end

    local manifest = admitted.manifest
    local indexes = admitted.indexes
    local gameplay = manifest.layers.gameplay.objects
    local decorative = manifest.layers.decorative.objects
    if
        #gameplay ~= #indexes.gameplayObjectIds
        or #decorative ~= #indexes.decorativeObjectIds
        or #manifest.decorativeZones ~= #indexes.zoneIds
        or #manifest.navigation.safeRouteObjectIds ~= #indexes.safeRouteObjectIds
    then
        return failure("plan-index-closure", "admitted manifest indexes are incomplete")
    end

    local manifestPartCount = #gameplay + #decorative
    if manifestPartCount > MAX_MANIFEST_PARTS then
        return failure("plan-part-limit", "manifest exceeds the native-Part construction limit")
    end

    local gameplayRecords = {}
    local decorativeRecords = {}
    local identity = {}
    appendIdentity(identity, PLAN_VERSION)
    appendIdentity(identity, manifest.schemaVersion)
    appendIdentity(identity, manifest.manifestHash)

    for index, object in ipairs(gameplay) do
        if object.id ~= indexes.gameplayObjectIds[index] then
            return failure("plan-index-closure", "gameplay index order does not match the manifest")
        end
        gameplayRecords[index] = gameplayRecord(manifest, object)
        appendIdentity(identity, "gameplay")
        appendIdentity(identity, object.id)
    end
    for index, object in ipairs(decorative) do
        if object.id ~= indexes.decorativeObjectIds[index] then
            return failure("plan-index-closure", "decorative index order does not match the manifest")
        end
        decorativeRecords[index] = decorativeRecord(manifest, object)
        appendIdentity(identity, "decorative")
        appendIdentity(identity, object.id)
    end

    local spawn = gameplay[1]
    if spawn == nil or spawn.id ~= "Spawn" or spawn.role ~= "spawn" then
        return failure("plan-spawn", "admitted manifest has no authoritative Spawn Part")
    end
    local helper = helperSpawnRecord(manifest, spawn)
    appendIdentity(identity, "helper")
    appendIdentity(identity, helper.id)

    local totalPartCount = manifestPartCount + 1
    local counts = table.freeze({
        gameplayParts = #gameplay,
        decorativeParts = #decorative,
        manifestParts = manifestPartCount,
        helperParts = 1,
        totalParts = totalPartCount,
        containers = CONTAINER_COUNT,
        totalInstances = totalPartCount + CONTAINER_COUNT,
    })
    local ownership = table.freeze({
        rootName = "GeneratedObby",
        candidateName = "_GeneratedObbyCandidate",
        retiredName = "_GeneratedObbyRetired",
        generatedBy = OWNER_VALUE,
        schemaVersion = manifest.schemaVersion,
        sceneId = manifest.sceneId,
        manifestHash = manifest.manifestHash,
    })
    local containers = table.freeze({
        gameplay = "Gameplay",
        decorative = "Decorative",
        helpers = "RuntimeInfrastructure",
        metadata = "Metadata",
    })
    local navigation = table.freeze({
        safeRouteObjectIds = indexes.safeRouteObjectIds,
        zoneIds = indexes.zoneIds,
    })

    return table.freeze({
        planVersion = PLAN_VERSION,
        schemaVersion = manifest.schemaVersion,
        sceneId = manifest.sceneId,
        manifestHash = manifest.manifestHash,
        admittedStructuralIdentity = admitted.structuralIdentity,
        structuralIdentity = table.concat(identity, "|"),
        ownership = ownership,
        containers = containers,
        navigation = navigation,
        counts = counts,
        requiredAdmissionWorkUnits = admitted.requiredWorkUnits,
        gameplayRecords = table.freeze(gameplayRecords),
        decorativeRecords = table.freeze(decorativeRecords),
        helperSpawnRecord = helper,
    }),
        nil
end

BuildPlanV03.MAX_MANIFEST_PARTS = MAX_MANIFEST_PARTS
BuildPlanV03.CONTAINER_COUNT = CONTAINER_COUNT

return table.freeze(BuildPlanV03)

local ManifestIndexesV03 = {}

local function appendIdentity(parts, value)
    table.insert(parts, string.format("%d:%s", #value, value))
end

local function freezeArray(array)
    return table.freeze(array)
end

function ManifestIndexesV03.create(manifest)
    local gameplayById = {}
    local decorativeById = {}
    local zoneById = {}
    local stageById = {}
    local routePositionByObjectId = {}
    local gameplayObjectIds = {}
    local decorativeObjectIds = {}
    local zoneIds = {}
    local stageIds = {}
    local safeRouteObjectIds = {}
    local identity = {}

    appendIdentity(identity, manifest.schemaVersion)
    appendIdentity(identity, manifest.manifestHash)
    for index, object in ipairs(manifest.layers.gameplay.objects) do
        gameplayById[object.id] = object
        gameplayObjectIds[index] = object.id
        appendIdentity(identity, object.id)
    end
    for index, object in ipairs(manifest.layers.decorative.objects) do
        decorativeById[object.id] = object
        decorativeObjectIds[index] = object.id
        appendIdentity(identity, object.id)
    end
    for index, zone in ipairs(manifest.decorativeZones) do
        zoneById[zone.zoneId] = zone
        zoneIds[index] = zone.zoneId
        appendIdentity(identity, zone.zoneId)
    end
    for index, stage in ipairs(manifest.navigation.stages) do
        stageById[stage.stageId] = stage
        stageIds[index] = stage.stageId
        appendIdentity(identity, stage.stageId)
    end
    for index, objectId in ipairs(manifest.navigation.safeRouteObjectIds) do
        safeRouteObjectIds[index] = objectId
        routePositionByObjectId[objectId] = index
        appendIdentity(identity, objectId)
    end

    return table.freeze({
        gameplayById = table.freeze(gameplayById),
        decorativeById = table.freeze(decorativeById),
        zoneById = table.freeze(zoneById),
        stageById = table.freeze(stageById),
        routePositionByObjectId = table.freeze(routePositionByObjectId),
        gameplayObjectIds = freezeArray(gameplayObjectIds),
        decorativeObjectIds = freezeArray(decorativeObjectIds),
        zoneIds = freezeArray(zoneIds),
        stageIds = freezeArray(stageIds),
        safeRouteObjectIds = freezeArray(safeRouteObjectIds),
    }),
        table.concat(identity, "|")
end

return table.freeze(ManifestIndexesV03)

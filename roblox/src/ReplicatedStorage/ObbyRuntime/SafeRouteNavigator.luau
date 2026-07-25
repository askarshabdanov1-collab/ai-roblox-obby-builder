local SafeRouteNavigator = {}
SafeRouteNavigator.__index = SafeRouteNavigator

function SafeRouteNavigator.new(manifest)
    local objectsById = {}
    local spawnObject = nil
    for _, object in ipairs(manifest.layers.gameplay.objects) do
        objectsById[object.id] = object
        if object.role == "spawn" then
            spawnObject = object
        end
    end
    if spawnObject == nil then
        error("safe-route navigation requires a spawn object")
    end

    local nextByObjectId = {}
    local previousObject = spawnObject
    for _, objectId in ipairs(manifest.navigation.safeRouteObjectIds) do
        local object = objectsById[objectId]
        if object == nil or object.role == "spawn" or object.role == "kill" or object.role == "decoration" then
            error(string.format("safe route target %s is missing or unsafe", tostring(objectId)))
        end
        nextByObjectId[previousObject.id] = object
        previousObject = object
    end

    return setmetatable({
        nextByObjectId = nextByObjectId,
    }, SafeRouteNavigator)
end

function SafeRouteNavigator:nextObject(sourceObjectId)
    return self.nextByObjectId[sourceObjectId]
end

return SafeRouteNavigator

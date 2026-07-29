local ManifestValidatorV03 = {}

local ROLES = { spawn = true, platform = true, checkpoint = true, kill = true, finish = true }
local SHAPES = { Block = true, Ball = true, Cylinder = true, Wedge = true }
local SURFACES = {
    ["planar-face"] = true,
    ["wedge-slope"] = true,
    ["curved-surface"] = true,
    ["circular-endcap"] = true,
}

local function fail(message)
    return false, message
end

local function hash(value)
    return type(value) == "string" and #value == 71 and string.match(value, "^sha256:[0-9a-f]+$") ~= nil
end

local function vector(value, positive, limit)
    if type(value) ~= "table" then
        return false
    end
    for _, axis in ipairs({ "x", "y", "z" }) do
        local component = value[axis]
        if type(component) ~= "number" or component ~= component or math.abs(component) == math.huge then
            return false
        end
        if positive and component <= 0 then
            return false
        end
        if limit ~= nil and math.abs(component) > limit then
            return false
        end
    end
    return true
end

local function bounds(value)
    if type(value) ~= "table" or not vector(value.minimum, false, 2048) or not vector(value.maximum, false, 2048) then
        return false
    end
    for _, axis in ipairs({ "x", "y", "z" }) do
        if value.minimum[axis] >= value.maximum[axis] then
            return false
        end
    end
    return true
end

local function validateSourceReferences(value)
    return type(value) == "table" and type(value.sourceAssetIntentIds) == "table"
end

local function validateGeometry(value)
    return type(value) == "table"
        and value.methodId == "geometry-evaluator-v0.1"
        and hash(value.normalizedGeometryHash)
        and bounds(value.axisAlignedBounds)
        and type(value.topSurfaceMaximumY) == "number"
        and SURFACES[value.surfaceKind] == true
end

local function validateBehavior(object, expectedCheckpointOrder)
    local behavior = object.behavior
    if type(behavior) ~= "table" then
        return false
    end
    if object.role == "checkpoint" then
        return behavior.kind == "checkpoint" and behavior.checkpointOrder == expectedCheckpointOrder
    elseif object.role == "kill" then
        return behavior.kind == "kill" and behavior.killMode == "touch"
    elseif object.role == "finish" then
        return behavior.kind == "finish"
    end
    return behavior.kind == "none"
end

local function validateObject(object, index, expectedCheckpointOrder)
    if type(object) ~= "table" or object.order ~= index - 1 or type(object.id) ~= "string" then
        return false
    end
    if
        not ROLES[object.role]
        or object.authority ~= "native-gameplay"
        or object.className ~= "Part"
        or not SHAPES[object.shape]
    then
        return false
    end
    if
        not validateSourceReferences(object.sourceReferences)
        or type(object.transform) ~= "table"
        or not vector(object.transform.position, false, 2048)
        or not vector(object.transform.rotation, false, 360)
        or not vector(object.size, true, 256)
        or type(object.collision) ~= "table"
        or object.collision.anchored ~= true
        or object.collision.canQuery ~= true
        or type(object.collision.canCollide) ~= "boolean"
        or type(object.collision.canTouch) ~= "boolean"
        or type(object.appearance) ~= "table"
        or type(object.appearance.color) ~= "string"
        or not validateGeometry(object.geometry)
    then
        return false
    end
    if
        (object.role == "spawn" or object.role == "checkpoint")
        and (object.transform.rotation.x ~= 0 or object.transform.rotation.z ~= 0)
    then
        return false
    end
    return validateBehavior(object, expectedCheckpointOrder)
end

local function validateTransition(transition, index, route)
    if type(transition) ~= "table" then
        return false
    end
    local fromId = if index == 1 then "Spawn" else route[index - 1]
    if
        transition.transitionId ~= string.format("layout-transition-%03d", index)
        or transition.fromObjectId ~= fromId
        or transition.toObjectId ~= route[index]
        or transition.fromGlobalOrder ~= index - 1
        or transition.toGlobalOrder ~= index
        or transition.outcome ~= "feasible-under-model"
        or not hash(transition.normalizedInputHash)
    then
        return false
    end
    for _, field in ipairs({ "horizontalSeparation", "verticalRise", "downwardDrop" }) do
        local measurement = transition[field]
        if
            type(measurement) ~= "table"
            or measurement.status ~= "available"
            or type(measurement.value) ~= "number"
            or measurement.value < 0
        then
            return false
        end
    end
    return type(transition.landingRegion) == "table"
        and transition.landingRegion.status == "available"
        and type(transition.limitations) == "table"
        and #transition.limitations > 0
end

local function validateNavigation(manifest, objects)
    local navigation = manifest.navigation
    if type(navigation) ~= "table" or navigation.spawnObjectId ~= "Spawn" or navigation.finishObjectId ~= "Finish" then
        return fail("navigation endpoints are invalid")
    end
    local route = navigation.safeRouteObjectIds
    if type(route) ~= "table" or #route < 6 or #route > 500 or route[#route] ~= "Finish" then
        return fail("safe route has invalid bounds or finish order")
    end
    local routed = {}
    for index, id in ipairs(route) do
        local object = objects[id]
        if object == nil or object.role == "spawn" or object.role == "kill" or routed[id] then
            return fail(string.format("safe route endpoint %d is invalid", index))
        end
        routed[id] = true
        local entry = navigation.routeEntries[index]
        if type(entry) ~= "table" or entry.globalOrder ~= index or entry.objectId ~= id then
            return fail(string.format("route entry %d is invalid", index))
        end
    end
    for id, object in pairs(objects) do
        local shouldRoute = object.role == "platform" or object.role == "checkpoint" or object.role == "finish"
        if shouldRoute ~= (routed[id] == true) then
            return fail("safe route does not exactly cover safe gameplay")
        end
    end
    if type(navigation.stages) ~= "table" or #navigation.stages < 5 or #navigation.stages > 50 then
        return fail("navigation stage count is invalid")
    end
    local flattened = {}
    for index, stage in ipairs(navigation.stages) do
        if
            type(stage) ~= "table"
            or stage.order ~= index
            or type(stage.safeRouteObjectIds) ~= "table"
            or #stage.safeRouteObjectIds < 1
        then
            return fail(string.format("navigation stage %d is invalid", index))
        end
        for _, id in ipairs(stage.safeRouteObjectIds) do
            table.insert(flattened, id)
        end
    end
    if #flattened ~= #route then
        return fail("navigation stages do not close the global route")
    end
    for index, id in ipairs(route) do
        if flattened[index] ~= id then
            return fail("navigation stage route order differs from the global route")
        end
    end
    local reachability = navigation.reachability
    if
        type(reachability) ~= "table"
        or reachability.overallOutcome ~= "feasible-under-model"
        or reachability.modelId ~= "e1-coarse-surface-transition-v1"
        or reachability.methodId ~= "coarse-transition-classifier"
        or reachability.methodVersion ~= "2.0.0"
        or type(reachability.requiredTransitions) ~= "table"
        or #reachability.requiredTransitions ~= #route
    then
        return fail("reachability authority or coverage is invalid")
    end
    for index, transition in ipairs(reachability.requiredTransitions) do
        if not validateTransition(transition, index, route) then
            return fail(string.format("required transition %d is invalid", index))
        end
    end
    return true, nil
end

function ManifestValidatorV03.validate(manifest)
    if type(manifest) ~= "table" then
        return fail("manifest must be a table")
    end
    if
        manifest.schemaVersion ~= "0.3"
        or manifest.generatorVersion ~= "0.3.0"
        or manifest.projectionVersion ~= "g1c-layout-projection-v1"
        or not hash(manifest.manifestHash)
        or not hash(manifest.sourcePlaceSpecHash)
        or not hash(manifest.seedIdentity)
    then
        return fail("manifest version or identity is invalid")
    end
    if not bounds(manifest.worldBounds) or type(manifest.provenance) ~= "table" then
        return fail("manifest bounds or provenance are invalid")
    end
    if
        not hash(manifest.provenance.generationBundleHash)
        or not hash(manifest.provenance.obbySpecHash)
        or not hash(manifest.provenance.layoutBundleHash)
        or not hash(manifest.provenance.layoutSpecHash)
    then
        return fail("manifest provenance hashes are invalid")
    end
    local layers = manifest.layers
    if
        type(layers) ~= "table"
        or type(layers.gameplay) ~= "table"
        or type(layers.gameplay.objects) ~= "table"
        or #layers.gameplay.objects < 7
        or #layers.gameplay.objects > 501
        or type(layers.decorative) ~= "table"
        or type(layers.decorative.objects) ~= "table"
    then
        return fail("manifest layers are invalid")
    end
    local ids = {}
    local checkpointOrder = 1
    for index, object in ipairs(layers.gameplay.objects) do
        if ids[object.id] or not validateObject(object, index, checkpointOrder) then
            return fail(string.format("gameplay object %d is invalid", index))
        end
        ids[object.id] = object
        if object.role == "checkpoint" then
            checkpointOrder += 1
        end
    end
    if ids.Spawn == nil or ids.Spawn.role ~= "spawn" or ids.Finish == nil or ids.Finish.role ~= "finish" then
        return fail("exactly named Spawn and Finish objects are required")
    end
    for _, object in ipairs(layers.decorative.objects) do
        if
            type(object) ~= "table"
            or ids[object.id]
            or type(object.collision) ~= "table"
            or object.collision.canCollide ~= false
            or object.collision.canTouch ~= false
            or object.collision.canQuery ~= false
        then
            return fail("decorative object is invalid or collision-enabled")
        end
    end
    if
        type(manifest.decorativeZones) ~= "table"
        or #manifest.decorativeZones < 5
        or #manifest.decorativeZones > 128
    then
        return fail("decorative zone count is invalid")
    end
    return validateNavigation(manifest, ids)
end

return ManifestValidatorV03

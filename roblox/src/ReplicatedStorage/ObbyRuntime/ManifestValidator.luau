local ManifestValidator = {}

local EXPECTED_SCHEMA_VERSION = "0.2"
local EXPECTED_GENERATOR_VERSION = "0.2.0"
local SUPPORTED_ROLES = {
    spawn = true,
    platform = true,
    checkpoint = true,
    kill = true,
    finish = true,
}
local SUPPORTED_SHAPES = {
    Block = true,
    Ball = true,
    Cylinder = true,
    Wedge = true,
}
local SUPPORTED_MATERIALS = {
    SmoothPlastic = true,
    Plastic = true,
    Metal = true,
    Neon = true,
    Concrete = true,
    Wood = true,
}
local SUPPORTED_COLOR_ROLES = {
    primary = true,
    secondary = true,
    reward = true,
    hazard = true,
}

local function fail(message)
    return false, message
end

local function validHash(value)
    return type(value) == "string" and #value == 71 and string.match(value, "^sha256:[0-9a-f]+$") ~= nil
end

local function isVector3(value, positive, limit)
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

local function expectedClassName(object)
    if object.role == "spawn" then
        return "SpawnLocation"
    elseif object.shape == "Wedge" then
        return "WedgePart"
    end
    return "Part"
end

local function validTransformAndAppearance(object)
    return type(object.transform) == "table"
        and isVector3(object.transform.position, false, 2048)
        and isVector3(object.transform.rotation, false, 360)
        and isVector3(object.size, true, 256)
        and type(object.color) == "string"
        and string.match(object.color, "^#[0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]$") ~= nil
        and SUPPORTED_MATERIALS[object.material] == true
end

local function validClassShape(object)
    return SUPPORTED_SHAPES[object.shape] == true
        and object.className == expectedClassName(object)
        and not (object.role == "spawn" and object.shape ~= "Block")
end

local function objectInsideBounds(object, bounds)
    local radius = math.sqrt(object.size.x ^ 2 + object.size.y ^ 2 + object.size.z ^ 2) / 2
    for _, axis in ipairs({ "x", "y", "z" }) do
        local position = object.transform.position[axis]
        if position - radius < bounds.minimum[axis] - 0.000001 then
            return false
        end
        if position + radius > bounds.maximum[axis] + 0.000001 then
            return false
        end
    end
    return true
end

local function validateGameplayObject(object, index, ids)
    if type(object) ~= "table" then
        return fail(string.format("gameplay object %d must be a table", index))
    end
    if object.order ~= index - 1 then
        return fail(string.format("gameplay object %d is out of order", index))
    end
    if type(object.id) ~= "string" or ids[object.id] then
        return fail(string.format("gameplay object %d has an invalid or duplicate id", index))
    end
    ids[object.id] = object
    if not SUPPORTED_ROLES[object.role] or not validClassShape(object) then
        return fail(string.format("gameplay object %s has an unsupported role/class/shape", object.id))
    end
    if not validTransformAndAppearance(object) or not SUPPORTED_COLOR_ROLES[object.colorRole] then
        return fail(string.format("gameplay object %s has unsupported geometry or appearance", object.id))
    end
    if
        (object.role == "spawn" or object.role == "checkpoint")
        and (object.transform.rotation.x ~= 0 or object.transform.rotation.z ~= 0)
    then
        return fail(string.format("gameplay object %s has a tilted character placement surface", object.id))
    end
    if
        type(object.physics) ~= "table"
        or object.physics.anchored ~= true
        or object.physics.canCollide ~= true
        or type(object.physics.canTouch) ~= "boolean"
        or type(object.physics.canQuery) ~= "boolean"
    then
        return fail(string.format("gameplay object %s has invalid physics", object.id))
    end
    local shouldTouch = object.role == "checkpoint" or object.role == "kill" or object.role == "finish"
    if object.physics.canTouch ~= shouldTouch then
        return fail(string.format("gameplay object %s has invalid touch policy", object.id))
    end
    if type(object.behavior) ~= "table" or object.behavior.kind ~= object.role then
        return fail(string.format("gameplay object %s has invalid behavior", object.id))
    end
    if object.role == "checkpoint" then
        if type(object.behavior.checkpointOrder) ~= "number" or object.behavior.killMode ~= nil then
            return fail("checkpoint behavior is invalid")
        end
    elseif object.role == "kill" then
        if object.behavior.killMode ~= "set-health-zero" or object.behavior.checkpointOrder ~= nil then
            return fail("kill behavior is invalid")
        end
    elseif object.behavior.checkpointOrder ~= nil or object.behavior.killMode ~= nil then
        return fail(string.format("gameplay object %s has role-incompatible behavior", object.id))
    end
    if
        (object.role == "kill" and object.colorRole ~= "hazard")
        or (object.role ~= "kill" and object.colorRole == "hazard")
    then
        return fail(string.format("gameplay object %s has invalid color role", object.id))
    end
    return true, nil
end

local function validateDecoration(object, index, ids)
    if
        type(object) ~= "table"
        or object.order ~= index - 1
        or object.role ~= "decoration"
        or type(object.id) ~= "string"
        or ids[object.id] ~= nil
        or not validClassShape(object)
        or not validTransformAndAppearance(object)
        or type(object.physics) ~= "table"
        or object.physics.anchored ~= true
        or object.physics.canCollide ~= false
        or object.physics.canTouch ~= false
        or type(object.physics.canQuery) ~= "boolean"
        or type(object.behavior) ~= "table"
        or object.behavior.kind ~= "decoration"
    then
        return fail(string.format("decorative object %d is invalid or unsupported", index))
    end
    ids[object.id] = object
    return true, nil
end

local function validateNavigation(manifest, gameplayIds)
    local navigation = manifest.navigation
    if
        type(navigation) ~= "table"
        or type(navigation.coarseReachability) ~= "table"
        or type(navigation.stages) ~= "table"
        or type(navigation.safeRouteObjectIds) ~= "table"
        or type(navigation.routeEntries) ~= "table"
    then
        return fail("navigation is invalid")
    end
    local assumptions = navigation.coarseReachability
    if
        assumptions.model ~= "axis-aligned-surfaces-v1"
        or assumptions.avatarRig ~= "R15-default"
        or type(assumptions.walkSpeed) ~= "number"
        or type(assumptions.jumpPower) ~= "number"
        or type(assumptions.maxHorizontalGap) ~= "number"
        or type(assumptions.maxVerticalRise) ~= "number"
        or type(assumptions.maxDownwardDrop) ~= "number"
        or assumptions.maxHorizontalGap <= 0
        or assumptions.maxVerticalRise <= 0
        or assumptions.maxDownwardDrop <= 0
    then
        return fail("coarse reachability assumptions are unsupported")
    end
    local placement = navigation.characterPlacement
    if
        type(placement) ~= "table"
        or placement.strategy ~= "humanoid-root-part-cframe-v1"
        or type(placement.verticalOffset) ~= "number"
        or placement.verticalOffset ~= placement.verticalOffset
        or math.abs(placement.verticalOffset) == math.huge
        or placement.verticalOffset < 2
        or placement.verticalOffset > 20
    then
        return fail("character placement policy is unsupported")
    end

    local stages = {}
    local flattened = {}
    for stageIndex, stage in ipairs(navigation.stages) do
        if
            type(stage) ~= "table"
            or type(stage.id) ~= "string"
            or stages[stage.id] ~= nil
            or stage.order ~= stageIndex
            or type(stage.safeRouteObjectIds) ~= "table"
            or #stage.safeRouteObjectIds == 0
        then
            return fail(string.format("navigation stage %d is invalid", stageIndex))
        end
        stages[stage.id] = stage
        for _, objectId in ipairs(stage.safeRouteObjectIds) do
            table.insert(flattened, objectId)
        end
    end
    if #flattened ~= #navigation.safeRouteObjectIds or #navigation.routeEntries ~= #flattened then
        return fail("safe route arrays have inconsistent lengths")
    end

    local routeIds = {}
    local stageCounts = {}
    for routeIndex, objectId in ipairs(navigation.safeRouteObjectIds) do
        if flattened[routeIndex] ~= objectId or routeIds[objectId] then
            return fail("safe route is out of order or duplicated")
        end
        local object = gameplayIds[objectId]
        if object == nil or object.role == "spawn" or object.role == "kill" then
            return fail(string.format("safe route object %s is missing or unsafe", tostring(objectId)))
        end
        routeIds[objectId] = true

        local entry = navigation.routeEntries[routeIndex]
        if
            type(entry) ~= "table"
            or entry.objectId ~= objectId
            or entry.routeOrder ~= routeIndex
            or stages[entry.stageId] == nil
        then
            return fail(string.format("route entry %d is invalid", routeIndex))
        end
        local stageOrder = (stageCounts[entry.stageId] or 0) + 1
        stageCounts[entry.stageId] = stageOrder
        if entry.stageRouteOrder ~= stageOrder or stages[entry.stageId].safeRouteObjectIds[stageOrder] ~= objectId then
            return fail(string.format("route entry %d has invalid stage order", routeIndex))
        end
    end
    for objectId, object in pairs(gameplayIds) do
        if object.role ~= "spawn" and object.role ~= "kill" and not routeIds[objectId] then
            return fail(string.format("safe gameplay object %s is missing from navigation", objectId))
        end
    end
    return true, nil
end

function ManifestValidator.validate(manifest)
    if type(manifest) ~= "table" then
        return fail("manifest must be a table")
    end
    if manifest.schemaVersion ~= EXPECTED_SCHEMA_VERSION then
        return fail("unsupported schemaVersion")
    end
    if manifest.generatorVersion ~= EXPECTED_GENERATOR_VERSION then
        return fail("unsupported generatorVersion")
    end
    if
        type(manifest.sceneId) ~= "string"
        or not validHash(manifest.sourceSpecHash)
        or not validHash(manifest.manifestHash)
    then
        return fail("manifest identity or hashes are invalid")
    end
    if
        type(manifest.coordinateSystem) ~= "table"
        or manifest.coordinateSystem.units ~= "studs"
        or manifest.coordinateSystem.handedness ~= "right-handed"
        or manifest.coordinateSystem.upAxis ~= "+Y"
        or manifest.coordinateSystem.forwardAxis ~= "-Z"
        or manifest.coordinateSystem.rotationUnit ~= "degrees"
        or manifest.coordinateSystem.rotationOrder ~= "XYZ"
    then
        return fail("unsupported coordinate system")
    end
    if
        type(manifest.worldBounds) ~= "table"
        or not isVector3(manifest.worldBounds.minimum, false, nil)
        or not isVector3(manifest.worldBounds.maximum, false, nil)
        or type(manifest.layers) ~= "table"
        or type(manifest.layers.gameplay) ~= "table"
        or type(manifest.layers.gameplay.objects) ~= "table"
        or type(manifest.layers.decorative) ~= "table"
        or type(manifest.layers.decorative.objects) ~= "table"
    then
        return fail("bounds or layers are invalid")
    end
    for _, axis in ipairs({ "x", "y", "z" }) do
        if manifest.worldBounds.minimum[axis] >= manifest.worldBounds.maximum[axis] then
            return fail("world bounds minimum must be less than maximum")
        end
    end

    local ids = {}
    local spawnCount = 0
    local finishCount = 0
    local expectedCheckpointOrder = 1
    for index, object in ipairs(manifest.layers.gameplay.objects) do
        local valid, validationError = validateGameplayObject(object, index, ids)
        if not valid then
            return valid, validationError
        end
        if not objectInsideBounds(object, manifest.worldBounds) then
            return fail(string.format("gameplay object %s is outside world bounds", object.id))
        end
        if object.role == "spawn" then
            spawnCount += 1
            if object.order ~= 0 then
                return fail("spawn must be the first gameplay object")
            end
        elseif object.role == "checkpoint" then
            if object.behavior.checkpointOrder ~= expectedCheckpointOrder then
                return fail("checkpoint order must be contiguous")
            end
            expectedCheckpointOrder += 1
        elseif object.role == "finish" then
            finishCount += 1
        end
    end
    local gameplayIds = table.clone(ids)
    for index, object in ipairs(manifest.layers.decorative.objects) do
        local valid, validationError = validateDecoration(object, index, ids)
        if not valid then
            return valid, validationError
        end
        if not objectInsideBounds(object, manifest.worldBounds) then
            return fail(string.format("decorative object %s is outside world bounds", object.id))
        end
    end
    if spawnCount ~= 1 then
        return fail("exactly one spawn is required")
    end
    if finishCount ~= 1 then
        return fail("exactly one finish is required")
    end

    return validateNavigation(manifest, gameplayIds)
end

return ManifestValidator

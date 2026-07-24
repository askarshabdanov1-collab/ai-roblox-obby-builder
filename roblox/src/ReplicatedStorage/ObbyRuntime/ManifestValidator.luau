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

local function fail(message)
    return false, message
end

local function isVector3(value, positive)
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
    end
    return true
end

local function expectedClassName(object)
    if object.role == "spawn" then
        return "SpawnLocation"
    end
    if object.shape == "Wedge" then
        return "WedgePart"
    end
    return "Part"
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
    if type(manifest.manifestHash) ~= "string" or not string.match(manifest.manifestHash, "^sha256:%x+$") then
        return fail("manifestHash is invalid")
    end
    if
        type(manifest.coordinateSystem) ~= "table"
        or manifest.coordinateSystem.units ~= "studs"
        or manifest.coordinateSystem.rotationUnit ~= "degrees"
        or manifest.coordinateSystem.rotationOrder ~= "XYZ"
    then
        return fail("unsupported coordinate system")
    end
    if
        type(manifest.layers) ~= "table"
        or type(manifest.layers.gameplay) ~= "table"
        or type(manifest.layers.gameplay.objects) ~= "table"
        or type(manifest.layers.decorative) ~= "table"
        or type(manifest.layers.decorative.objects) ~= "table"
    then
        return fail("layers are invalid")
    end

    local ids = {}
    local spawnCount = 0
    local finishCount = 0
    local expectedCheckpointOrder = 1

    for index, object in ipairs(manifest.layers.gameplay.objects) do
        if type(object) ~= "table" then
            return fail(string.format("gameplay object %d must be a table", index))
        end
        if object.order ~= index - 1 then
            return fail(string.format("gameplay object %d is out of order", index))
        end
        if type(object.id) ~= "string" or ids[object.id] then
            return fail(string.format("gameplay object %d has an invalid or duplicate id", index))
        end
        ids[object.id] = true
        if not SUPPORTED_ROLES[object.role] or not SUPPORTED_SHAPES[object.shape] then
            return fail(string.format("gameplay object %s has an unsupported role or shape", object.id))
        end
        if not SUPPORTED_MATERIALS[object.material] then
            return fail(string.format("gameplay object %s has an unsupported material", object.id))
        end
        if object.className ~= expectedClassName(object) then
            return fail(string.format("gameplay object %s has an invalid className", object.id))
        end
        if
            type(object.transform) ~= "table"
            or not isVector3(object.transform.position, false)
            or not isVector3(object.transform.rotation, false)
            or not isVector3(object.size, true)
        then
            return fail(string.format("gameplay object %s has an invalid transform or size", object.id))
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
        if type(object.behavior) ~= "table" or object.behavior.kind ~= object.role then
            return fail(string.format("gameplay object %s has invalid behavior", object.id))
        end
        local shouldTouch = object.role == "checkpoint" or object.role == "kill" or object.role == "finish"
        if object.physics.canTouch ~= shouldTouch then
            return fail(string.format("gameplay object %s has invalid touch policy", object.id))
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
        elseif object.role == "kill" then
            if type(object.behavior.damage) ~= "number" or object.behavior.damage <= 0 then
                return fail("kill behavior requires positive damage")
            end
        elseif object.role == "finish" then
            finishCount += 1
        end
    end

    for index, object in ipairs(manifest.layers.decorative.objects) do
        if type(object) ~= "table" or object.role ~= "decoration" then
            return fail(string.format("decorative object %d is invalid", index))
        end
        if object.physics.canCollide ~= false or object.physics.canTouch ~= false then
            return fail(string.format("decorative object %s cannot own gameplay collision", object.id))
        end
        if ids[object.id] then
            return fail(string.format("decorative object %s has a duplicate id", object.id))
        end
        ids[object.id] = true
    end

    if spawnCount ~= 1 then
        return fail("exactly one spawn is required")
    end
    if finishCount ~= 1 then
        return fail("exactly one finish is required")
    end
    return true, nil
end

return ManifestValidator

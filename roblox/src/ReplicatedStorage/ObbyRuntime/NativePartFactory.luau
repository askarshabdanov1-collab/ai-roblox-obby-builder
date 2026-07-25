local NativePartFactory = {}

local SUPPORTED_PART_SHAPES = {
    Block = true,
    Ball = true,
    Cylinder = true,
}

local function expectedClassName(object)
    if object.role == "spawn" then
        return "SpawnLocation"
    elseif object.shape == "Wedge" then
        return "WedgePart"
    end
    return "Part"
end

function NativePartFactory.create(object, runtime)
    if object.className ~= expectedClassName(object) then
        error(string.format("Unsupported class/shape combination %s/%s", object.className, object.shape))
    end
    if object.className == "SpawnLocation" and object.shape ~= "Block" then
        error("SpawnLocation must use Block shape")
    end
    if object.className == "Part" and not SUPPORTED_PART_SHAPES[object.shape] then
        error(string.format("Unsupported Part shape %s", tostring(object.shape)))
    end
    if runtime.materials[object.material] == nil then
        error(string.format("Unsupported material %s", tostring(object.material)))
    end

    local part = runtime.newInstance(object.className)
    if object.className == "SpawnLocation" then
        part.Neutral = true
        part.Enabled = true
        part.Duration = 0
    elseif object.className == "Part" then
        part.Shape = runtime.shapes[object.shape]
        if part.Shape == nil then
            error(string.format("Missing runtime shape %s", object.shape))
        end
    end

    part.Name = object.id
    part.Size = runtime.vector3(object.size.x, object.size.y, object.size.z)
    part.CFrame = runtime.cframe(object.transform)
    part.Color = runtime.color(object.color)
    part.Material = runtime.materials[object.material]
    part.Anchored = object.physics.anchored
    part.CanCollide = object.physics.canCollide
    part.CanTouch = object.physics.canTouch
    part.CanQuery = object.physics.canQuery
    part:SetAttribute("Role", object.role)
    return part
end

return NativePartFactory

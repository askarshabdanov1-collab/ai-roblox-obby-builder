local NativePartFactoryV03 = {}

local SHAPES = table.freeze({
    Ball = true,
    Block = true,
    Cylinder = true,
    Wedge = true,
})
local MATERIALS = table.freeze({
    Neon = true,
    SmoothPlastic = true,
})

local function failure(code, message)
    return nil, table.freeze({
        code = code,
        message = message,
    })
end

local function finite(value)
    return type(value) == "number" and value == value and math.abs(value) ~= math.huge
end

local function vector(value, positive)
    return type(value) == "table"
        and finite(value.x)
        and finite(value.y)
        and finite(value.z)
        and (not positive or (value.x > 0 and value.y > 0 and value.z > 0))
end

local function transform(value)
    return type(value) == "table" and vector(value.position, false) and vector(value.rotation, false)
end

local function collision(value)
    return type(value) == "table"
        and value.anchored == true
        and type(value.canCollide) == "boolean"
        and type(value.canTouch) == "boolean"
        and type(value.canQuery) == "boolean"
end

local function appearance(value)
    return type(value) == "table"
        and type(value.color) == "string"
        and #value.color == 7
        and string.match(value.color, "^#[0-9A-F]+$") ~= nil
        and MATERIALS[value.material] == true
end

local function expectedClass(record)
    if record.layer == "helper" then
        return "SpawnLocation"
    elseif record.shape == "Wedge" then
        return "WedgePart"
    end
    return "Part"
end

local function validRecord(record, runtime)
    if type(record) ~= "table" or getmetatable(record) ~= nil then
        return false
    end
    if type(record.id) ~= "string" or record.id == "" or SHAPES[record.shape] ~= true then
        return false
    end
    if record.layer ~= "gameplay" and record.layer ~= "decorative" and record.layer ~= "helper" then
        return false
    end
    if record.layer == "helper" then
        if
            record.className ~= "SpawnLocation"
            or record.shape ~= "Block"
            or record.nonAuthoritative ~= true
            or record.transparency ~= 1
            or record.neutral ~= true
            or record.enabled ~= true
            or record.duration ~= 0
        then
            return false
        end
    elseif record.className ~= "Part" then
        return false
    end
    if not transform(record.transform) or not vector(record.size, true) then
        return false
    end
    if not collision(record.collision) or not appearance(record.appearance) then
        return false
    end
    if
        (record.layer == "decorative" or record.layer == "helper")
        and (record.collision.canCollide or record.collision.canTouch or record.collision.canQuery)
    then
        return false
    end
    if
        type(runtime) ~= "table"
        or type(runtime.newInstance) ~= "function"
        or type(runtime.vector3) ~= "function"
        or type(runtime.cframe) ~= "function"
        or type(runtime.color) ~= "function"
        or type(runtime.materials) ~= "table"
        or runtime.materials[record.appearance.material] == nil
        or type(runtime.shapes) ~= "table"
        or (record.shape ~= "Wedge" and runtime.shapes[record.shape] == nil)
    then
        return false
    end
    return true
end

local function assetIntentAttribute(sourceReferences)
    local encoded = {}
    for _, sourceId in ipairs(sourceReferences.sourceAssetIntentIds) do
        table.insert(encoded, string.format("%d:%s", #sourceId, sourceId))
    end
    return table.concat(encoded, "|")
end

local function setAttributes(part, record)
    local attributes = record.diagnosticAttributes
    part:SetAttribute("ObjectId", attributes.ObjectId)
    part:SetAttribute("Layer", attributes.Layer)
    part:SetAttribute("Role", attributes.Role)
    part:SetAttribute("ZoneId", attributes.ZoneId)
    part:SetAttribute("SceneId", attributes.SceneId)
    part:SetAttribute("ManifestHash", attributes.ManifestHash)
    part:SetAttribute("SchemaVersion", attributes.SchemaVersion)
    part:SetAttribute("NonAuthoritative", attributes.NonAuthoritative)

    local source = record.sourceReferences
    if source ~= nil then
        part:SetAttribute("SourceStageId", source.sourceStageId)
        part:SetAttribute("SourceMechanicIntentId", source.sourceMechanicIntentId)
        part:SetAttribute("SourceCheckpointId", source.sourceCheckpointId)
        part:SetAttribute("SourceHazardId", source.sourceHazardId)
        part:SetAttribute("SourceFinishId", source.sourceFinishId)
        part:SetAttribute("SourceAssetIntentCount", #source.sourceAssetIntentIds)
        part:SetAttribute("SourceAssetIntentIds", assetIntentAttribute(source))
    end
end

local function robloxRuntime()
    return {
        newInstance = Instance.new,
        vector3 = Vector3.new,
        cframe = function(value)
            local position = value.position
            local rotation = value.rotation
            return CFrame.new(position.x, position.y, position.z)
                * CFrame.fromEulerAnglesXYZ(math.rad(rotation.x), math.rad(rotation.y), math.rad(rotation.z))
        end,
        color = function(hex)
            return Color3.fromRGB(
                tonumber(string.sub(hex, 2, 3), 16),
                tonumber(string.sub(hex, 4, 5), 16),
                tonumber(string.sub(hex, 6, 7), 16)
            )
        end,
        materials = {
            Neon = Enum.Material.Neon,
            SmoothPlastic = Enum.Material.SmoothPlastic,
        },
        shapes = {
            Ball = Enum.PartType.Ball,
            Block = Enum.PartType.Block,
            Cylinder = Enum.PartType.Cylinder,
        },
    }
end

function NativePartFactoryV03.create(record, configuredRuntime)
    local runtime = configuredRuntime or robloxRuntime()
    if not validRecord(record, runtime) then
        return failure("factory-record", "native-Part construction record is unsupported")
    end

    local className = expectedClass(record)
    local part = nil
    local constructed = pcall(function()
        part = runtime.newInstance(className)
        if part.ClassName ~= className or not part:IsA("BasePart") then
            error("runtime native class mismatch")
        end
        part.Name = record.id
        if className == "Part" then
            part.Shape = runtime.shapes[record.shape]
        elseif className == "SpawnLocation" then
            part.Neutral = record.neutral
            part.Enabled = record.enabled
            part.Duration = record.duration
        end
        part.Size = runtime.vector3(record.size.x, record.size.y, record.size.z)
        part.CFrame = runtime.cframe(record.transform)
        part.Color = runtime.color(record.appearance.color)
        part.Material = runtime.materials[record.appearance.material]
        part.Anchored = record.collision.anchored
        if record.layer == "decorative" or record.layer == "helper" then
            part.CanCollide = false
            part.CanTouch = false
            part.CanQuery = false
        else
            part.CanCollide = record.collision.canCollide
            part.CanTouch = record.collision.canTouch
            part.CanQuery = record.collision.canQuery
        end
        part.Transparency = record.transparency or 0
        setAttributes(part, record)
    end)
    if not constructed then
        if part ~= nil then
            pcall(function()
                part:Destroy()
            end)
        end
        return failure("factory-construction", "native-Part construction failed")
    end
    return part, nil
end

return table.freeze(NativePartFactoryV03)

local Players = game:GetService("Players")

local BuildPlan = require(script.Parent.BuildPlan)
local ManifestValidator = require(script.Parent.ManifestValidator)

local Builder = {}
local OWNER_ATTRIBUTE = "GeneratedBy"
local OWNER_VALUE = "AIObbyBuilder/0.2"
local ROOT_NAME = "GeneratedObby"

local MATERIALS = {
    SmoothPlastic = Enum.Material.SmoothPlastic,
    Plastic = Enum.Material.Plastic,
    Metal = Enum.Material.Metal,
    Neon = Enum.Material.Neon,
    Concrete = Enum.Material.Concrete,
    Wood = Enum.Material.Wood,
}

local SHAPES = {
    Block = Enum.PartType.Block,
    Ball = Enum.PartType.Ball,
    Cylinder = Enum.PartType.Cylinder,
}

local function colorFromHex(hex)
    local red = tonumber(string.sub(hex, 2, 3), 16)
    local green = tonumber(string.sub(hex, 4, 5), 16)
    local blue = tonumber(string.sub(hex, 6, 7), 16)
    if red == nil or green == nil or blue == nil then
        error(string.format("Invalid color %s", tostring(hex)))
    end
    return Color3.fromRGB(red, green, blue)
end

local function cframeFromTransform(transform)
    local position = transform.position
    local rotation = transform.rotation
    return CFrame.new(position.x, position.y, position.z)
        * CFrame.Angles(math.rad(rotation.x), math.rad(rotation.y), math.rad(rotation.z))
end

local function humanoidFromHit(hit)
    local character = hit:FindFirstAncestorOfClass("Model")
    if character == nil then
        return nil, nil
    end
    local humanoid = character:FindFirstChildOfClass("Humanoid")
    local player = Players:GetPlayerFromCharacter(character)
    return humanoid, player
end

local function connectBehavior(part, object, checkpointSpawn, sceneId)
    if object.role == "checkpoint" then
        part.Touched:Connect(function(hit)
            local _, player = humanoidFromHit(hit)
            if player ~= nil and checkpointSpawn ~= nil then
                player.RespawnLocation = checkpointSpawn
                player:SetAttribute("ObbyCheckpointOrder", object.behavior.checkpointOrder)
            end
        end)
    elseif object.role == "kill" then
        part.Touched:Connect(function(hit)
            local humanoid = humanoidFromHit(hit)
            if humanoid ~= nil then
                humanoid:TakeDamage(object.behavior.damage)
            end
        end)
    elseif object.role == "finish" then
        part.Touched:Connect(function(hit)
            local _, player = humanoidFromHit(hit)
            if player ~= nil then
                player:SetAttribute("ObbyFinishedScene", sceneId)
            end
        end)
    end
end

local function createPart(object)
    local part
    if object.className == "SpawnLocation" then
        part = Instance.new("SpawnLocation")
        part.Neutral = true
        part.Duration = 0
    elseif object.className == "WedgePart" then
        part = Instance.new("WedgePart")
    elseif object.className == "Part" then
        part = Instance.new("Part")
        part.Shape = SHAPES[object.shape]
    else
        error(string.format("Unsupported className %s", object.className))
    end

    part.Name = object.id
    part.Size = Vector3.new(object.size.x, object.size.y, object.size.z)
    part.CFrame = cframeFromTransform(object.transform)
    part.Color = colorFromHex(object.color)
    part.Material = MATERIALS[object.material]
    part.Anchored = object.physics.anchored
    part.CanCollide = object.physics.canCollide
    part.CanTouch = object.physics.canTouch
    part.CanQuery = object.physics.canQuery
    part:SetAttribute("Role", object.role)
    return part
end

local function createCheckpointSpawn(object)
    local spawn = Instance.new("SpawnLocation")
    spawn.Name = string.format("%sRespawn", object.id)
    spawn.Size = Vector3.new(math.max(4, object.size.x - 2), 1, math.max(4, object.size.z - 2))
    spawn.CFrame = cframeFromTransform(object.transform) * CFrame.new(0, object.size.y / 2 + 3, 0)
    spawn.Transparency = 1
    spawn.Anchored = true
    spawn.CanCollide = false
    spawn.CanTouch = false
    spawn.CanQuery = false
    spawn.Neutral = true
    spawn.Duration = 0
    spawn:SetAttribute("Role", "checkpoint-spawn")
    return spawn
end

local function ownedRoot(workspace)
    local existing = workspace:FindFirstChild(ROOT_NAME)
    if existing ~= nil then
        if not existing:IsA("Folder") or existing:GetAttribute(OWNER_ATTRIBUTE) ~= OWNER_VALUE then
            error(string.format("Refusing to replace unowned Workspace.%s", ROOT_NAME))
        end
        return existing
    end

    local folder = Instance.new("Folder")
    folder.Name = ROOT_NAME
    folder:SetAttribute(OWNER_ATTRIBUTE, OWNER_VALUE)
    folder.Parent = workspace
    return folder
end

function Builder.build(manifest, workspace)
    local valid, validationError = ManifestValidator.validate(manifest)
    if not valid then
        error(string.format("SceneManifest rejected: %s", validationError), 2)
    end
    local plan = BuildPlan.create(manifest)
    local staging = Instance.new("Folder")
    staging.Name = string.format("%sStaging", ROOT_NAME)

    local ok, buildError = pcall(function()
        for _, instruction in ipairs(plan.instructions) do
            local object = instruction.object
            local part = createPart(object)
            part:SetAttribute("SceneId", plan.sceneId)
            part:SetAttribute("ManifestHash", plan.manifestHash)

            local checkpointSpawn = nil
            if instruction.createsCheckpointSpawn then
                checkpointSpawn = createCheckpointSpawn(object)
                checkpointSpawn.Parent = staging
            end
            connectBehavior(part, object, checkpointSpawn, plan.sceneId)
            part.Parent = staging
        end
    end)
    if not ok then
        staging:Destroy()
        error(string.format("Failed to stage generated Obby: %s", tostring(buildError)))
    end

    local root = ownedRoot(workspace)
    for _, child in ipairs(root:GetChildren()) do
        child:Destroy()
    end
    for _, child in ipairs(staging:GetChildren()) do
        child.Parent = root
    end
    staging:Destroy()
    root:SetAttribute("SceneId", plan.sceneId)
    root:SetAttribute("ManifestHash", plan.manifestHash)
    return root
end

return Builder

local Players = game:GetService("Players")

local BuildPlan = require(script.Parent.BuildPlan)
local ManifestValidator = require(script.Parent.ManifestValidator)
local NativePartFactory = require(script.Parent.NativePartFactory)
local PlayerProgress = require(script.Parent.PlayerProgress)
local SceneBuilderCore = require(script.Parent.SceneBuilderCore)

local Builder = {}
local progress = PlayerProgress.new(0.75)
local activeSceneId = nil
local playerConnections = {}

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
    if type(hex) ~= "string" or string.match(hex, "^#[0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]$") == nil then
        error(string.format("Invalid color %s", tostring(hex)))
    end
    return Color3.fromRGB(
        tonumber(string.sub(hex, 2, 3), 16),
        tonumber(string.sub(hex, 4, 5), 16),
        tonumber(string.sub(hex, 6, 7), 16)
    )
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
    return character:FindFirstChildOfClass("Humanoid"), Players:GetPlayerFromCharacter(character)
end

local function bindPlayer(player)
    if playerConnections[player] ~= nil then
        return
    end
    playerConnections[player] = player.CharacterAdded:Connect(function(character)
        local respawnCFrame = progress:respawnTransform(player, activeSceneId)
        if respawnCFrame ~= nil then
            task.defer(function()
                if character.Parent ~= nil then
                    character:PivotTo(respawnCFrame)
                end
            end)
        end
    end)
end

for _, player in ipairs(Players:GetPlayers()) do
    bindPlayer(player)
end
Players.PlayerAdded:Connect(bindPlayer)
Players.PlayerRemoving:Connect(function(player)
    local connection = playerConnections[player]
    if connection ~= nil then
        connection:Disconnect()
        playerConnections[player] = nil
    end
    progress:clear(player)
end)

local function connectBehavior(part, object, sceneId)
    if object.role == "checkpoint" then
        part.Touched:Connect(function(hit)
            local _, player = humanoidFromHit(hit)
            if player == nil then
                return
            end
            local respawnCFrame = cframeFromTransform(object.transform) * CFrame.new(0, object.size.y / 2 + 3, 0)
            if
                progress:activateCheckpoint(
                    player,
                    sceneId,
                    object.id,
                    object.behavior.checkpointOrder,
                    respawnCFrame,
                    os.clock()
                )
            then
                player:SetAttribute("ObbyCheckpointOrder", object.behavior.checkpointOrder)
            end
        end)
    elseif object.role == "kill" then
        part.Touched:Connect(function(hit)
            local humanoid = humanoidFromHit(hit)
            if humanoid ~= nil then
                PlayerProgress.kill(humanoid)
            end
        end)
    elseif object.role == "finish" then
        part.Touched:Connect(function(hit)
            local _, player = humanoidFromHit(hit)
            if player ~= nil and progress:finish(player, sceneId) then
                player:SetAttribute("ObbyFinishedScene", sceneId)
            end
        end)
    end
end

local partRuntime = {
    newInstance = Instance.new,
    vector3 = Vector3.new,
    cframe = cframeFromTransform,
    color = colorFromHex,
    materials = MATERIALS,
    shapes = SHAPES,
}

function Builder.build(manifest, workspace)
    local root = SceneBuilderCore.build(manifest, workspace, {
        validate = ManifestValidator.validate,
        createPlan = BuildPlan.create,
        newFolder = function()
            return Instance.new("Folder")
        end,
        createPart = function(object)
            return NativePartFactory.create(object, partRuntime)
        end,
        connectBehavior = connectBehavior,
    })
    activeSceneId = manifest.sceneId
    return root
end

return Builder

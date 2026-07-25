local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local BuildPlan = require(script.Parent.BuildPlan)
local CharacterPlacement = require(script.Parent.CharacterPlacement)
local ManifestValidator = require(script.Parent.ManifestValidator)
local NativePartFactory = require(script.Parent.NativePartFactory)
local PlacementController = require(script.Parent.PlacementController)
local PlayerProgress = require(script.Parent.PlayerProgress)
local SceneBuilderCore = require(script.Parent.SceneBuilderCore)

local Builder = {}
local progress = PlayerProgress.new(0.75)
local playerConnections = {}
local ROOT_WAIT_TIMEOUT_SECONDS = 10

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

local function waitForRootPart(character)
    local rootPart = character:FindFirstChild("HumanoidRootPart")
    if rootPart == nil then
        rootPart = character:WaitForChild("HumanoidRootPart", ROOT_WAIT_TIMEOUT_SECONDS)
    end
    if rootPart == nil or not rootPart:IsA("BasePart") then
        return nil
    end
    task.wait()
    if rootPart.Parent ~= character then
        return nil
    end
    return rootPart
end

local placementController = PlacementController.new(
    progress,
    waitForRootPart,
    function(rootPart, object, verticalOffset)
        CharacterPlacement.apply(rootPart, object, verticalOffset, cframeFromTransform)
    end
)

local function bindPlayer(player)
    if playerConnections[player] ~= nil then
        return
    end
    playerConnections[player] = player.CharacterAdded:Connect(function(character)
        placementController:placeCharacter(player, character)
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

local function connectBehavior(part, object, sceneId, sceneKey)
    if object.role == "checkpoint" then
        part.Touched:Connect(function(hit)
            local _, player = humanoidFromHit(hit)
            if player == nil then
                return
            end
            if
                progress:activateCheckpoint(
                    player,
                    sceneKey,
                    object.id,
                    object.behavior.checkpointOrder,
                    object,
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
    if workspace == Workspace then
        local startObject = manifest.layers.gameplay.objects[1]
        placementController:activateScene(
            manifest.manifestHash,
            startObject,
            manifest.navigation.characterPlacement.verticalOffset
        )
        for _, player in ipairs(Players:GetPlayers()) do
            local character = player.Character
            if character ~= nil then
                task.spawn(function()
                    placementController:placeCharacter(player, character)
                end)
            end
        end
    end
    return root
end

return Builder

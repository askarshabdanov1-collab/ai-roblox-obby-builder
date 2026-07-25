local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local Workspace = game:GetService("Workspace")

local BuildPlan = require(ReplicatedStorage.ObbyRuntime.BuildPlan)
local Builder = require(ReplicatedStorage.ObbyRuntime.Builder)
local CharacterPlacement = require(ReplicatedStorage.ObbyRuntime.CharacterPlacement)
local SceneBuilderCore = require(ReplicatedStorage.ObbyRuntime.SceneBuilderCore)
local manifest = require(ServerStorage.GeneratedManifests.VerticalSliceManifest)

local function assertSmoke(condition, message)
    if not condition then
        error("[Phase 0 smoke setup] " .. message)
    end
end

local function cframeFromTransform(transform)
    local position = transform.position
    local rotation = transform.rotation
    return CFrame.new(position.x, position.y, position.z)
        * CFrame.Angles(math.rad(rotation.x), math.rad(rotation.y), math.rad(rotation.z))
end

local cardinalDirections = {
    { yaw = 0, expected = Vector3.new(0, 0, -1) },
    { yaw = 90, expected = Vector3.new(-1, 0, 0) },
    { yaw = 180, expected = Vector3.new(0, 0, 1) },
    { yaw = 270, expected = Vector3.new(1, 0, 0) },
}
for _, cardinal in ipairs(cardinalDirections) do
    local placementRoot = Instance.new("Part")
    CharacterPlacement.apply(placementRoot, {
        transform = {
            position = { x = 12, y = 7, z = -9 },
            rotation = { x = 0, y = cardinal.yaw, z = 0 },
        },
        size = { x = 20, y = 4, z = 10 },
    }, 3, cframeFromTransform)
    assertSmoke(placementRoot.Position == Vector3.new(12, 12, -9), "character placement center or offset failed")
    assertSmoke(
        (placementRoot.CFrame.LookVector - cardinal.expected).Magnitude < 0.000001,
        string.format("%d degree character orientation failed", cardinal.yaw)
    )
    placementRoot:Destroy()
end

local root = Builder.build(manifest, Workspace)
local spawnLocations = {}
for _, descendant in ipairs(root:GetDescendants()) do
    if descendant:IsA("SpawnLocation") then
        table.insert(spawnLocations, descendant)
    end
end
assertSmoke(#spawnLocations == 1, "generated scene must contain exactly one SpawnLocation")
assertSmoke(spawnLocations[1].Name == "Spawn", "only the order-zero Spawn may be a SpawnLocation")
local checkpoint = root:FindFirstChild("Checkpoint01")
assertSmoke(checkpoint ~= nil and checkpoint:IsA("Part"), "checkpoint must be a Part, not a SpawnLocation")

local ownedMarker = Instance.new("Part")
ownedMarker.Name = "OwnedCleanupMarker"
ownedMarker.Parent = root
local rebuilt = Builder.build(manifest, Workspace)
assertSmoke(rebuilt == root, "owned generated root must be reused")
assertSmoke(rebuilt:FindFirstChild("OwnedCleanupMarker") == nil, "owned content was not cleaned up")

manifest.layers.decorative.objects = {
    {
        id = "SmokeBall",
        order = 0,
        role = "decoration",
        className = "Part",
        shape = "Ball",
        transform = {
            position = { x = 20, y = 10, z = 20 },
            rotation = { x = 15, y = 30, z = 45 },
        },
        size = { x = 2, y = 3, z = 4 },
        color = "#FFFFFF",
        material = "Plastic",
        physics = { anchored = true, canCollide = false, canTouch = false, canQuery = true },
        behavior = { kind = "decoration" },
    },
    {
        id = "SmokeCylinder",
        order = 1,
        role = "decoration",
        className = "Part",
        shape = "Cylinder",
        transform = {
            position = { x = 24, y = 10, z = 20 },
            rotation = { x = 0, y = 90, z = 0 },
        },
        size = { x = 2, y = 3, z = 4 },
        color = "#FFFFFF",
        material = "Concrete",
        physics = { anchored = true, canCollide = false, canTouch = false, canQuery = true },
        behavior = { kind = "decoration" },
    },
    {
        id = "SmokeWedge",
        order = 2,
        role = "decoration",
        className = "WedgePart",
        shape = "Wedge",
        transform = {
            position = { x = 28, y = 10, z = 20 },
            rotation = { x = 0, y = 45, z = 0 },
        },
        size = { x = 2, y = 3, z = 4 },
        color = "#FFFFFF",
        material = "Wood",
        physics = { anchored = true, canCollide = false, canTouch = false, canQuery = true },
        behavior = { kind = "decoration" },
    },
}
local nativeShapeSandbox = Instance.new("Folder")
local nativeShapeRoot = Builder.build(manifest, nativeShapeSandbox)
local smokeBall = nativeShapeRoot:FindFirstChild("SmokeBall")
local smokeCylinder = nativeShapeRoot:FindFirstChild("SmokeCylinder")
local smokeWedge = nativeShapeRoot:FindFirstChild("SmokeWedge")
assertSmoke(smokeBall ~= nil and smokeBall:IsA("Part") and smokeBall.Shape == Enum.PartType.Ball, "Ball failed")
assertSmoke(
    smokeCylinder ~= nil and smokeCylinder:IsA("Part") and smokeCylinder.Shape == Enum.PartType.Cylinder,
    "Cylinder failed"
)
assertSmoke(smokeWedge ~= nil and smokeWedge:IsA("WedgePart"), "Wedge failed")
assertSmoke(smokeBall.Position == Vector3.new(20, 10, 20), "CFrame position was not applied")
assertSmoke(smokeBall.Size == Vector3.new(2, 3, 4) and smokeBall.Material == Enum.Material.Plastic, "properties failed")
assertSmoke(not smokeBall.CanCollide and not smokeBall.CanTouch, "decoration gained gameplay behavior")
nativeShapeSandbox:Destroy()
manifest.layers.decorative.objects = {}

local unownedSandbox = Instance.new("Folder")
local unownedRoot = Instance.new("Folder")
unownedRoot.Name = "GeneratedObby"
unownedRoot.Parent = unownedSandbox
local unownedOk = pcall(function()
    Builder.build(manifest, unownedSandbox)
end)
assertSmoke(not unownedOk and unownedRoot.Parent == unownedSandbox, "unowned root was replaced or deleted")
unownedSandbox:Destroy()

local stagingSandbox = Instance.new("Folder")
local previousRoot = Instance.new("Folder")
previousRoot.Name = "GeneratedObby"
previousRoot:SetAttribute("GeneratedBy", "AIObbyBuilder/0.2")
previousRoot.Parent = stagingSandbox
local previousMarker = Instance.new("Part")
previousMarker.Name = "PreviousValidScene"
previousMarker.Parent = previousRoot
local stagingFolder = nil
local stagingDestroyed = false
local stagingOk = pcall(function()
    SceneBuilderCore.build(manifest, stagingSandbox, {
        validate = function()
            return true, nil
        end,
        createPlan = BuildPlan.create,
        newFolder = function()
            local folder = Instance.new("Folder")
            stagingFolder = folder
            folder.Destroying:Connect(function()
                stagingDestroyed = true
            end)
            return folder
        end,
        createPart = function(object)
            if object.id == "Checkpoint01" then
                error("intentional Studio smoke staging failure")
            end
            return Instance.new("Part")
        end,
        connectBehavior = function() end,
    })
end)
assertSmoke(not stagingOk, "injected staging failure was hidden")
assertSmoke(previousMarker.Parent == previousRoot, "staging failure destroyed previous scene")
assertSmoke(stagingFolder ~= nil and stagingDestroyed, "staging folder was not destroyed")
stagingSandbox:Destroy()

Workspace:SetAttribute("Phase0SmokeReady", true)
print("[Phase 0 smoke setup] Static engine checks passed; complete the documented two-player test.")

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local manifest = require(ReplicatedStorage.ObbyBuilder.ExampleManifest)
local folder = Workspace:WaitForChild("GeneratedObby")

for _, child in folder:GetChildren() do
    child:Destroy()
end

for _, entry in manifest.parts do
    local part = Instance.new("Part")
    part.Name = entry.id
    part.Size = entry.size
    part.Position = entry.position
    part.Color = entry.color
    part.Material = entry.material
    part.Anchored = true
    part.CanCollide = entry.collision
    part.CanTouch = entry.role == "checkpoint" or entry.role == "kill" or entry.role == "finish"
    part:SetAttribute("Role", entry.role)
    part:SetAttribute("SceneId", manifest.sceneId)
    part.Parent = folder
end

local spawn = Workspace:FindFirstChildOfClass("SpawnLocation")
if spawn then
    spawn.Position = manifest.spawn
end

print(string.format("[AI Obby Builder] Built %s with %d parts", manifest.sceneId, #manifest.parts))

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local Workspace = game:GetService("Workspace")

local Builder = require(ReplicatedStorage.ObbyRuntime.Builder)
local manifest = require(ServerStorage.GeneratedManifests.VerticalSliceManifest)

local generatedRoot = Builder.build(manifest, Workspace)
print(
    string.format(
        "[AI Obby Builder] Built %s with %d generated instances",
        manifest.sceneId,
        #generatedRoot:GetChildren()
    )
)

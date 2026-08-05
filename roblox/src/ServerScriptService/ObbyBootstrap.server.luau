local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local Workspace = game:GetService("Workspace")

local runtimeConfiguration = ServerStorage.RuntimeConfiguration
local runtimeVersion = runtimeConfiguration.Version.Value
local manifests = ServerStorage.GeneratedManifests

local manifest
local generatedRoot

if runtimeVersion == "0.2" then
    local Builder = require(ReplicatedStorage.ObbyRuntime.Builder)
    manifest = require(manifests.VerticalSliceManifest)
    generatedRoot = Builder.build(manifest, Workspace)
elseif runtimeVersion == "0.3" then
    local BuilderV03 = require(ReplicatedStorage.ObbyRuntime.BuilderV03)
    local manifestModule = manifests.G2ReferenceManifestV03
    manifest = require(manifestModule)

    local builder, builderError = BuilderV03.new()
    assert(builder ~= nil, builderError and builderError.message or "BuilderV03 initialization failed")

    local result, buildError = builder:build(manifestModule, runtimeConfiguration.ExpectedManifestHash.Value)
    assert(result ~= nil, buildError and buildError.message or "BuilderV03 build failed")
    generatedRoot = result.root
else
    error(string.format("unsupported SceneManifest runtime version: %s", tostring(runtimeVersion)))
end

print(
    string.format(
        "[AI Obby Builder] Built %s with SceneManifest %s and %d generated instances",
        manifest.sceneId,
        runtimeVersion,
        #generatedRoot:GetChildren()
    )
)

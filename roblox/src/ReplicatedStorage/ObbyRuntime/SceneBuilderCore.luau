local SceneBuilderCore = {}

local OWNER_ATTRIBUTE = "GeneratedBy"
local OWNER_VALUE = "AIObbyBuilder/0.2"
local ROOT_NAME = "GeneratedObby"

local function existingOwnedRoot(workspace)
    local existing = workspace:FindFirstChild(ROOT_NAME)
    if existing ~= nil and (not existing:IsA("Folder") or existing:GetAttribute(OWNER_ATTRIBUTE) ~= OWNER_VALUE) then
        error(string.format("Refusing to replace unowned Workspace.%s", ROOT_NAME))
    end
    return existing
end

function SceneBuilderCore.build(manifest, workspace, runtime)
    local valid, validationError = runtime.validate(manifest)
    if not valid then
        error(string.format("SceneManifest rejected: %s", validationError), 2)
    end
    local previousRoot = existingOwnedRoot(workspace)
    local plan = runtime.createPlan(manifest)
    local staging = runtime.newFolder()
    staging.Name = string.format("%sStaging", ROOT_NAME)

    local ok, buildError = pcall(function()
        for _, instruction in ipairs(plan.instructions) do
            local object = instruction.object
            local part = runtime.createPart(object)
            part:SetAttribute("SceneId", plan.sceneId)
            part:SetAttribute("ManifestHash", plan.manifestHash)
            runtime.connectBehavior(part, object, plan.sceneId)
            part.Parent = staging
        end
    end)
    if not ok then
        staging:Destroy()
        error(string.format("Failed to stage generated Obby: %s", tostring(buildError)))
    end

    local root = previousRoot
    if root == nil then
        root = runtime.newFolder()
        root.Name = ROOT_NAME
        root:SetAttribute(OWNER_ATTRIBUTE, OWNER_VALUE)
        root.Parent = workspace
    end
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

return SceneBuilderCore

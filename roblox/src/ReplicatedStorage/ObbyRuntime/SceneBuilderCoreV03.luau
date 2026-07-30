local BuildPlanV03 = require("./BuildPlanV03")
local NativePartFactoryV03 = require("./NativePartFactoryV03")

local SceneBuilderCoreV03 = {}

local OWNER_VALUE = "AIObbyBuilder/0.3"
local ROOT_NAME = "GeneratedObby"
local candidateLifecycleByEnvelope = setmetatable({}, { __mode = "k" })
local receiptLifecycleByReceipt = setmetatable({}, { __mode = "k" })

local function failure(code, message)
    return nil, table.freeze({
        code = code,
        message = message,
    })
end

local function injected(options, boundary)
    return options ~= nil and options.failAt == boundary
end

local function runtimeOrDefault(configuredRuntime)
    if configuredRuntime ~= nil then
        return configuredRuntime
    end
    return {
        newInstance = Instance.new,
    }
end

local function allocate(runtime, className)
    if type(runtime) ~= "table" or type(runtime.newInstance) ~= "function" then
        return failure("candidate-runtime", "candidate runtime is invalid")
    end
    local instance = nil
    local ok = pcall(function()
        instance = runtime.newInstance(className)
    end)
    if not ok or instance == nil then
        return failure("candidate-allocation", "candidate container allocation failed")
    end
    return instance, nil
end

local function destroy(instance)
    if instance == nil then
        return true
    end
    return pcall(function()
        instance:Destroy()
    end)
end

local function registerCandidate(candidate)
    candidateLifecycleByEnvelope[candidate] = {
        state = "staged",
        rootPending = true,
        stagingPending = true,
    }
end

local function disposeCandidate(candidate)
    if type(candidate) ~= "table" then
        return failure("candidate-identity", "candidate envelope is invalid")
    end
    local lifecycle = candidateLifecycleByEnvelope[candidate]
    if lifecycle == nil then
        return failure("candidate-identity", "candidate lifecycle is not owned by this runtime")
    end
    if lifecycle.state == "active" then
        return failure("candidate-lifecycle", "active candidate cannot be disposed as staged work")
    end
    lifecycle.state = "disposed"

    local root = candidate.root
    local stagingContainer = candidate.stagingContainer
    local rootOutsideStaging = root ~= nil and root.Parent ~= stagingContainer
    if lifecycle.rootPending and rootOutsideStaging and destroy(root) then
        lifecycle.rootPending = false
    end
    if lifecycle.stagingPending and destroy(stagingContainer) then
        lifecycle.stagingPending = false
        if not rootOutsideStaging then
            lifecycle.rootPending = false
        end
    end
    if lifecycle.rootPending or lifecycle.stagingPending then
        return failure("candidate-cleanup", "candidate cleanup was incomplete")
    end
    return true, nil
end

local function abortCandidate(stagingContainer, code, message)
    if not destroy(stagingContainer) then
        return failure("candidate-cleanup", "candidate construction failed and cleanup was incomplete")
    end
    return failure(code, message)
end

local function configureRoot(root, plan)
    root.Name = plan.ownership.candidateName
    root:SetAttribute("GeneratedBy", plan.ownership.generatedBy)
    root:SetAttribute("SchemaVersion", plan.schemaVersion)
    root:SetAttribute("SceneId", plan.sceneId)
    root:SetAttribute("ManifestHash", plan.manifestHash)
    root:SetAttribute("BuildPlanIdentity", plan.structuralIdentity)
    root:SetAttribute("CandidateState", "building")
end

local function createContainer(runtime, root, name)
    local container, containerError = allocate(runtime, "Folder")
    if container == nil then
        return nil, containerError
    end
    container.Name = name
    container.Parent = root
    return container, nil
end

local function candidateIdentityMatches(candidate)
    local root = candidate.root
    local plan = candidate.plan
    return root.Name == plan.ownership.candidateName
        and root:GetAttribute("GeneratedBy") == plan.ownership.generatedBy
        and root:GetAttribute("SchemaVersion") == plan.schemaVersion
        and root:GetAttribute("SceneId") == plan.sceneId
        and root:GetAttribute("ManifestHash") == plan.manifestHash
        and root:GetAttribute("BuildPlanIdentity") == plan.structuralIdentity
        and root:GetAttribute("CandidateState") == "complete"
end

local function validateCandidate(candidate)
    if type(candidate) ~= "table" or not table.isfrozen(candidate) then
        return failure("candidate-identity", "candidate envelope is invalid")
    end
    local lifecycle = candidateLifecycleByEnvelope[candidate]
    if lifecycle == nil or lifecycle.state ~= "staged" then
        return failure("candidate-identity", "candidate lifecycle is not staged")
    end
    if
        candidate.root == nil
        or candidate.stagingContainer == nil
        or candidate.root.Parent ~= candidate.stagingContainer
        or candidate.stagingContainer.Parent ~= nil
    then
        return failure("candidate-identity", "candidate is not in private staging")
    end
    if not candidateIdentityMatches(candidate) then
        return failure("candidate-identity", "candidate identity changed after construction")
    end

    local plan = candidate.plan
    if
        candidate.gameplayContainer.Parent ~= candidate.root
        or candidate.decorativeContainer.Parent ~= candidate.root
        or candidate.helperContainer.Parent ~= candidate.root
        or candidate.metadataContainer.Parent ~= candidate.root
        or #candidate.root:GetChildren() ~= 4
        or #candidate.gameplayContainer:GetChildren() ~= plan.counts.gameplayParts
        or #candidate.decorativeContainer:GetChildren() ~= plan.counts.decorativeParts
        or #candidate.helperContainer:GetChildren() ~= plan.counts.helperParts
        or #candidate.metadataContainer:GetChildren() ~= 0
    then
        return failure("candidate-invariant", "candidate hierarchy or object counts are incomplete")
    end
    if
        candidate.metadataContainer:GetAttribute("GameplayPartCount") ~= plan.counts.gameplayParts
        or candidate.metadataContainer:GetAttribute("DecorativePartCount") ~= plan.counts.decorativeParts
        or candidate.metadataContainer:GetAttribute("TotalPartCount") ~= plan.counts.totalParts
        or candidate.metadataContainer:GetAttribute("BuildPlanIdentity") ~= plan.structuralIdentity
    then
        return failure("candidate-invariant", "candidate metadata does not match the build plan")
    end

    for index, record in ipairs(plan.gameplayRecords) do
        local part = candidate.gameplayParts[index]
        if
            part == nil
            or candidate.partById[record.id] ~= part
            or part.Parent ~= candidate.gameplayContainer
            or part.Name ~= record.id
            or part:GetAttribute("ObjectId") ~= record.id
        then
            return failure("candidate-invariant", "gameplay Part lookup closure failed")
        end
    end
    for index, record in ipairs(plan.decorativeRecords) do
        local part = candidate.decorativeParts[index]
        if
            part == nil
            or candidate.partById[record.id] ~= part
            or part.Parent ~= candidate.decorativeContainer
            or part.Name ~= record.id
            or part:GetAttribute("ObjectId") ~= record.id
            or part.CanCollide
            or part.CanTouch
            or part.CanQuery
        then
            return failure("candidate-invariant", "decorative Part lookup closure failed")
        end
    end
    if
        candidate.helper == nil
        or candidate.helper.Parent ~= candidate.helperContainer
        or candidate.helper.Name ~= plan.helperSpawnRecord.id
        or candidate.helper:GetAttribute("NonAuthoritative") ~= true
        or candidate.helper.CanCollide
        or candidate.helper.CanTouch
        or candidate.helper.CanQuery
    then
        return failure("candidate-invariant", "runtime SpawnLocation helper is invalid")
    end
    return true, nil
end

local function constructionBudget(plan, options)
    local maxParts = if options == nil or options.maxParts == nil then plan.counts.totalParts else options.maxParts
    local maxInstances = if options == nil or options.maxInstances == nil
        then plan.counts.totalInstances
        else options.maxInstances
    if
        type(maxParts) ~= "number"
        or maxParts ~= math.floor(maxParts)
        or maxParts < 0
        or type(maxInstances) ~= "number"
        or maxInstances ~= math.floor(maxInstances)
        or maxInstances < 0
    then
        return failure("candidate-budget-config", "candidate construction budget is invalid")
    end
    if plan.counts.totalParts > maxParts or plan.counts.totalInstances > maxInstances then
        return failure("candidate-budget", "candidate exceeds the configured construction budget")
    end
    return true, nil
end

function SceneBuilderCoreV03.buildCandidate(admitted, configuredRuntime, options)
    local plan, planError = BuildPlanV03.create(admitted)
    if plan == nil then
        return nil, planError
    end
    local budget, budgetError = constructionBudget(plan, options)
    if budget == nil then
        return nil, budgetError
    end
    if injected(options, "before-root") then
        return failure("candidate-injected-failure", "candidate construction failed at an injected boundary")
    end

    local runtime = runtimeOrDefault(configuredRuntime)
    local staging, stagingError = allocate(runtime, "Folder")
    if staging == nil then
        return nil, stagingError
    end
    staging.Name = "_G2PrivateStaging"
    local root, rootError = allocate(runtime, "Model")
    if root == nil then
        return abortCandidate(staging, rootError.code, rootError.message)
    end
    root.Parent = staging
    configureRoot(root, plan)
    if injected(options, "after-root") then
        return abortCandidate(
            staging,
            "candidate-injected-failure",
            "candidate construction failed at an injected boundary"
        )
    end

    local gameplayContainer, gameplayContainerError = createContainer(runtime, root, plan.containers.gameplay)
    if gameplayContainer == nil then
        return abortCandidate(staging, gameplayContainerError.code, gameplayContainerError.message)
    end
    local decorativeContainer, decorativeContainerError = createContainer(runtime, root, plan.containers.decorative)
    if decorativeContainer == nil then
        return abortCandidate(staging, decorativeContainerError.code, decorativeContainerError.message)
    end
    local helperContainer, helperContainerError = createContainer(runtime, root, plan.containers.helpers)
    if helperContainer == nil then
        return abortCandidate(staging, helperContainerError.code, helperContainerError.message)
    end
    local metadataContainer, metadataContainerError = createContainer(runtime, root, plan.containers.metadata)
    if metadataContainer == nil then
        return abortCandidate(staging, metadataContainerError.code, metadataContainerError.message)
    end
    metadataContainer:SetAttribute("GameplayPartCount", plan.counts.gameplayParts)
    metadataContainer:SetAttribute("DecorativePartCount", plan.counts.decorativeParts)
    metadataContainer:SetAttribute("TotalPartCount", plan.counts.totalParts)
    metadataContainer:SetAttribute("BuildPlanIdentity", plan.structuralIdentity)
    if injected(options, "after-containers") then
        return abortCandidate(
            staging,
            "candidate-injected-failure",
            "candidate construction failed at an injected boundary"
        )
    end

    local partById = {}
    local gameplayParts = {}
    local decorativeParts = {}
    for index, record in ipairs(plan.gameplayRecords) do
        local part, partError = NativePartFactoryV03.create(record, configuredRuntime)
        if part == nil then
            return abortCandidate(staging, partError.code, partError.message)
        end
        part.Parent = gameplayContainer
        gameplayParts[index] = part
        partById[record.id] = part
    end
    if injected(options, "after-gameplay") then
        return abortCandidate(
            staging,
            "candidate-injected-failure",
            "candidate construction failed at an injected boundary"
        )
    end
    for index, record in ipairs(plan.decorativeRecords) do
        local part, partError = NativePartFactoryV03.create(record, configuredRuntime)
        if part == nil then
            return abortCandidate(staging, partError.code, partError.message)
        end
        part.Parent = decorativeContainer
        decorativeParts[index] = part
        partById[record.id] = part
    end
    if injected(options, "after-decorative") then
        return abortCandidate(
            staging,
            "candidate-injected-failure",
            "candidate construction failed at an injected boundary"
        )
    end
    local helper, helperError = NativePartFactoryV03.create(plan.helperSpawnRecord, configuredRuntime)
    if helper == nil then
        return abortCandidate(staging, helperError.code, helperError.message)
    end
    helper.Parent = helperContainer
    if injected(options, "after-helper") then
        return abortCandidate(
            staging,
            "candidate-injected-failure",
            "candidate construction failed at an injected boundary"
        )
    end

    root:SetAttribute("CandidateState", "complete")
    local candidate = table.freeze({
        identity = plan.structuralIdentity,
        root = root,
        stagingContainer = staging,
        gameplayContainer = gameplayContainer,
        decorativeContainer = decorativeContainer,
        helperContainer = helperContainer,
        metadataContainer = metadataContainer,
        gameplayParts = table.freeze(gameplayParts),
        decorativeParts = table.freeze(decorativeParts),
        partById = table.freeze(partById),
        helper = helper,
        plan = plan,
    })
    registerCandidate(candidate)
    if injected(options, "before-validation") then
        local cleaned, cleanupError = disposeCandidate(candidate)
        if cleaned == nil then
            return nil, cleanupError
        end
        return failure("candidate-injected-failure", "candidate construction failed at an injected boundary")
    end
    local valid, candidateError = validateCandidate(candidate)
    if valid == nil then
        local cleaned, cleanupError = disposeCandidate(candidate)
        if cleaned == nil then
            return nil, cleanupError
        end
        return nil, candidateError
    end
    return candidate, nil
end

function SceneBuilderCoreV03.newRootState()
    return {
        currentRoot = nil,
        currentManifestHash = nil,
        currentSession = nil,
        currentGenerationToken = nil,
    }
end

local function activeRoots(workspace)
    local roots = {}
    for _, child in ipairs(workspace:GetChildren()) do
        if child.Name == ROOT_NAME then
            table.insert(roots, child)
        end
    end
    return roots
end

local function cleanupRejectedCandidate(candidate)
    local cleaned, cleanupError = disposeCandidate(candidate)
    if cleaned == nil then
        return nil, cleanupError
    end
    return true, nil
end

local function rollback(
    candidate,
    previousRoot,
    previousParent,
    previousName,
    previousManifestHash,
    previousSession,
    previousGenerationToken,
    state,
    code,
    message
)
    local restored = pcall(function()
        candidate.root.Parent = candidate.stagingContainer
        candidate.root.Name = candidate.plan.ownership.candidateName
        if previousRoot ~= nil then
            previousRoot.Name = previousName
            previousRoot.Parent = previousParent
        end
        state.currentRoot = previousRoot
        state.currentManifestHash = previousManifestHash
        state.currentSession = previousSession
        state.currentGenerationToken = previousGenerationToken
    end)
    if not restored then
        state.currentRoot = nil
        state.currentManifestHash = nil
        state.currentSession = nil
        state.currentGenerationToken = nil
        pcall(function()
            candidate.root.Parent = nil
        end)
        local lifecycle = candidateLifecycleByEnvelope[candidate]
        if lifecycle ~= nil then
            lifecycle.state = "disposed"
        end
        return failure("commit-fatal", "root replacement rollback could not be proven")
    end
    local cleaned = cleanupRejectedCandidate(candidate)
    if cleaned == nil then
        return failure("commit-fatal", "root replacement rollback cleanup was incomplete")
    end
    return failure(code, message)
end

function SceneBuilderCoreV03.commitCandidate(candidate, workspace, state, options)
    local valid, candidateError = validateCandidate(candidate)
    if valid == nil then
        cleanupRejectedCandidate(candidate)
        return nil, candidateError
    end
    if type(workspace) ~= "table" or type(workspace.GetChildren) ~= "function" or type(state) ~= "table" then
        cleanupRejectedCandidate(candidate)
        return failure("commit-runtime", "root replacement runtime is invalid")
    end

    local nextSession = if options == nil then nil else options.nextSession
    local nextGenerationToken = if options == nil then nil else options.nextGenerationToken
    local sessionAware = nextSession ~= nil or nextGenerationToken ~= nil
    if
        sessionAware
        and (
            type(nextSession) ~= "table"
            or type(nextGenerationToken) ~= "string"
            or candidate.root:GetAttribute("GenerationToken") ~= nextGenerationToken
        )
    then
        cleanupRejectedCandidate(candidate)
        return failure("commit-session", "candidate session pointer identity is invalid")
    end

    local roots = activeRoots(workspace)
    if #roots > 1 then
        cleanupRejectedCandidate(candidate)
        return failure("active-root-ambiguous", "multiple active generated roots prevent replacement")
    end
    local previousRoot = roots[1]
    if previousRoot ~= nil then
        if
            previousRoot:GetAttribute("GeneratedBy") ~= OWNER_VALUE
            or previousRoot:GetAttribute("SchemaVersion") ~= "0.3"
        then
            cleanupRejectedCandidate(candidate)
            return failure("active-root-ownership", "active root is unowned or belongs to another runtime version")
        end
        if state.currentRoot ~= previousRoot then
            cleanupRejectedCandidate(candidate)
            return failure("active-root-pointer", "active root does not match the current root pointer")
        end
        if
            type(state.currentManifestHash) ~= "string"
            or state.currentManifestHash ~= previousRoot:GetAttribute("ManifestHash")
        then
            cleanupRejectedCandidate(candidate)
            return failure("active-root-pointer", "active root identity does not match the current root pointer")
        end
        if
            state.currentSession ~= nil
            and (
                type(state.currentGenerationToken) ~= "string"
                or previousRoot:GetAttribute("GenerationToken") ~= state.currentGenerationToken
            )
        then
            cleanupRejectedCandidate(candidate)
            return failure("active-root-pointer", "active root generation does not match the current session")
        end
    elseif state.currentRoot ~= nil then
        cleanupRejectedCandidate(candidate)
        return failure("active-root-pointer", "current root pointer has no matching active root")
    elseif state.currentManifestHash ~= nil then
        cleanupRejectedCandidate(candidate)
        return failure("active-root-pointer", "current root identity has no matching active root")
    end
    if injected(options, "before-commit") then
        cleanupRejectedCandidate(candidate)
        return failure("commit-injected-failure", "root replacement failed at an injected boundary")
    end

    local previousParent = if previousRoot == nil then nil else previousRoot.Parent
    local previousName = if previousRoot == nil then nil else previousRoot.Name
    local previousManifestHash = state.currentManifestHash
    local previousSession = state.currentSession
    local previousGenerationToken = state.currentGenerationToken
    if previousRoot ~= nil then
        local retired = pcall(function()
            previousRoot.Name = candidate.plan.ownership.retiredName
            previousRoot.Parent = candidate.stagingContainer
        end)
        if not retired then
            return rollback(
                candidate,
                previousRoot,
                previousParent,
                previousName,
                previousManifestHash,
                previousSession,
                previousGenerationToken,
                state,
                "commit-retire",
                "previous root could not be retired"
            )
        end
    end
    if injected(options, "after-retire") then
        return rollback(
            candidate,
            previousRoot,
            previousParent,
            previousName,
            previousManifestHash,
            previousSession,
            previousGenerationToken,
            state,
            "commit-injected-failure",
            "root replacement failed at an injected boundary"
        )
    end

    local published = pcall(function()
        candidate.root.Name = candidate.plan.ownership.rootName
        candidate.root.Parent = workspace
    end)
    if not published then
        return rollback(
            candidate,
            previousRoot,
            previousParent,
            previousName,
            previousManifestHash,
            previousSession,
            previousGenerationToken,
            state,
            "commit-publish",
            "candidate root could not be published"
        )
    end
    if injected(options, "after-publish") or injected(options, "before-pointer") then
        return rollback(
            candidate,
            previousRoot,
            previousParent,
            previousName,
            previousManifestHash,
            previousSession,
            previousGenerationToken,
            state,
            "commit-injected-failure",
            "root replacement failed at an injected boundary"
        )
    end

    state.currentRoot = candidate.root
    state.currentManifestHash = candidate.plan.manifestHash
    if sessionAware then
        state.currentSession = nextSession
        state.currentGenerationToken = nextGenerationToken
    end
    candidate.root:SetAttribute("CandidateState", "active")
    candidateLifecycleByEnvelope[candidate].state = "active"
    if options ~= nil and options.deferCleanup == true then
        local receipt = table.freeze({
            receiptVersion = "g2d-deferred-cleanup-v1",
            activeRoot = candidate.root,
            retiredRoot = previousRoot,
            stagingContainer = candidate.stagingContainer,
        })
        receiptLifecycleByReceipt[receipt] = {
            retiredRootPending = previousRoot ~= nil,
            stagingPending = true,
            finalized = false,
        }
        return candidate.root, nil, receipt
    end
    if previousRoot ~= nil and not destroy(previousRoot) then
        return candidate.root,
            table.freeze({
                code = "commit-cleanup",
                message = "new root is active but retired-root cleanup is incomplete",
            })
    end
    if not destroy(candidate.stagingContainer) then
        return candidate.root,
            table.freeze({
                code = "commit-cleanup",
                message = "new root is active but private staging cleanup is incomplete",
            })
    end
    return candidate.root, nil
end

function SceneBuilderCoreV03.finalizeCommit(receipt)
    if
        type(receipt) ~= "table"
        or receipt.receiptVersion ~= "g2d-deferred-cleanup-v1"
        or receipt.activeRoot == nil
        or receipt.stagingContainer == nil
        or receiptLifecycleByReceipt[receipt] == nil
    then
        return failure("commit-cleanup", "deferred root cleanup receipt is invalid")
    end
    local lifecycle = receiptLifecycleByReceipt[receipt]
    if lifecycle.finalized then
        return true, nil
    end
    if lifecycle.retiredRootPending then
        if not destroy(receipt.retiredRoot) then
            return failure("commit-cleanup", "new root is active but retired-root cleanup is incomplete")
        end
        lifecycle.retiredRootPending = false
    end
    if lifecycle.stagingPending then
        if not destroy(receipt.stagingContainer) then
            return failure("commit-cleanup", "new root is active but private staging cleanup is incomplete")
        end
        lifecycle.stagingPending = false
    end
    lifecycle.finalized = true
    return true, nil
end

SceneBuilderCoreV03.validateCandidate = validateCandidate
SceneBuilderCoreV03.disposeCandidate = disposeCandidate

return table.freeze(SceneBuilderCoreV03)

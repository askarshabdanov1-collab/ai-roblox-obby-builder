local ManifestLoaderV03 = require("./ManifestLoaderV03")
local RuntimeSessionV03 = require("./RuntimeSessionV03")
local SceneBuilderCoreV03 = require("./SceneBuilderCoreV03")

local BuilderV03 = {}
BuilderV03.__index = BuilderV03

local function failure(code, message)
    return nil, table.freeze({
        code = code,
        message = message,
    })
end

local function defaultRuntime()
    local Players = game:GetService("Players")
    local Workspace = game:GetService("Workspace")
    return {
        workspace = Workspace,
        isWorkspace = function(value)
            return typeof(value) == "Instance" and value == Workspace and value:IsA("Workspace")
        end,
        connectTouched = function(part, callback)
            return part.Touched:Connect(callback)
        end,
        resolveTouch = function(hit)
            local character = hit:FindFirstAncestorOfClass("Model")
            if character == nil then
                return nil, nil, nil
            end
            local player = Players:GetPlayerFromCharacter(character)
            local humanoid = character:FindFirstChildOfClass("Humanoid")
            return player, character, humanoid
        end,
        waitForRootPart = function(character, timeoutSeconds)
            local root = character:FindFirstChild("HumanoidRootPart")
            if root == nil then
                root = character:WaitForChild("HumanoidRootPart", timeoutSeconds)
            end
            if root == nil or not root:IsA("BasePart") or root.Parent ~= character then
                return nil
            end
            return root
        end,
        cframe = function(transform)
            local position = transform.position
            local rotation = transform.rotation
            return CFrame.new(position.x, position.y, position.z)
                * CFrame.fromEulerAnglesXYZ(math.rad(rotation.x), math.rad(rotation.y), math.rad(rotation.z))
        end,
        killHumanoid = function(humanoid)
            humanoid.Health = 0
        end,
        getPlayers = function()
            return Players:GetPlayers()
        end,
        connectPlayerAdded = function(callback)
            return Players.PlayerAdded:Connect(callback)
        end,
        connectPlayerRemoving = function(callback)
            return Players.PlayerRemoving:Connect(callback)
        end,
        connectCharacterAdded = function(player, callback)
            return player.CharacterAdded:Connect(callback)
        end,
        defer = task.defer,
    }
end

local function validRuntime(runtime)
    return type(runtime) == "table"
        and runtime.workspace ~= nil
        and type(runtime.isWorkspace) == "function"
        and type(runtime.connectTouched) == "function"
        and type(runtime.resolveTouch) == "function"
        and type(runtime.waitForRootPart) == "function"
        and type(runtime.cframe) == "function"
        and type(runtime.killHumanoid) == "function"
        and type(runtime.getPlayers) == "function"
        and type(runtime.connectPlayerAdded) == "function"
        and type(runtime.connectPlayerRemoving) == "function"
        and type(runtime.connectCharacterAdded) == "function"
        and type(runtime.defer) == "function"
end

local function disconnect(connection)
    if connection == nil then
        return true
    end
    return pcall(function()
        connection:Disconnect()
    end)
end

local function destroyCandidate(candidate)
    if candidate == nil then
        return true
    end
    local disposed = SceneBuilderCoreV03.disposeCandidate(candidate)
    return disposed == true
end

function BuilderV03:_deferPlacement(player, character)
    local capturedSession = self.rootState.currentSession
    if capturedSession == nil then
        return
    end
    self.runtime.defer(function()
        if self.rootState.currentSession == capturedSession then
            capturedSession:placeCharacter(player, character)
        end
    end)
end

function BuilderV03:_bindPlayer(player)
    if self.playerConnectionByPlayer[player] ~= nil then
        return true
    end
    local connection = nil
    local connected = pcall(function()
        connection = self.runtime.connectCharacterAdded(player, function(character)
            self:_deferPlacement(player, character)
        end)
    end)
    if not connected or connection == nil or type(connection.Disconnect) ~= "function" then
        return false
    end
    self.playerConnectionByPlayer[player] = connection
    table.insert(self.playerOrder, player)
    local character = player.Character
    if character ~= nil and self.rootState.currentSession ~= nil then
        self:_deferPlacement(player, character)
    end
    return true
end

function BuilderV03:_removePlayer(player)
    local connection = self.playerConnectionByPlayer[player]
    if connection ~= nil then
        disconnect(connection)
        self.playerConnectionByPlayer[player] = nil
    end
    for index, retainedPlayer in ipairs(self.playerOrder) do
        if retainedPlayer == player then
            table.remove(self.playerOrder, index)
            break
        end
    end
    local session = self.rootState.currentSession
    if session ~= nil then
        session:removePlayer(player)
    end
end

function BuilderV03.new(configuredRuntime)
    local runtime = configuredRuntime or defaultRuntime()
    if not validRuntime(runtime) then
        return failure("builder-runtime", "BuilderV03 runtime is invalid")
    end
    local rootState = SceneBuilderCoreV03.newRootState()
    local replacementRuntime =
        SceneBuilderCoreV03.newReplacementRuntime(runtime.workspace, rootState, runtime.isWorkspace)
    local self = setmetatable({
        runtime = runtime,
        rootState = rootState,
        replacementRuntime = replacementRuntime,
        generation = 0,
        playerConnectionByPlayer = {},
        playerOrder = {},
        coordinatorConnections = {},
        disposed = false,
    }, BuilderV03)

    local playerAdded = nil
    local playerRemoving = nil
    local connected = pcall(function()
        playerAdded = runtime.connectPlayerAdded(function(player)
            self:_bindPlayer(player)
        end)
        playerRemoving = runtime.connectPlayerRemoving(function(player)
            self:_removePlayer(player)
        end)
    end)
    if
        not connected
        or playerAdded == nil
        or playerRemoving == nil
        or type(playerAdded.Disconnect) ~= "function"
        or type(playerRemoving.Disconnect) ~= "function"
    then
        disconnect(playerAdded)
        disconnect(playerRemoving)
        return failure("builder-players", "BuilderV03 player coordinator could not be initialized")
    end
    self.coordinatorConnections = { playerAdded, playerRemoving }
    local players = runtime.getPlayers()
    if type(players) ~= "table" then
        self:dispose()
        return failure("builder-players", "BuilderV03 player enumeration failed")
    end
    for _, player in ipairs(players) do
        if not self:_bindPlayer(player) then
            self:dispose()
            return failure("builder-players", "BuilderV03 character coordinator could not be initialized")
        end
    end
    return self, nil
end

function BuilderV03:currentSession()
    return self.rootState.currentSession
end

function BuilderV03:build(moduleScript, expectedManifestHash, options)
    if self.disposed then
        return failure("builder-state", "disposed BuilderV03 cannot build a scene")
    end
    options = options or {}
    local admitted, admissionError = ManifestLoaderV03.load(moduleScript, expectedManifestHash, {
        requireModule = options.requireModule,
        maxSnapshotDepth = options.maxSnapshotDepth,
        maxSnapshotEntries = options.maxSnapshotEntries,
        maxSnapshotNodes = options.maxSnapshotNodes,
        maxSnapshotStringBytes = options.maxSnapshotStringBytes,
        maxWorkUnits = options.maxWorkUnits,
    })
    if admitted == nil then
        return nil, admissionError
    end
    local candidate, candidateError =
        SceneBuilderCoreV03.buildCandidate(admitted, self.runtime.partRuntime, options.candidateOptions)
    if candidate == nil then
        return nil, candidateError
    end

    self.generation += 1
    local generationToken = string.format("g2d-generation-v1:%d", self.generation)
    candidate.root:SetAttribute("GenerationToken", generationToken)
    local session, sessionError =
        RuntimeSessionV03.new(admitted, candidate, generationToken, self.rootState, self.runtime)
    if session == nil then
        destroyCandidate(candidate)
        return nil, sessionError
    end
    local prepared, prepareError = session:prepare()
    if prepared == nil then
        session:dispose()
        destroyCandidate(candidate)
        return nil, prepareError
    end

    local previousSession = self.rootState.currentSession
    local players = self.runtime.getPlayers()
    if type(players) ~= "table" then
        session:dispose()
        destroyCandidate(candidate)
        return failure("builder-players", "BuilderV03 player enumeration failed")
    end
    if previousSession ~= nil then
        local current, currentError = previousSession:checkCurrent({})
        if current == nil then
            session:dispose()
            destroyCandidate(candidate)
            return nil, currentError
        end
        if previousSession.manifestHash == session.manifestHash then
            local adopted, adoptionError = session:adoptProgress(previousSession, players)
            if adopted == nil then
                session:dispose()
                destroyCandidate(candidate)
                return nil, adoptionError
            end
        end
    end
    if options.failAt == "before-commit" then
        session:dispose()
        destroyCandidate(candidate)
        return failure("builder-injected-failure", "BuilderV03 failed before root commit")
    end

    local commitOptions = table.clone(options.commitOptions or {})
    commitOptions.nextSession = session
    commitOptions.nextGenerationToken = generationToken
    commitOptions.deferCleanup = true
    local root, commitError, cleanupReceipt =
        SceneBuilderCoreV03.commitCandidate(candidate, self.replacementRuntime, commitOptions)
    if root == nil then
        session:dispose()
        return nil, commitError
    end

    if previousSession ~= nil then
        previousSession:invalidate()
    end
    local activated, activationError = session:activate()
    if activated == nil then
        session:dispose()
        return nil, activationError
    end
    if previousSession == nil or previousSession.manifestHash ~= session.manifestHash then
        for _, player in ipairs(players) do
            session:clearVisibleProgress(player)
        end
    end
    if previousSession ~= nil then
        previousSession:dispose()
    end

    local cleaned, cleanupError = SceneBuilderCoreV03.finalizeCommit(cleanupReceipt)
    for _, player in ipairs(players) do
        local character = player.Character
        if character ~= nil then
            self:_deferPlacement(player, character)
        end
    end
    return table.freeze({
        root = root,
        session = session,
        cleanupWarning = if cleaned == nil then cleanupError else nil,
    }),
        nil
end

function BuilderV03:dispose()
    if self.disposed then
        return true
    end
    self.disposed = true
    local session = self.rootState.currentSession
    if session ~= nil then
        session:invalidate()
        session:dispose()
    end
    for _, player in ipairs(self.playerOrder) do
        disconnect(self.playerConnectionByPlayer[player])
        self.playerConnectionByPlayer[player] = nil
    end
    for _, connection in ipairs(self.coordinatorConnections) do
        disconnect(connection)
    end
    self.coordinatorConnections = {}
    self.rootState.currentSession = nil
    self.rootState.currentGenerationToken = nil
    return true
end

return table.freeze(BuilderV03)

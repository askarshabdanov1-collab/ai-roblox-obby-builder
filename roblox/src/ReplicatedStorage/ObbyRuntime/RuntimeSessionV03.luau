local CharacterPlacement = require("./CharacterPlacement")

local RuntimeSessionV03 = {}
RuntimeSessionV03.__index = RuntimeSessionV03

local ROOT_WAIT_TIMEOUT_SECONDS = 10
local CHECKPOINT_ATTRIBUTE = "ObbyV03CheckpointOrder"
local FINISH_ATTRIBUTE = "ObbyV03FinishedManifestHash"

local function failure(code, message)
    return nil, table.freeze({
        code = code,
        message = message,
    })
end

local function validToken(value)
    return type(value) == "string" and string.match(value, "^g2d%-generation%-v1:%d+$") ~= nil
end

local function validInput(admitted, candidate, token, pointer, runtime)
    return type(admitted) == "table"
        and table.isfrozen(admitted)
        and admitted.hashTrust == "repository-module-expected-hash-v1"
        and type(admitted.manifest) == "table"
        and table.isfrozen(admitted.manifest)
        and type(admitted.indexes) == "table"
        and table.isfrozen(admitted.indexes)
        and type(candidate) == "table"
        and table.isfrozen(candidate)
        and candidate.plan.manifestHash == admitted.manifest.manifestHash
        and candidate.root ~= nil
        and type(candidate.partById) == "table"
        and table.isfrozen(candidate.partById)
        and validToken(token)
        and type(pointer) == "table"
        and type(runtime) == "table"
        and type(runtime.connectTouched) == "function"
        and type(runtime.resolveTouch) == "function"
        and type(runtime.waitForRootPart) == "function"
        and type(runtime.cframe) == "function"
end

local function shouldBind(record)
    local behavior = record.behavior
    if type(behavior) ~= "table" then
        return false
    end
    return (record.role == "checkpoint" and behavior.kind == "checkpoint")
        or (record.role == "kill" and behavior.kind == "kill" and behavior.killMode == "touch")
        or (record.role == "finish" and behavior.kind == "finish")
end

local function disconnectAll(connections)
    local complete = true
    for _, connection in ipairs(connections) do
        local ok = pcall(function()
            connection:Disconnect()
        end)
        if not ok then
            complete = false
        end
    end
    return complete
end

local function identityFor(admitted, token)
    return string.format(
        "g2d-runtime-session-v1|%d:%s|%d:%s",
        #admitted.manifest.manifestHash,
        admitted.manifest.manifestHash,
        #token,
        token
    )
end

function RuntimeSessionV03.new(admitted, candidate, generationToken, pointer, runtime)
    if not validInput(admitted, candidate, generationToken, pointer, runtime) then
        return failure("session-input", "runtime session input is invalid")
    end
    return setmetatable({
        identity = identityFor(admitted, generationToken),
        manifestHash = admitted.manifest.manifestHash,
        generationToken = generationToken,
        admitted = admitted,
        candidate = candidate,
        pointer = pointer,
        runtime = runtime,
        _state = "inactive",
        _prepared = false,
        _invalidated = false,
        _acceptingCallbacks = false,
        _connections = {},
        _checkpoints = {},
        _finishes = {},
        _debounces = {},
        _pendingPlacements = {},
    }, RuntimeSessionV03),
        nil
end

function RuntimeSessionV03:status()
    return self._state
end

function RuntimeSessionV03:connectionCount()
    return #self._connections
end

function RuntimeSessionV03:prepare()
    if self._state ~= "inactive" or self._prepared or self._invalidated then
        return failure("session-state", "runtime session cannot be prepared from its current state")
    end
    local connections = {}
    for _, record in ipairs(self.candidate.plan.gameplayRecords) do
        if shouldBind(record) then
            local part = self.candidate.partById[record.id]
            local connection = nil
            local connected = pcall(function()
                connection = self.runtime.connectTouched(part, function(hit)
                    self:_handleTouch(part, record, hit)
                end)
            end)
            if not connected or connection == nil or type(connection.Disconnect) ~= "function" then
                disconnectAll(connections)
                return failure("session-connection", "gameplay connection preparation failed")
            end
            table.insert(connections, connection)
        end
    end
    self._connections = connections
    self._prepared = true
    return true, nil
end

function RuntimeSessionV03:activate()
    if self._state ~= "inactive" or not self._prepared or self._invalidated then
        return failure("session-state", "runtime session cannot be activated from its current state")
    end
    local root = self.candidate.root
    if
        self.pointer.currentRoot ~= root
        or self.pointer.currentManifestHash ~= self.manifestHash
        or self.pointer.currentSession ~= self
        or self.pointer.currentGenerationToken ~= self.generationToken
        or root:GetAttribute("GeneratedBy") ~= "AIObbyBuilder/0.3"
        or root:GetAttribute("ManifestHash") ~= self.manifestHash
        or root:GetAttribute("GenerationToken") ~= self.generationToken
        or root:GetAttribute("CandidateState") ~= "active"
    then
        return failure("session-stale", "runtime session activation identity is stale")
    end
    self._state = "active"
    self._acceptingCallbacks = true
    return true, nil
end

function RuntimeSessionV03:invalidate()
    if self._state == "disposed" then
        return true
    end
    self._acceptingCallbacks = false
    self._invalidated = true
    if self._state == "active" then
        self._state = "inactive"
    end
    return true
end

function RuntimeSessionV03:checkCurrent(expected)
    expected = expected or {}
    local root = self.candidate.root
    if
        self._state ~= "active"
        or not self._acceptingCallbacks
        or self._invalidated
        or self.pointer.currentSession ~= self
        or self.pointer.currentGenerationToken ~= self.generationToken
    then
        return failure("session-stale", "runtime session generation is stale")
    end
    if self.pointer.currentManifestHash ~= self.manifestHash then
        return failure("session-manifest", "runtime session manifest identity is stale")
    end
    if self.pointer.currentRoot ~= root or root.Destroyed == true then
        return failure("session-root", "runtime session root is stale")
    end
    if
        root:GetAttribute("GeneratedBy") ~= "AIObbyBuilder/0.3"
        or root:GetAttribute("ManifestHash") ~= self.manifestHash
        or root:GetAttribute("GenerationToken") ~= self.generationToken
        or root:GetAttribute("CandidateState") ~= "active"
    then
        return failure("session-root", "runtime session root identity changed")
    end
    if expected.generationToken ~= nil and expected.generationToken ~= self.generationToken then
        return failure("session-stale", "captured runtime generation is stale")
    end
    if expected.manifestHash ~= nil and expected.manifestHash ~= self.manifestHash then
        return failure("session-manifest", "captured manifest identity is stale")
    end
    if expected.root ~= nil and expected.root ~= root then
        return failure("session-root", "captured scene root is stale")
    end
    if expected.objectId ~= nil or expected.part ~= nil then
        if
            type(expected.objectId) ~= "string"
            or expected.part == nil
            or self.candidate.partById[expected.objectId] ~= expected.part
            or expected.part:GetAttribute("ObjectId") ~= expected.objectId
            or expected.part:GetAttribute("ManifestHash") ~= self.manifestHash
        then
            return failure("session-object", "captured gameplay object is stale")
        end
    end
    if expected.player ~= nil or expected.character ~= nil then
        if
            type(expected.player) ~= "table"
            or type(expected.player.UserId) ~= "number"
            or expected.character == nil
            or expected.player.Character ~= expected.character
        then
            return failure("session-character", "captured player character is stale")
        end
    end
    return true, nil
end

function RuntimeSessionV03:_handleTouch(_part, _record, _hit)
    -- G2d behavior handlers are added only after their focused vectors.
    return false
end

function RuntimeSessionV03:dispose()
    if self._state == "disposed" then
        return true, nil
    end
    self._acceptingCallbacks = false
    self._invalidated = true
    local complete = disconnectAll(self._connections)
    self._connections = {}
    self._checkpoints = {}
    self._finishes = {}
    self._debounces = {}
    self._pendingPlacements = {}
    self._state = "disposed"
    if not complete then
        return failure("session-disposal", "runtime session connection disposal was incomplete")
    end
    return true, nil
end

RuntimeSessionV03.ROOT_WAIT_TIMEOUT_SECONDS = ROOT_WAIT_TIMEOUT_SECONDS
RuntimeSessionV03.CHECKPOINT_ATTRIBUTE = CHECKPOINT_ATTRIBUTE
RuntimeSessionV03.FINISH_ATTRIBUTE = FINISH_ATTRIBUTE
RuntimeSessionV03.CharacterPlacement = CharacterPlacement

return table.freeze(RuntimeSessionV03)

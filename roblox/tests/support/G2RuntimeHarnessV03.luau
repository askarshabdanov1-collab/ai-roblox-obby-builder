local FakeInstanceV03 = require("./FakeInstanceV03")

local G2RuntimeHarnessV03 = {}

local function signal(tracker)
    local callbacks = {}
    local nextId = 0
    return {
        Connect = function(_, callback)
            nextId += 1
            local id = nextId
            callbacks[id] = callback
            tracker.connections += 1
            tracker.activeConnections += 1
            local connected = true
            return {
                Disconnect = function()
                    if connected then
                        connected = false
                        callbacks[id] = nil
                        tracker.activeConnections -= 1
                    end
                end,
            }
        end,
        Fire = function(_, ...)
            local pending = table.clone(callbacks)
            for _, callback in next, pending do
                callback(...)
            end
        end,
    }
end

local function player(tracker, userId)
    local characterAdded = signal(tracker)
    local value = {
        UserId = userId,
        Character = nil,
        CharacterAdded = characterAdded,
        _attributes = {},
    }
    function value:SetAttribute(name, attributeValue)
        self._attributes[name] = attributeValue
    end
    function value:GetAttribute(name)
        return self._attributes[name]
    end
    return value
end

function G2RuntimeHarnessV03.new()
    local tracker = FakeInstanceV03.tracker()
    tracker.activeConnections = 0
    tracker.touchSignals = {}
    tracker.deferred = {}
    tracker.waits = 0
    tracker.placements = {}
    tracker.kills = 0
    tracker.touchConnectionAttempts = 0

    local players = {}
    local playerAdded = signal(tracker)
    local playerRemoving = signal(tracker)
    local partRuntime = FakeInstanceV03.runtime(tracker)
    local workspace = FakeInstanceV03.new("Workspace", tracker)

    local function touchSignal(part)
        local current = tracker.touchSignals[part]
        if current == nil then
            current = signal(tracker)
            tracker.touchSignals[part] = current
        end
        return current
    end

    local runtime = {
        partRuntime = partRuntime,
        workspace = workspace,
        connectTouched = function(part, callback)
            tracker.touchConnectionAttempts += 1
            if tracker.failTouchConnectionAt == tracker.touchConnectionAttempts then
                error("injected touch connection failure")
            end
            return touchSignal(part):Connect(callback)
        end,
        resolveTouch = function(hit)
            if type(hit) ~= "table" then
                return nil, nil, nil
            end
            return hit.player, hit.character, hit.humanoid
        end,
        waitForRootPart = function(character, _timeoutSeconds)
            tracker.waits += 1
            if character.waitHook ~= nil then
                local hook = character.waitHook
                character.waitHook = nil
                hook()
            end
            return character.rootPart
        end,
        cframe = partRuntime.cframe,
        killHumanoid = function(humanoid)
            tracker.kills += 1
            humanoid.Health = 0
        end,
        getPlayers = function()
            return table.clone(players)
        end,
        connectPlayerAdded = function(callback)
            return playerAdded:Connect(callback)
        end,
        connectPlayerRemoving = function(callback)
            return playerRemoving:Connect(callback)
        end,
        connectCharacterAdded = function(currentPlayer, callback)
            return currentPlayer.CharacterAdded:Connect(callback)
        end,
        defer = function(callback)
            table.insert(tracker.deferred, callback)
        end,
    }

    local harness = {
        tracker = tracker,
        runtime = runtime,
        workspace = workspace,
    }

    function harness:newPlayer(userId)
        return player(tracker, userId)
    end

    function harness:addPlayer(currentPlayer)
        table.insert(players, currentPlayer)
        playerAdded:Fire(currentPlayer)
    end

    function harness:removePlayer(currentPlayer)
        for index, candidate in ipairs(players) do
            if candidate == currentPlayer then
                table.remove(players, index)
                break
            end
        end
        playerRemoving:Fire(currentPlayer)
    end

    function harness:newCharacter(currentPlayer)
        local character = {
            rootPart = FakeInstanceV03.new("Part", tracker),
            humanoid = { Health = 100 },
        }
        character.rootPart.Name = "HumanoidRootPart"
        currentPlayer.Character = character
        return character
    end

    function harness:fireCharacter(currentPlayer, character)
        currentPlayer.Character = character
        currentPlayer.CharacterAdded:Fire(character)
    end

    function harness:hit(currentPlayer, character)
        return {
            player = currentPlayer,
            character = character,
            humanoid = character and character.humanoid or nil,
        }
    end

    function harness:touch(part, hit)
        touchSignal(part):Fire(hit)
    end

    function harness:runDeferred()
        local callbacks = tracker.deferred
        tracker.deferred = {}
        for _, callback in ipairs(callbacks) do
            callback()
        end
    end

    return harness
end

return table.freeze(G2RuntimeHarnessV03)

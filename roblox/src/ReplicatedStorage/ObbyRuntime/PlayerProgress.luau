local PlayerProgress = {}
PlayerProgress.__index = PlayerProgress

function PlayerProgress.new(debounceSeconds)
    return setmetatable({
        debounceSeconds = debounceSeconds,
        checkpoints = {},
        checkpointTouches = {},
        finishes = {},
    }, PlayerProgress)
end

function PlayerProgress:activateCheckpoint(player, sceneKey, checkpointId, checkpointOrder, object, now)
    local touches = self.checkpointTouches[player]
    if touches == nil then
        touches = {}
        self.checkpointTouches[player] = touches
    end
    local touchKey = string.format("%s:%s", sceneKey, checkpointId)
    local lastTouch = touches[touchKey]
    if lastTouch ~= nil and now - lastTouch < self.debounceSeconds then
        return false
    end
    touches[touchKey] = now

    local current = self.checkpoints[player]
    if current ~= nil and current.sceneKey == sceneKey and current.checkpointOrder >= checkpointOrder then
        return false
    end
    self.checkpoints[player] = {
        sceneKey = sceneKey,
        checkpointId = checkpointId,
        checkpointOrder = checkpointOrder,
        object = object,
    }
    return true
end

function PlayerProgress:respawnObject(player, sceneKey)
    local checkpoint = self.checkpoints[player]
    if checkpoint == nil or checkpoint.sceneKey ~= sceneKey then
        return nil
    end
    return checkpoint.object
end

function PlayerProgress:checkpointOrder(player, sceneKey)
    local checkpoint = self.checkpoints[player]
    if checkpoint == nil or checkpoint.sceneKey ~= sceneKey then
        return nil
    end
    return checkpoint.checkpointOrder
end

function PlayerProgress:finish(player, sceneId)
    local finishes = self.finishes[player]
    if finishes == nil then
        finishes = {}
        self.finishes[player] = finishes
    end
    if finishes[sceneId] then
        return false
    end
    finishes[sceneId] = true
    return true
end

function PlayerProgress:clear(player)
    self.checkpoints[player] = nil
    self.checkpointTouches[player] = nil
    self.finishes[player] = nil
end

function PlayerProgress.kill(humanoid)
    humanoid.Health = 0
end

return PlayerProgress

local PlacementController = {}
PlacementController.__index = PlacementController

function PlacementController.new(progress, waitForRootPart, applyPlacement)
    return setmetatable({
        progress = progress,
        waitForRootPart = waitForRootPart,
        applyPlacement = applyPlacement,
        activeScene = nil,
        generation = 0,
    }, PlacementController)
end

function PlacementController:activateScene(sceneKey, startObject, verticalOffset)
    self.generation += 1
    self.activeScene = {
        sceneKey = sceneKey,
        startObject = startObject,
        verticalOffset = verticalOffset,
        generation = self.generation,
    }
end

function PlacementController:placeCharacter(player, character)
    local scene = self.activeScene
    if scene == nil or player.Character ~= character then
        return false
    end

    local rootPart = self.waitForRootPart(character)
    if rootPart == nil or self.activeScene ~= scene or player.Character ~= character then
        return false
    end

    local target = self.progress:respawnObject(player, scene.sceneKey)
    if target == nil then
        target = scene.startObject
    end
    self.applyPlacement(rootPart, target, scene.verticalOffset)
    return true
end

return PlacementController

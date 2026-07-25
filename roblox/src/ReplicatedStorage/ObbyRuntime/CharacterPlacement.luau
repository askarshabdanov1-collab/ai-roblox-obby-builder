local CharacterPlacement = {}

local MINIMUM_HORIZONTAL_DISTANCE_SQUARED = 0.000000000001

local function finiteNumber(value)
    return type(value) == "number" and value == value and math.abs(value) ~= math.huge
end

local function routeYaw(sourcePosition, nextObject)
    if nextObject == nil or type(nextObject.transform) ~= "table" then
        return nil
    end
    local targetPosition = nextObject.transform.position
    if type(targetPosition) ~= "table" then
        return nil
    end
    if
        not finiteNumber(sourcePosition.x)
        or not finiteNumber(sourcePosition.z)
        or not finiteNumber(targetPosition.x)
        or not finiteNumber(targetPosition.z)
    then
        return nil
    end
    local deltaX = targetPosition.x - sourcePosition.x
    local deltaZ = targetPosition.z - sourcePosition.z
    if
        not finiteNumber(deltaX)
        or not finiteNumber(deltaZ)
        or deltaX * deltaX + deltaZ * deltaZ <= MINIMUM_HORIZONTAL_DISTANCE_SQUARED
    then
        return nil
    end
    local yaw = math.deg(math.atan2(-deltaX, -deltaZ)) % 360
    if math.abs(yaw - 360) < 0.000000001 then
        return 0
    end
    return yaw
end

function CharacterPlacement.transformFor(object, placement, nextObject)
    if type(placement) ~= "table" or placement.strategy ~= "humanoid-root-part-cframe-v1" then
        error("character placement strategy is unsupported")
    end
    local verticalOffset = placement.verticalOffset
    if not finiteNumber(verticalOffset) or verticalOffset < 2 or verticalOffset > 20 then
        error("verticalOffset must be between 2 and 20 studs")
    end
    local position = object.transform.position
    local rotation = object.transform.rotation
    local yaw = rotation.y
    if placement.orientationPolicy == "face-next-safe-route-object" then
        yaw = routeYaw(position, nextObject) or yaw
    elseif placement.orientationPolicy ~= "explicit-yaw" then
        error("character placement orientation policy is unsupported")
    end
    return {
        position = {
            x = position.x,
            y = position.y + object.size.y / 2 + verticalOffset,
            z = position.z,
        },
        rotation = {
            x = 0,
            y = yaw,
            z = 0,
        },
    }
end

function CharacterPlacement.apply(rootPart, object, placement, nextObject, cframeFactory)
    rootPart.CFrame = cframeFactory(CharacterPlacement.transformFor(object, placement, nextObject))
end

return CharacterPlacement

local CharacterPlacement = {}

function CharacterPlacement.transformFor(object, verticalOffset)
    if
        type(verticalOffset) ~= "number"
        or verticalOffset ~= verticalOffset
        or math.abs(verticalOffset) == math.huge
        or verticalOffset < 2
    then
        error("verticalOffset must be at least 2 studs")
    end
    local position = object.transform.position
    local rotation = object.transform.rotation
    return {
        position = {
            x = position.x,
            y = position.y + object.size.y / 2 + verticalOffset,
            z = position.z,
        },
        rotation = {
            x = rotation.x,
            y = rotation.y,
            z = rotation.z,
        },
    }
end

function CharacterPlacement.apply(rootPart, object, verticalOffset, cframeFactory)
    rootPart.CFrame = cframeFactory(CharacterPlacement.transformFor(object, verticalOffset))
end

return CharacterPlacement

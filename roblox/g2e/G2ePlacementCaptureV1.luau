local G2ePlacementCaptureV1 = {}

function G2ePlacementCaptureV1.attach(session, readCapture)
    assert(type(session) == "table", "placement capture session is invalid")
    assert(type(session.placeCharacter) == "function", "placement capture requires placeCharacter")
    assert(type(readCapture) == "function", "placement capture reader is invalid")

    local originalPlaceCharacter = session.placeCharacter
    local captures = {}
    session.placeCharacter = function(sessionValue, player, character)
        local result, placementError = originalPlaceCharacter(sessionValue, player, character)
        if result ~= nil then
            local captured = readCapture(sessionValue, player, character)
            if type(captured) == "table" then
                captures[player] = captured
            end
        end
        return result, placementError
    end

    return table.freeze({
        captureFor = function(player)
            return captures[player]
        end,
        completeFor = function(players)
            if type(players) ~= "table" then
                return false
            end
            for _, player in ipairs(players) do
                if captures[player] == nil then
                    return false
                end
            end
            return true
        end,
    })
end

return table.freeze(G2ePlacementCaptureV1)

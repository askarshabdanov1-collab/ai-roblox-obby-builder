local G2eCharacterPartReadinessV1 = {}

local DEFAULT_MAXIMUM_WAIT_ITERATIONS = 120

local function failure(code, field, message, waitIterations)
    return table.freeze({
        code = code,
        field = field,
        message = message,
        waitIterations = waitIterations,
    })
end

local function currentPart(player, findPart)
    local character = player.Character
    if character == nil then
        return nil, nil
    end
    return character, findPart(character)
end

function G2eCharacterPartReadinessV1.await(player, findPart, resumeScheduler, maximumWaitIterations)
    assert(type(player) == "table" or typeof(player) == "Instance", "character readiness player is invalid")
    assert(type(findPart) == "function", "character readiness Part finder is invalid")
    assert(type(resumeScheduler) == "function", "character readiness scheduler is invalid")
    local maximum = maximumWaitIterations or DEFAULT_MAXIMUM_WAIT_ITERATIONS
    assert(type(maximum) == "number" and maximum >= 0 and maximum % 1 == 0, "character readiness bound is invalid")

    local waitIterations = 0
    local character, hit = currentPart(player, findPart)
    while hit == nil and waitIterations < maximum do
        resumeScheduler()
        waitIterations += 1
        character, hit = currentPart(player, findPart)
    end

    if hit ~= nil then
        return table.freeze({
            character = character,
            hit = hit,
            waitIterations = waitIterations,
        }),
            nil
    end
    if character == nil then
        return nil,
            failure(
                "g2e-stale-character-unavailable",
                "player.Character",
                "player character was unavailable after the bounded scheduler wait",
                waitIterations
            )
    end
    return nil,
        failure(
            "g2e-stale-character-part-unavailable",
            "player.Character.BasePart",
            "player character had no BasePart after the bounded scheduler wait",
            waitIterations
        )
end

G2eCharacterPartReadinessV1.DEFAULT_MAXIMUM_WAIT_ITERATIONS = DEFAULT_MAXIMUM_WAIT_ITERATIONS

return table.freeze(G2eCharacterPartReadinessV1)

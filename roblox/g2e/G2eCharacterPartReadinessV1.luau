local G2eCharacterPartReadinessV1 = {}

local DEFAULT_MAXIMUM_WAIT_ITERATIONS = 120

local function failure(code, field, message, waitIterations, counts)
    local value = counts or {}
    return table.freeze({
        code = code,
        field = field,
        message = message,
        waitIterations = waitIterations,
        playerCount = value.playerCount or 0,
        characterCount = value.characterCount or 0,
        basePartCount = value.basePartCount or 0,
    })
end

local function validPlayerKey(value)
    return type(value) == "number"
        and value == value
        and value ~= math.huge
        and value ~= -math.huge
        and value % 1 == 0
        and value ~= 0
end

local function scan(getPlayers, playerKey, findPart)
    local players = getPlayers()
    assert(type(players) == "table", "character readiness players collection is invalid")
    local entries = {}
    local keySeen = {}
    for _, player in ipairs(players) do
        local key = playerKey(player)
        if not validPlayerKey(key) or keySeen[key] then
            return nil,
                failure(
                    "g2e-stale-player-identity",
                    "players.UserId",
                    "connected player identities were invalid or ambiguous",
                    0,
                    { playerCount = #players }
                )
        end
        keySeen[key] = true
        table.insert(entries, { key = key, player = player })
    end
    table.sort(entries, function(left, right)
        return left.key < right.key
    end)

    local characterCount = 0
    local basePartCount = 0
    local ready = {}
    for slot, entry in ipairs(entries) do
        local character = entry.player.Character
        if character ~= nil then
            characterCount += 1
            local hit = findPart(character)
            if hit ~= nil then
                basePartCount += 1
                table.insert(ready, {
                    player = entry.player,
                    character = character,
                    hit = hit,
                    selectedSlot = slot,
                })
            end
        end
    end
    return {
        playerCount = #entries,
        characterCount = characterCount,
        basePartCount = basePartCount,
        ready = ready,
    },
        nil
end

local function unavailable(scanned, waitIterations)
    local suffix = string.format(
        "players=%d characters=%d baseParts=%d waits=%d",
        scanned.playerCount,
        scanned.characterCount,
        scanned.basePartCount,
        waitIterations
    )
    if scanned.playerCount == 0 then
        return failure(
            "g2e-stale-ready-player-unavailable",
            "players",
            "no connected player was available; " .. suffix,
            waitIterations,
            scanned
        )
    elseif scanned.characterCount == 0 then
        return failure(
            "g2e-stale-character-unavailable",
            "players.Character",
            "all connected players had no Character; " .. suffix,
            waitIterations,
            scanned
        )
    elseif scanned.characterCount == scanned.playerCount and scanned.basePartCount == 0 then
        return failure(
            "g2e-stale-character-part-unavailable",
            "players.Character.BasePart",
            "all connected characters had no BasePart; " .. suffix,
            waitIterations,
            scanned
        )
    end
    return failure(
        "g2e-stale-ready-player-unavailable",
        "players.ready",
        "no connected player had both Character and BasePart; " .. suffix,
        waitIterations,
        scanned
    )
end

function G2eCharacterPartReadinessV1.awaitAny(getPlayers, playerKey, findPart, resumeScheduler, maximumWaitIterations)
    assert(type(getPlayers) == "function", "character readiness player supplier is invalid")
    assert(type(playerKey) == "function", "character readiness player key reader is invalid")
    assert(type(findPart) == "function", "character readiness Part finder is invalid")
    assert(type(resumeScheduler) == "function", "character readiness scheduler is invalid")
    local maximum = maximumWaitIterations or DEFAULT_MAXIMUM_WAIT_ITERATIONS
    assert(type(maximum) == "number" and maximum >= 0 and maximum % 1 == 0, "character readiness bound is invalid")

    local waitIterations = 0
    while true do
        local scanned, scanFailure = scan(getPlayers, playerKey, findPart)
        if scanned == nil then
            return nil, scanFailure
        end
        local selected = scanned.ready[1]
        if selected ~= nil then
            return table.freeze({
                player = selected.player,
                character = selected.character,
                hit = selected.hit,
                selectedSlot = selected.selectedSlot,
                waitIterations = waitIterations,
                playerCount = scanned.playerCount,
                characterCount = scanned.characterCount,
                basePartCount = scanned.basePartCount,
            }),
                nil
        end
        if waitIterations >= maximum then
            return nil, unavailable(scanned, waitIterations)
        end
        resumeScheduler()
        waitIterations += 1
    end
end

function G2eCharacterPartReadinessV1.requireAll(getPlayers, playerKey, findPart, expectedPlayerCount)
    assert(type(getPlayers) == "function", "character readiness player supplier is invalid")
    assert(type(playerKey) == "function", "character readiness player key reader is invalid")
    assert(type(findPart) == "function", "character readiness Part finder is invalid")
    assert(
        type(expectedPlayerCount) == "number" and expectedPlayerCount > 0 and expectedPlayerCount % 1 == 0,
        "character readiness expected player count is invalid"
    )
    local scanned, scanFailure = scan(getPlayers, playerKey, findPart)
    if scanned == nil then
        return nil, scanFailure
    end
    if scanned.playerCount ~= expectedPlayerCount then
        return nil,
            failure(
                "g2e-stale-player-count",
                "players.count",
                string.format("expected %d connected players but observed %d", expectedPlayerCount, scanned.playerCount),
                0,
                scanned
            )
    elseif scanned.characterCount ~= scanned.playerCount then
        return nil,
            failure(
                "g2e-stale-character-unavailable",
                "players.Character",
                string.format(
                    "not every connected player had a Character; players=%d characters=%d baseParts=%d waits=0",
                    scanned.playerCount,
                    scanned.characterCount,
                    scanned.basePartCount
                ),
                0,
                scanned
            )
    elseif scanned.basePartCount ~= scanned.playerCount then
        return nil,
            failure(
                "g2e-stale-character-part-unavailable",
                "players.Character.BasePart",
                string.format(
                    "not every connected character had a BasePart; players=%d characters=%d baseParts=%d waits=0",
                    scanned.playerCount,
                    scanned.characterCount,
                    scanned.basePartCount
                ),
                0,
                scanned
            )
    end
    return table.freeze({
        playerCount = scanned.playerCount,
        characterCount = scanned.characterCount,
        basePartCount = scanned.basePartCount,
    }),
        nil
end

G2eCharacterPartReadinessV1.DEFAULT_MAXIMUM_WAIT_ITERATIONS = DEFAULT_MAXIMUM_WAIT_ITERATIONS

return table.freeze(G2eCharacterPartReadinessV1)

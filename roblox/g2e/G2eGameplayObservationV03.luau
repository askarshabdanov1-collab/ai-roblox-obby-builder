local G2eGameplayObservationV03 = {}

local EPSILON = 0.000001

local function overlap(leftMinimum, leftMaximum, rightMinimum, rightMaximum)
    return math.min(leftMaximum, rightMaximum) - math.max(leftMinimum, rightMinimum)
end

function G2eGameplayObservationV03.geometrySummary(manifest)
    local objects = manifest.layers.gameplay.objects
    local intersections = 0
    local coplanar = 0
    local checkedPairs = 0
    for leftIndex = 1, #objects do
        local left = objects[leftIndex]
        local leftBounds = left.geometry.axisAlignedBounds
        for rightIndex = leftIndex + 1, #objects do
            checkedPairs += 1
            local right = objects[rightIndex]
            local rightBounds = right.geometry.axisAlignedBounds
            local x = overlap(leftBounds.minimum.x, leftBounds.maximum.x, rightBounds.minimum.x, rightBounds.maximum.x)
            local y = overlap(leftBounds.minimum.y, leftBounds.maximum.y, rightBounds.minimum.y, rightBounds.maximum.y)
            local z = overlap(leftBounds.minimum.z, leftBounds.maximum.z, rightBounds.minimum.z, rightBounds.maximum.z)
            if x > EPSILON and y > EPSILON and z > EPSILON then
                intersections += 1
                if
                    math.abs(leftBounds.maximum.y - rightBounds.maximum.y) <= EPSILON
                    or math.abs(leftBounds.minimum.y - rightBounds.minimum.y) <= EPSILON
                then
                    coplanar += 1
                end
            end
        end
    end
    return table.freeze({
        checkedPairs = checkedPairs,
        unauthorizedGeometryIntersections = intersections,
        coplanarVisibleSurfaces = coplanar,
        epsilonStuds = EPSILON,
    })
end

local function observation(id, passed)
    return table.freeze({ id = id, status = if passed then "PASS" else "FAIL" })
end

function G2eGameplayObservationV03.build(fixtureId, manifest, snapshot)
    snapshot = if type(snapshot) == "table" then snapshot else {}
    local geometry = G2eGameplayObservationV03.geometrySummary(manifest)
    local observations = {
        observation("hazard-callback-bound", (snapshot.hazardConnections or 0) > 0),
        observation("hazard-touch-callback-fired", (snapshot.hazardTouchCallbacks or 0) > 0),
        observation("valid-character-touch-observed", (snapshot.validHazardCharacterTouches or 0) > 0),
        observation("humanoid-resolved", (snapshot.humanoidsResolved or 0) > 0),
        observation("lethal-action-observed", (snapshot.lethalActions or 0) > 0),
        observation("expected-respawn-observed", (snapshot.respawnsObserved or 0) > 0),
        observation("checkpoint-respawn-preserved", (snapshot.checkpointRespawnsObserved or 0) > 0),
        observation("initial-spawn-fallback-preserved", (snapshot.spawnRespawnsObserved or 0) > 0),
        observation("second-player-independent", (snapshot.lethalPlayerCount or 0) > 1),
        observation("stale-callback-rejected", (snapshot.staleCallbackRejections or 0) > 0),
        observation(
            "zero-stale-callback-actions",
            (snapshot.replacementCount or 0) > 0 and (snapshot.staleAcceptedActions or 0) == 0
        ),
        observation("zero-unauthorized-geometry-intersections", geometry.unauthorizedGeometryIntersections == 0),
        observation("zero-coplanar-visible-surfaces", geometry.coplanarVisibleSurfaces == 0),
    }
    local passed = true
    local diagnosticField = nil
    for _, value in ipairs(observations) do
        if value.status ~= "PASS" then
            passed = false
            diagnosticField = value.id
            break
        end
    end
    return table.freeze({
        schemaVersion = "g2-gameplay-observation-v1",
        fixtureId = fixtureId,
        manifestHash = manifest.manifestHash,
        status = if passed then "PASS" else "FAIL",
        diagnosticCode = if passed then nil else "gameplay-evidence-incomplete",
        diagnosticField = diagnosticField,
        observations = table.freeze(observations),
        hazardConnections = snapshot.hazardConnections or 0,
        touchCallbacks = snapshot.touchCallbacks or 0,
        hazardTouchCallbacks = snapshot.hazardTouchCallbacks or 0,
        validCharacterTouches = snapshot.validCharacterTouches or 0,
        validHazardCharacterTouches = snapshot.validHazardCharacterTouches or 0,
        humanoidsResolved = snapshot.humanoidsResolved or 0,
        lethalActions = snapshot.lethalActions or 0,
        lethalPlayerCount = snapshot.lethalPlayerCount or 0,
        respawnsObserved = snapshot.respawnsObserved or 0,
        checkpointRespawnsObserved = snapshot.checkpointRespawnsObserved or 0,
        spawnRespawnsObserved = snapshot.spawnRespawnsObserved or 0,
        staleCallbackRejections = snapshot.staleCallbackRejections or 0,
        staleAcceptedActions = snapshot.staleAcceptedActions or 0,
        replacementCount = snapshot.replacementCount or 0,
        checkedGeometryPairs = geometry.checkedPairs,
        unauthorizedGeometryIntersections = geometry.unauthorizedGeometryIntersections,
        coplanarVisibleSurfaces = geometry.coplanarVisibleSurfaces,
        epsilonStuds = geometry.epsilonStuds,
        lastHazardObjectId = snapshot.lastHazardObjectId,
        lastTouchedPartName = snapshot.lastTouchedPartName,
        lastTouchedPartClass = snapshot.lastTouchedPartClass,
        lastCharacterResolved = snapshot.lastCharacterResolved == true,
        lastHumanoidResolved = snapshot.lastHumanoidResolved == true,
        lastLethalAction = snapshot.lastLethalAction == true,
    })
end

return table.freeze(G2eGameplayObservationV03)

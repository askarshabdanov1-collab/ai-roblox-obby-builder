local G2eAcceptanceRecordsV1 = {}

local function frozenSortedCopy(values, field)
    local copied = {}
    for _, value in ipairs(values) do
        table.insert(copied, value)
    end
    table.sort(copied, function(left, right)
        return left[field] < right[field]
    end)
    return table.freeze(copied)
end

function G2eAcceptanceRecordsV1.precondition(repositoryCommit, activeRootCount)
    return table.freeze({
        schemaVersion = "g2e-precondition-v1",
        repositoryCommit = repositoryCommit,
        status = if activeRootCount == 0 then "PASS" else "FAIL",
        activeRootCount = activeRootCount,
        expectedActiveRootCount = 0,
        firstFailingField = if activeRootCount == 0 then "none" else "activeRootCount",
    })
end

function G2eAcceptanceRecordsV1.partInspection(
    repositoryCommit,
    fixtureId,
    manifestHash,
    objects,
    helper,
    decorativeSafeRouteExcluded
)
    local seen = {}
    for _, object in ipairs(objects) do
        assert(type(object.objectId) == "string" and object.objectId ~= "", "part inspection object ID is invalid")
        assert(seen[object.objectId] == nil, "part inspection object ID is ambiguous")
        seen[object.objectId] = true
    end
    return table.freeze({
        schemaVersion = "g2e-part-inspection-v1",
        repositoryCommit = repositoryCommit,
        fixtureId = fixtureId,
        manifestHash = manifestHash,
        status = if decorativeSafeRouteExcluded then "PASS" else "FAIL",
        objectCount = #objects,
        decorativeSafeRouteExcluded = decorativeSafeRouteExcluded,
        firstFailingField = if decorativeSafeRouteExcluded then "none" else "decorativeSafeRouteExcluded",
        objects = frozenSortedCopy(objects, "objectId"),
        helper = helper,
    })
end

function G2eAcceptanceRecordsV1.placement(
    repositoryCommit,
    fixtureId,
    manifestHash,
    phase,
    players,
    tolerance,
    captureWaitIterations
)
    local status = "PASS"
    local firstFailingField = "none"
    for _, player in ipairs(players) do
        if player.status ~= "PASS" then
            status = "FAIL"
            firstFailingField = "playerSlot-" .. tostring(player.playerSlot) .. ".cframe"
            break
        end
    end
    return table.freeze({
        schemaVersion = "g2e-placement-observation-v2",
        repositoryCommit = repositoryCommit,
        fixtureId = fixtureId,
        manifestHash = manifestHash,
        phase = phase,
        status = status,
        tolerance = tolerance,
        observationBasis = "runtime-placement-assignment",
        captureWaitIterations = captureWaitIterations,
        maximumCaptureWaitIterations = 120,
        playerCount = #players,
        firstFailingField = firstFailingField,
        players = frozenSortedCopy(players, "playerSlot"),
    })
end

function G2eAcceptanceRecordsV1.finish(repositoryCommit, fixtureId, manifestHash, phase, first, second)
    local expectedFirst = true
    local expectedSecond = phase == "both-finished"
    local passed = first == expectedFirst and second == expectedSecond
    return table.freeze({
        schemaVersion = "g2e-finish-observation-v1",
        repositoryCommit = repositoryCommit,
        fixtureId = fixtureId,
        manifestHash = manifestHash,
        phase = phase,
        status = if passed then "PASS" else "FAIL",
        playerCount = 2,
        firstPlayerFinished = first,
        secondPlayerFinished = second,
        expectedFirstPlayerFinished = expectedFirst,
        expectedSecondPlayerFinished = expectedSecond,
        firstFailingField = if passed then "none" else "finishIsolation",
    })
end

function G2eAcceptanceRecordsV1.progress(repositoryCommit, manifestHash, fields)
    local passed = fields.sameHashCheckpointPreserved
        and fields.sameHashFinishPreserved
        and fields.differentHashCheckpointCleared
        and fields.differentHashFinishCleared
        and fields.staleCharacterPlacementRejected
        and fields.staleCheckpointRejected
        and fields.staleKillRejected
        and fields.staleFinishRejected
        and fields.restoredReference
    return table.freeze({
        schemaVersion = "g2e-progress-stale-observation-v1",
        repositoryCommit = repositoryCommit,
        fixtureId = "reference",
        manifestHash = manifestHash,
        status = if passed then "PASS" else "FAIL",
        sameHashCheckpointPreserved = fields.sameHashCheckpointPreserved,
        sameHashFinishPreserved = fields.sameHashFinishPreserved,
        differentHashCheckpointCleared = fields.differentHashCheckpointCleared,
        differentHashFinishCleared = fields.differentHashFinishCleared,
        staleCharacterPlacementRejected = fields.staleCharacterPlacementRejected,
        staleCheckpointRejected = fields.staleCheckpointRejected,
        staleKillRejected = fields.staleKillRejected,
        staleFinishRejected = fields.staleFinishRejected,
        restoredReference = fields.restoredReference,
        firstFailingField = if passed then "none" else "progressOrStaleCallback",
    })
end

function G2eAcceptanceRecordsV1.ownership(repositoryCommit, manifestHash, cases, transactionPreserved)
    local passed = transactionPreserved
    for _, case in ipairs(cases) do
        if case.status ~= "PASS" then
            passed = false
            break
        end
    end
    return table.freeze({
        schemaVersion = "g2e-ownership-refusal-v1",
        repositoryCommit = repositoryCommit,
        fixtureId = "reference",
        manifestHash = manifestHash,
        status = if passed then "PASS" else "FAIL",
        caseCount = #cases,
        transactionPreserved = transactionPreserved,
        firstFailingField = if passed then "none" else "ownershipRefusal",
        cases = frozenSortedCopy(cases, "scenario"),
    })
end

function G2eAcceptanceRecordsV1.zeroCheckpoint(repositoryCommit, manifestHash, fields)
    local passed = fields.playerCount == 2
        and fields.checkpointStateClear
        and fields.checkpointAttributesClear
        and fields.respawnsObserved >= 2
        and fields.spawnRespawnsObserved >= 2
    return table.freeze({
        schemaVersion = "g2e-zero-checkpoint-observation-v1",
        repositoryCommit = repositoryCommit,
        fixtureId = "minimum-zero-checkpoint",
        manifestHash = manifestHash,
        status = if passed then "PASS" else "FAIL",
        playerCount = fields.playerCount,
        checkpointStateClear = fields.checkpointStateClear,
        checkpointAttributesClear = fields.checkpointAttributesClear,
        respawnsObserved = fields.respawnsObserved,
        spawnRespawnsObserved = fields.spawnRespawnsObserved,
        firstFailingField = if passed then "none" else "zeroCheckpointPlayers",
    })
end

return table.freeze(G2eAcceptanceRecordsV1)

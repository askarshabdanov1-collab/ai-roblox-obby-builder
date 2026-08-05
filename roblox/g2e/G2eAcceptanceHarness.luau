local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")
local G2eObservationV03 = require("./G2eObservationV03")
local G2eGameplayObservationV03 = require("./G2eGameplayObservationV03")
local G2eAcceptanceRecordsV1 = require("./G2eAcceptanceRecordsV1")
local G2eControlProtocol = require("./G2eControlProtocol")
local G2ePlacementCaptureV1 = require("./G2ePlacementCaptureV1")
local CharacterPlacement = require(ReplicatedStorage.ObbyRuntime.CharacterPlacement)
local SafeRouteNavigator = require(ReplicatedStorage.ObbyRuntime.SafeRouteNavigator)
local RuntimeSessionV03 = require(ReplicatedStorage.ObbyRuntime.RuntimeSessionV03)

local G2eAcceptanceHarness = {}

local MEASUREMENT_PREFIX = "[G2 runtime measurement] "
local OBSERVATION_PREFIX = "[G2 acceptance observation] "
local GAMEPLAY_OBSERVATION_PREFIX = "[G2 gameplay observation] "
local HAZARD_TRACE_PREFIX = "[G2 hazard trace] "
local PRECONDITION_PREFIX = "[G2 precondition] "
local PART_INSPECTION_PREFIX = "[G2 part inspection] "
local PLACEMENT_PREFIX = "[G2 placement observation] "
local FINISH_PREFIX = "[G2 finish observation] "
local PROGRESS_PREFIX = "[G2 progress observation] "
local OWNERSHIP_PREFIX = "[G2 ownership observation] "
local ZERO_CHECKPOINT_PREFIX = "[G2 zero-checkpoint observation] "
local CONTROL_PREFIX = "[G2 control result] "
local placementCaptureBySession = setmetatable({}, { __mode = "k" })

local function approximately(actual, expected)
    return math.abs(actual - expected) < 0.00001
end

local function activeRootCount()
    local count = 0
    for _, child in ipairs(workspace:GetChildren()) do
        if child.Name == "GeneratedObby" then
            count += 1
        end
    end
    return count
end

local function emit(prefix, value)
    print(prefix .. HttpService:JSONEncode(value))
    return value
end

function G2eAcceptanceHarness.emitPrecondition(repositoryCommit)
    return emit(PRECONDITION_PREFIX, G2eAcceptanceRecordsV1.precondition(repositoryCommit, activeRootCount()))
end

local function assertVector(actual, expected, label)
    assert(approximately(actual.X, expected.x), label .. " X changed")
    assert(approximately(actual.Y, expected.y), label .. " Y changed")
    assert(approximately(actual.Z, expected.z), label .. " Z changed")
end

local function expectedClass(object)
    if object.shape == "Wedge" then
        return "WedgePart"
    end
    return "Part"
end

local function expectedShape(object)
    if object.shape == "Block" then
        return Enum.PartType.Block
    elseif object.shape == "Ball" then
        return Enum.PartType.Ball
    elseif object.shape == "Cylinder" then
        return Enum.PartType.Cylinder
    end
    return nil
end

local function expectedMaterial(name)
    if name == "Neon" then
        return Enum.Material.Neon
    end
    return Enum.Material.SmoothPlastic
end

local function expectedColor(hex)
    return Color3.fromRGB(
        tonumber(string.sub(hex, 2, 3), 16),
        tonumber(string.sub(hex, 4, 5), 16),
        tonumber(string.sub(hex, 6, 7), 16)
    )
end

local function expectedCFrame(transform)
    local position = transform.position
    local rotation = transform.rotation
    return CFrame.new(position.x, position.y, position.z)
        * CFrame.fromEulerAnglesXYZ(math.rad(rotation.x), math.rad(rotation.y), math.rad(rotation.z))
end

local function assertPart(part, object, layer)
    assert(part ~= nil, object.id .. " was not constructed")
    assert(part.ClassName == expectedClass(object), object.id .. " native class changed")
    assert(part:IsA("BasePart"), object.id .. " is not a BasePart")
    assert(part.Name == object.id, object.id .. " name changed")
    assertVector(part.Size, object.size, object.id .. " size")
    assert(part.CFrame:FuzzyEq(expectedCFrame(object.transform), 0.00001), object.id .. " transform changed")
    assert(part.Color == expectedColor(object.appearance.color), object.id .. " color changed")
    assert(part.Material == expectedMaterial(object.appearance.material), object.id .. " material changed")
    assert(part.Anchored == object.collision.anchored, object.id .. " anchored changed")
    assert(part.CanCollide == object.collision.canCollide, object.id .. " collision changed")
    assert(part.CanTouch == object.collision.canTouch, object.id .. " touch changed")
    assert(part.CanQuery == object.collision.canQuery, object.id .. " query changed")
    assert(part:GetAttribute("ObjectId") == object.id, object.id .. " identity attribute changed")
    assert(part:GetAttribute("Layer") == layer, object.id .. " layer attribute changed")
    if part:IsA("Part") then
        assert(part.Shape == expectedShape(object), object.id .. " shape changed")
    end
    if layer == "decorative" then
        assert(
            not part.CanCollide and not part.CanTouch and not part.CanQuery,
            object.id .. " decoration is authoritative"
        )
    end
end

local function countDescendants(root)
    local counts = {
        baseParts = 0,
        folders = 0,
        spawnLocations = 0,
        total = 1,
    }
    for _, descendant in ipairs(root:GetDescendants()) do
        counts.total += 1
        if descendant:IsA("BasePart") then
            counts.baseParts += 1
        end
        if descendant:IsA("Folder") then
            counts.folders += 1
        end
        if descendant:IsA("SpawnLocation") then
            counts.spawnLocations += 1
        end
    end
    return counts
end

function G2eAcceptanceHarness.assertScene(result, manifest)
    local root = result.root
    assert(root.Parent == workspace, "GeneratedObby is not in Workspace")
    assert(root.Name == "GeneratedObby", "active root name changed")
    assert(root:GetAttribute("GeneratedBy") == "AIObbyBuilder/0.3", "active root owner changed")
    assert(root:GetAttribute("ManifestHash") == manifest.manifestHash, "active manifest identity changed")
    assert(root:GetAttribute("CandidateState") == "active", "active root state changed")

    local gameplay = root:FindFirstChild("Gameplay")
    local decorative = root:FindFirstChild("Decorative")
    local infrastructure = root:FindFirstChild("RuntimeInfrastructure")
    local metadata = root:FindFirstChild("Metadata")
    assert(gameplay and decorative and infrastructure and metadata, "candidate hierarchy is incomplete")
    assert(#gameplay:GetChildren() == #manifest.layers.gameplay.objects, "gameplay object count changed")
    assert(#decorative:GetChildren() == #manifest.layers.decorative.objects, "decorative object count changed")

    for _, object in ipairs(manifest.layers.gameplay.objects) do
        assertPart(gameplay:FindFirstChild(object.id), object, "gameplay")
    end
    for _, object in ipairs(manifest.layers.decorative.objects) do
        assertPart(decorative:FindFirstChild(object.id), object, "decorative")
    end

    local helper = infrastructure:FindFirstChild("_RuntimeSpawnLocation")
    assert(helper and helper:IsA("SpawnLocation"), "runtime SpawnLocation helper is missing")
    assert(helper.Transparency == 1, "runtime SpawnLocation is visible")
    assert(
        not helper.CanCollide and not helper.CanTouch and not helper.CanQuery,
        "runtime SpawnLocation is authoritative"
    )
    assert(helper:GetAttribute("NonAuthoritative") == true, "runtime SpawnLocation marker changed")

    local counts = countDescendants(root)
    assert(counts.spawnLocations == 1, "runtime SpawnLocation count changed")
    assert(
        counts.baseParts == #manifest.layers.gameplay.objects + #manifest.layers.decorative.objects + 1,
        "BasePart count changed"
    )
    assert(counts.folders == 4, "candidate container count changed")
    assert(result.session:connectionCount() <= #manifest.layers.gameplay.objects, "connection bound changed")
    return counts
end

function G2eAcceptanceHarness.emitMeasurement(
    environment,
    fixtureId,
    manifest,
    runKind,
    runIndex,
    monotonicStart,
    monotonicEnd,
    result,
    beforeHeap,
    afterHeap,
    heapStatus,
    builder,
    configuredCollections
)
    local counts = G2eAcceptanceHarness.assertScene(result, manifest)
    local geometry = G2eGameplayObservationV03.geometrySummary(manifest)
    local collections = configuredCollections
        or {
            observations = {
                { id = "scene-assertions", status = "PASS" },
                {
                    id = "zero-unauthorized-geometry-intersections",
                    status = if geometry.unauthorizedGeometryIntersections == 0 then "PASS" else "FAIL",
                },
                {
                    id = "zero-coplanar-visible-surfaces",
                    status = if geometry.coplanarVisibleSurfaces == 0 then "PASS" else "FAIL",
                },
            },
            warnings = {},
            errors = {},
            evidence = { "scene-assertions", "geometry-integrity" },
            requiredObservationIds = {
                "scene-assertions",
                "zero-unauthorized-geometry-intersections",
                "zero-coplanar-visible-surfaces",
            },
            requiredEvidenceIds = { "scene-assertions", "geometry-integrity" },
        }
    local observation = G2eObservationV03.build({
        fixtureId = fixtureId,
        manifest = manifest,
        counts = counts,
        collections = collections,
    })
    local observationPassed, diagnosticMessage, normalizedObservation = G2eObservationV03.formatResult(observation)
    observation = normalizedObservation
    local checkpointConnections = 0
    local killConnections = 0
    local finishConnections = 0
    for _, record in ipairs(result.session.candidate.plan.gameplayRecords) do
        if record.role == "checkpoint" and record.behavior.kind == "checkpoint" then
            checkpointConnections += 1
        elseif record.role == "kill" and record.behavior.kind == "kill" then
            killConnections += 1
        elseif record.role == "finish" and record.behavior.kind == "finish" then
            finishConnections += 1
        end
    end
    local characterAddedConnections = 0
    for _ in pairs(builder.playerConnectionByPlayer) do
        characterAddedConnections += 1
    end
    local coordinatorConnections = #builder.coordinatorConnections
    local sessionConnections = result.session:connectionCount()
    local measurement = {
        schemaVersion = "g2-studio-measurement-v2",
        repositoryCommit = environment.repositoryCommit,
        studioVersion = environment.studioVersion,
        osBuild = environment.osBuild,
        fixtureId = fixtureId,
        manifestHash = manifest.manifestHash,
        runKind = runKind,
        runIndex = runIndex,
        monotonicStartSeconds = monotonicStart,
        monotonicEndSeconds = monotonicEnd,
        elapsedMilliseconds = (monotonicEnd - monotonicStart) * 1000,
        gameplayObjects = #manifest.layers.gameplay.objects,
        decorativeObjects = #manifest.layers.decorative.objects,
        runtimeOwnedInstances = counts.total,
        activeRootCount = activeRootCount(),
        checkpointConnections = checkpointConnections,
        killConnections = killConnections,
        finishConnections = finishConnections,
        sessionConnections = sessionConnections,
        characterAddedConnections = characterAddedConnections,
        playerAddedConnections = if coordinatorConnections >= 1 then 1 else 0,
        playerRemovingConnections = if coordinatorConnections >= 2 then 1 else 0,
        coordinatorConnections = coordinatorConnections,
        totalConnections = sessionConnections + characterAddedConnections + coordinatorConnections,
        connections = sessionConnections,
        luaHeapStatus = heapStatus,
        luaHeapKilobytesBefore = beforeHeap,
        luaHeapKilobytesAfter = afterHeap,
        warnings = observation.warningCount,
        errors = observation.errorCount,
        orphans = 0,
    }
    for _, record in ipairs(G2eObservationV03.orderedRecords(measurement, observation)) do
        local prefix = if record.kind == "measurement" then MEASUREMENT_PREFIX else OBSERVATION_PREFIX
        print(prefix .. HttpService:JSONEncode(record.payload))
    end
    if not observationPassed then
        warn("[G2 acceptance diagnostic] " .. diagnosticMessage)
    end
    return measurement, observation
end

function G2eAcceptanceHarness.formatObservationResult(observation)
    return G2eObservationV03.formatResult(observation)
end

function G2eAcceptanceHarness.formatTypedDiagnostic(code, field, message)
    return G2eObservationV03.formatTypedDiagnostic(code, field, message)
end

local function findObjectById(objects, objectId)
    for _, object in ipairs(objects) do
        if object.id == objectId then
            return object
        end
    end
    return nil
end

local function attributeRecord(part, name)
    return table.freeze({ name = name, value = part:GetAttribute(name) })
end

local function vectorRecord(value)
    return table.freeze({ value.X, value.Y, value.Z })
end

local function cframeRecord(value)
    return table.freeze({ value:GetComponents() })
end

local function colorRecord(value)
    return table.freeze({
        math.round(value.R * 255),
        math.round(value.G * 255),
        math.round(value.B * 255),
    })
end

local function inspectionRecord(part, object, layer)
    local tags = CollectionService:GetTags(part)
    table.sort(tags)
    return table.freeze({
        objectId = object.id,
        name = part.Name,
        className = part.ClassName,
        shape = if part:IsA("Part") then part.Shape.Name else "Wedge",
        role = object.role,
        layer = layer,
        expectedCFrame = cframeRecord(expectedCFrame(object.transform)),
        observedCFrame = cframeRecord(part.CFrame),
        size = vectorRecord(part.Size),
        material = part.Material.Name,
        colorRgb = colorRecord(part.Color),
        anchored = part.Anchored,
        canCollide = part.CanCollide,
        canTouch = part.CanTouch,
        canQuery = part.CanQuery,
        collisionGroup = part.CollisionGroup,
        attributes = table.freeze({
            attributeRecord(part, "Layer"),
            attributeRecord(part, "ManifestHash"),
            attributeRecord(part, "ObjectId"),
            attributeRecord(part, "Role"),
            attributeRecord(part, "SceneId"),
            attributeRecord(part, "SchemaVersion"),
        }),
        tags = table.freeze(tags),
    })
end

local function helperInspectionRecord(helper)
    local tags = CollectionService:GetTags(helper)
    table.sort(tags)
    return table.freeze({
        objectId = "_RuntimeSpawnLocation",
        name = helper.Name,
        className = helper.ClassName,
        layer = "infrastructure",
        cframe = cframeRecord(helper.CFrame),
        size = vectorRecord(helper.Size),
        transparency = helper.Transparency,
        anchored = helper.Anchored,
        canCollide = helper.CanCollide,
        canTouch = helper.CanTouch,
        canQuery = helper.CanQuery,
        collisionGroup = helper.CollisionGroup,
        attributes = table.freeze({ attributeRecord(helper, "NonAuthoritative") }),
        tags = table.freeze(tags),
    })
end

function G2eAcceptanceHarness.emitPartInspection(repositoryCommit, fixtureId, manifest, result)
    G2eAcceptanceHarness.assertScene(result, manifest)
    local objects = {}
    local seen = {}
    for _, layer in ipairs({ "gameplay", "decorative" }) do
        for _, object in ipairs(manifest.layers[layer].objects) do
            assert(seen[object.id] == nil, "ambiguous G2e object ID: " .. object.id)
            seen[object.id] = true
            local part = result.session.candidate.partById[object.id]
            assert(part ~= nil, "unknown G2e object ID: " .. object.id)
            table.insert(objects, inspectionRecord(part, object, layer))
        end
    end
    local safeRouteIds = {}
    for _, objectId in ipairs(manifest.navigation.safeRouteObjectIds) do
        safeRouteIds[objectId] = true
    end
    local decorativeSafeRouteExcluded = true
    for _, object in ipairs(manifest.layers.decorative.objects) do
        if safeRouteIds[object.id] then
            decorativeSafeRouteExcluded = false
            break
        end
    end
    local helper = result.root.RuntimeInfrastructure:FindFirstChild("_RuntimeSpawnLocation")
    assert(helper ~= nil and helper:IsA("SpawnLocation"), "runtime SpawnLocation helper is unavailable")
    return emit(
        PART_INSPECTION_PREFIX,
        G2eAcceptanceRecordsV1.partInspection(
            repositoryCommit,
            fixtureId,
            manifest.manifestHash,
            objects,
            helperInspectionRecord(helper),
            decorativeSafeRouteExcluded
        )
    )
end

function G2eAcceptanceHarness.emitHazardTrace(fixtureId, manifest, result, objectId)
    assert(type(objectId) == "string" and #objectId <= 80, "hazard trace object ID is invalid")
    local object = findObjectById(manifest.layers.gameplay.objects, objectId)
    local record = findObjectById(result.session.candidate.plan.gameplayRecords, objectId)
    local part = result.session.candidate.partById[objectId]
    assert(object ~= nil and object.role == "kill", "hazard trace manifest object is invalid")
    assert(record ~= nil and record.role == "kill", "hazard trace build-plan record is invalid")
    assert(part ~= nil and part:IsA("BasePart"), "hazard trace Part is unavailable")
    local tags = CollectionService:GetTags(part)
    table.sort(tags)
    local snapshot = result.session:acceptanceSnapshot()
    local trace = table.freeze({
        schemaVersion = "g2-hazard-trace-v1",
        fixtureId = fixtureId,
        manifestHash = manifest.manifestHash,
        objectId = object.id,
        sourceStageId = object.sourceReferences.sourceStageId,
        sourceMechanicIntentId = object.sourceReferences.sourceMechanicIntentId,
        sourceHazardId = object.sourceReferences.sourceHazardId,
        manifestRole = object.role,
        manifestBehaviorKind = object.behavior.kind,
        manifestKillMode = object.behavior.killMode,
        planRole = record.role,
        planBehaviorKind = record.behavior.kind,
        planKillMode = record.behavior.killMode,
        partName = part.Name,
        partClass = part.ClassName,
        attributes = table.freeze({
            attributeRecord(part, "ObjectId"),
            attributeRecord(part, "Layer"),
            attributeRecord(part, "Role"),
            attributeRecord(part, "SceneId"),
            attributeRecord(part, "ManifestHash"),
            attributeRecord(part, "SchemaVersion"),
        }),
        tags = table.freeze(tags),
        canTouch = part.CanTouch,
        canCollide = part.CanCollide,
        canQuery = part.CanQuery,
        anchored = part.Anchored,
        collisionGroup = part.CollisionGroup,
        touchConnectionBound = result.session:touchConnectionBound(objectId),
        hazardTouchCallbacks = snapshot.hazardTouchCallbacks,
        validHazardCharacterTouches = snapshot.validHazardCharacterTouches,
        humanoidsResolved = snapshot.humanoidsResolved,
        lethalActions = snapshot.lethalActions,
        respawnsObserved = snapshot.respawnsObserved,
        checkpointRespawnsObserved = snapshot.checkpointRespawnsObserved,
        spawnRespawnsObserved = snapshot.spawnRespawnsObserved,
        lastHazardObjectId = snapshot.lastHazardObjectId,
        lastTouchedPartName = snapshot.lastTouchedPartName,
        lastTouchedPartClass = snapshot.lastTouchedPartClass,
        lastCharacterResolved = snapshot.lastCharacterResolved,
        lastHumanoidResolved = snapshot.lastHumanoidResolved,
        lastLethalAction = snapshot.lastLethalAction,
    })
    print(HAZARD_TRACE_PREFIX .. HttpService:JSONEncode(trace))
    return trace
end

function G2eAcceptanceHarness.emitGameplayObservation(fixtureId, manifest, session, replacementCount, staleEvidence)
    local snapshot = table.clone(session:acceptanceSnapshot())
    snapshot.replacementCount = replacementCount
    local evidence = if type(staleEvidence) == "table" then staleEvidence else {}
    snapshot.staleCallbackRejections += evidence.staleCallbackRejections or 0
    snapshot.staleAcceptedActions += evidence.staleAcceptedActions or 0
    local observation = G2eGameplayObservationV03.build(fixtureId, manifest, snapshot)
    print(GAMEPLAY_OBSERVATION_PREFIX .. HttpService:JSONEncode(observation))
    if observation.status ~= "PASS" then
        warn(
            "[G2 acceptance diagnostic] "
                .. G2eObservationV03.formatTypedDiagnostic(
                    observation.diagnosticCode,
                    observation.diagnosticField,
                    "manual checks remain"
                )
        )
    end
    return observation
end

local function receiptPlayers()
    local players = Players:GetPlayers()
    assert(#players == 2, "exactly two players are required for this G2e observation")
    return players
end

local function placementObjectFor(manifest, checkpointOrder)
    if checkpointOrder > 0 then
        for _, object in ipairs(manifest.layers.gameplay.objects) do
            if
                object.role == "checkpoint"
                and object.behavior.kind == "checkpoint"
                and object.behavior.checkpointOrder == checkpointOrder
            then
                return object, "checkpoint"
            end
        end
    end
    for _, object in ipairs(manifest.layers.gameplay.objects) do
        if object.id == manifest.navigation.spawnObjectId and object.role == "spawn" then
            return object, "spawn"
        end
    end
    error("G2e placement target is unavailable")
end

function G2eAcceptanceHarness.attachPlacementCapture(session)
    local capture = G2ePlacementCaptureV1.attach(session, function(sessionValue, player, character)
        local rootPart = character and character:FindFirstChild("HumanoidRootPart") or nil
        if rootPart == nil or not rootPart:IsA("BasePart") then
            return nil
        end
        return table.freeze({
            observedCFrame = rootPart.CFrame,
            checkpointOrder = sessionValue:checkpointOrder(player) or 0,
        })
    end)
    placementCaptureBySession[session] = capture
    return capture
end

function G2eAcceptanceHarness.placementCapturesReady(session, players)
    local capture = placementCaptureBySession[session]
    return capture ~= nil and capture.completeFor(players)
end

function G2eAcceptanceHarness.emitPlacementObservation(
    repositoryCommit,
    fixtureId,
    manifest,
    session,
    phase,
    captureWaitIterations
)
    assert(phase == "initial" or phase == "respawn" or phase == "zero-respawn", "placement phase is invalid")
    local navigator = SafeRouteNavigator.new(manifest)
    local records = {}
    local captureController = placementCaptureBySession[session]
    for index, player in ipairs(receiptPlayers()) do
        local capture = if captureController == nil then nil else captureController.captureFor(player)
        local checkpointOrder = if capture == nil then 0 else capture.checkpointOrder
        local object, placementKind = placementObjectFor(manifest, checkpointOrder)
        local transform = CharacterPlacement.transformFor(
            object,
            manifest.navigation.characterPlacement,
            navigator:nextObject(object.id)
        )
        local expected = expectedCFrame(transform)
        local observed = if capture == nil then nil else capture.observedCFrame
        local matches = observed ~= nil and observed:FuzzyEq(expected, 0.00001)
        table.insert(
            records,
            table.freeze({
                playerSlot = index,
                placementKind = placementKind,
                objectId = object.id,
                checkpointOrder = checkpointOrder,
                captureStatus = if capture == nil then "missing" else "captured-at-runtime-placement",
                expectedCFrame = cframeRecord(expected),
                observedCFrame = if observed == nil then table.freeze({}) else cframeRecord(observed),
                status = if matches then "PASS" else "FAIL",
            })
        )
    end
    return emit(
        PLACEMENT_PREFIX,
        G2eAcceptanceRecordsV1.placement(
            repositoryCommit,
            fixtureId,
            manifest.manifestHash,
            phase,
            records,
            0.00001,
            captureWaitIterations
        )
    )
end

function G2eAcceptanceHarness.emitFinishObservation(repositoryCommit, fixtureId, manifest, session, phase)
    assert(phase == "player-a-only" or phase == "both-finished", "finish phase is invalid")
    local players = receiptPlayers()
    return emit(
        FINISH_PREFIX,
        G2eAcceptanceRecordsV1.finish(
            repositoryCommit,
            fixtureId,
            manifest.manifestHash,
            phase,
            session:finished(players[1]),
            session:finished(players[2])
        )
    )
end

function G2eAcceptanceHarness.emitProgressObservation(repositoryCommit, manifestHash, fields)
    return emit(PROGRESS_PREFIX, G2eAcceptanceRecordsV1.progress(repositoryCommit, manifestHash, fields))
end

function G2eAcceptanceHarness.emitOwnershipObservation(repositoryCommit, manifestHash, cases, preserved)
    return emit(OWNERSHIP_PREFIX, G2eAcceptanceRecordsV1.ownership(repositoryCommit, manifestHash, cases, preserved))
end

function G2eAcceptanceHarness.emitZeroCheckpointObservation(repositoryCommit, manifest, session, captureWaitIterations)
    local players = receiptPlayers()
    local checkpointStateClear = true
    local checkpointAttributesClear = true
    for _, player in ipairs(players) do
        if session:checkpointOrder(player) ~= nil then
            checkpointStateClear = false
        end
        if player:GetAttribute(RuntimeSessionV03.CHECKPOINT_ATTRIBUTE) ~= nil then
            checkpointAttributesClear = false
        end
    end
    local snapshot = session:acceptanceSnapshot()
    local receipt = G2eAcceptanceRecordsV1.zeroCheckpoint(repositoryCommit, manifest.manifestHash, {
        playerCount = #players,
        checkpointStateClear = checkpointStateClear,
        checkpointAttributesClear = checkpointAttributesClear,
        respawnsObserved = snapshot.respawnsObserved,
        spawnRespawnsObserved = snapshot.spawnRespawnsObserved,
    })
    emit(ZERO_CHECKPOINT_PREFIX, receipt)
    local placement = G2eAcceptanceHarness.emitPlacementObservation(
        repositoryCommit,
        "minimum-zero-checkpoint",
        manifest,
        session,
        "zero-respawn",
        captureWaitIterations
    )
    return receipt, placement
end

function G2eAcceptanceHarness.bindControl(api)
    local folder = Instance.new("Folder")
    folder.Name = "G2eControl"
    folder.Parent = game:GetService("ServerStorage")
    for name, callback in pairs({
        Build = function(fixtureId)
            local run = api:manualBuild(fixtureId)
            return G2eControlProtocol.success("Build", run)
        end,
        RunReferenceColdAndReplacementSequence = function()
            local count = api:runReferenceColdAndReplacementSequence()
            return G2eControlProtocol.success("RunReferenceColdAndReplacementSequence", {
                fixtureId = "reference",
                runKind = "sequence",
                recordCount = count,
            })
        end,
        RunMaximumColdAndRepeatedSequence = function()
            local count = api:runMaximumColdAndRepeatedSequence()
            return G2eControlProtocol.success("RunMaximumColdAndRepeatedSequence", {
                fixtureId = "maximum-50",
                runKind = "sequence",
                recordCount = count,
            })
        end,
        RunZeroCheckpointColdSequence = function()
            local count = api:runZeroCheckpointColdSequence()
            return G2eControlProtocol.success("RunZeroCheckpointColdSequence", {
                fixtureId = "minimum-zero-checkpoint",
                runKind = "sequence",
                recordCount = count,
            })
        end,
        RunFailureBoundarySequence = function(boundary)
            api:runFailureBoundarySequence(boundary)
            return G2eControlProtocol.success("RunFailureBoundarySequence", {
                fixtureId = "reference",
                runKind = "failure-boundary",
                recordCount = 2,
            })
        end,
        ObserveGameplay = function()
            api:observeGameplay()
            return G2eControlProtocol.success("ObserveGameplay", { fixtureId = api.currentFixtureId })
        end,
        InspectHazard = function(objectId)
            api:inspectHazard(objectId)
            return G2eControlProtocol.success("InspectHazard", { fixtureId = api.currentFixtureId })
        end,
        VerifyStaleHazardCallback = function()
            local receipt, failure = api:verifyStaleHazardCallback()
            if receipt == nil then
                return G2eControlProtocol.failure(
                    "VerifyStaleHazardCallback",
                    failure.code,
                    failure.field,
                    failure.message
                )
            end
            return G2eControlProtocol.success("VerifyStaleHazardCallback", { fixtureId = api.currentFixtureId })
        end,
        ObservePlayerPlacement = function(phase)
            api:observePlayerPlacement(phase)
            return G2eControlProtocol.success("ObservePlayerPlacement", { fixtureId = api.currentFixtureId })
        end,
        ObserveFinishIsolation = function(phase)
            api:observeFinishIsolation(phase)
            return G2eControlProtocol.success("ObserveFinishIsolation", { fixtureId = api.currentFixtureId })
        end,
        RunProgressAndStaleCallbackSequence = function()
            api:runProgressAndStaleCallbackSequence()
            return G2eControlProtocol.success("RunProgressAndStaleCallbackSequence", {
                fixtureId = "reference",
                runKind = "functional",
                recordCount = 4,
            })
        end,
        RunOwnershipRefusalSequence = function()
            api:runOwnershipRefusalSequence()
            return G2eControlProtocol.success("RunOwnershipRefusalSequence", {
                fixtureId = "reference",
                runKind = "refusal",
                recordCount = 3,
            })
        end,
        RunStaticFixtureSequence = function()
            api:runStaticFixtureSequence()
            return G2eControlProtocol.success("RunStaticFixtureSequence", {
                fixtureId = "reference",
                runKind = "static",
                recordCount = 3,
            })
        end,
        ObserveZeroCheckpointPlayers = function()
            api:observeZeroCheckpointPlayers()
            return G2eControlProtocol.success("ObserveZeroCheckpointPlayers", {
                fixtureId = "minimum-zero-checkpoint",
            })
        end,
    }) do
        local bindable = Instance.new("BindableFunction")
        bindable.Name = name
        bindable.OnInvoke = function(...)
            local controlResult = G2eControlProtocol.invoke(name, callback, ...)
            emit(CONTROL_PREFIX, controlResult)
            return controlResult
        end
        bindable.Parent = folder
    end
    return folder
end

function G2eAcceptanceHarness.assertSingleActiveRoot()
    local active = {}
    for _, child in ipairs(workspace:GetChildren()) do
        if child.Name == "GeneratedObby" then
            table.insert(active, child)
        end
    end
    assert(#active == 1, "Workspace does not contain exactly one GeneratedObby")
    return active[1]
end

function G2eAcceptanceHarness.activeRootCount()
    return activeRootCount()
end

return table.freeze(G2eAcceptanceHarness)

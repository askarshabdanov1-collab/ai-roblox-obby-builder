local ManifestValidatorV03 = {}

local ROLES = table.freeze({ spawn = true, platform = true, checkpoint = true, kill = true, finish = true })
local SHAPES = table.freeze({ Block = true, Ball = true, Cylinder = true, Wedge = true })
local SURFACES = table.freeze({
    ["planar-face"] = true,
    ["wedge-slope"] = true,
    ["curved-surface"] = true,
    ["circular-endcap"] = true,
})
local COLOR_ROLES = table.freeze({ primary = true, secondary = true, reward = true, hazard = true })
local MATERIALS = table.freeze({ SmoothPlastic = true, Neon = true })
local SEVERITIES = table.freeze({ information = true, warning = true })
local ORIENTATION_POLICIES = table.freeze({
    ["face-next-safe-route-object"] = true,
    ["explicit-yaw"] = true,
})
local MEASUREMENT_METHODS = table.freeze({
    ["surface-envelope-height-delta"] = true,
    ["world-aabb-horizontal-separation"] = true,
})
local MEASUREMENT_APPROXIMATIONS = table.freeze({
    ["conservative-bounds-delta"] = true,
    ["conservative-lower-bound"] = true,
})

local function issue(code, message)
    return table.freeze({ code = code, message = message })
end

local function finite(value)
    return type(value) == "number" and value == value and math.abs(value) ~= math.huge
end

local function numberIn(value, minimum, maximum, exclusiveMinimum)
    if not finite(value) then
        return false
    end
    if exclusiveMinimum and value <= minimum or not exclusiveMinimum and value < minimum then
        return false
    end
    return value <= maximum
end

local function integerIn(value, minimum, maximum)
    return numberIn(value, minimum, maximum, false) and value == math.floor(value)
end

local function hash(value)
    return type(value) == "string" and #value == 71 and string.match(value, "^sha256:[0-9a-f]+$") ~= nil
end

local function id(value)
    return type(value) == "string"
        and #value >= 1
        and #value <= 120
        and string.match(value, "^[a-z0-9][a-z0-9%.%-]*$") ~= nil
        and string.match(value, "[%.%-]$") == nil
        and string.find(value, "[%.%-][%.%-]") == nil
end

local function pascalId(value)
    return type(value) == "string"
        and #value >= 1
        and #value <= 80
        and string.match(value, "^[A-Z][A-Za-z0-9]*$") ~= nil
end

local function sourceId(value)
    return type(value) == "string" and #value >= 1 and #value <= 120
end

local function boundedString(value, minimum, maximum)
    return type(value) == "string" and #value >= minimum and #value <= maximum
end

local function record(value, fields)
    if type(value) ~= "table" then
        return issue("record-type", "manifest record has an invalid type")
    end
    for key in next, value do
        if type(key) ~= "string" then
            return issue("record-key", "manifest record keys must be strings")
        end
        if fields[key] == nil then
            return issue("additional-property", "manifest record contains an unknown field")
        end
    end
    for key, required in next, fields do
        if required and rawget(value, key) == nil then
            return issue("required-field", "manifest record is missing a required field")
        end
    end
    return nil
end

local function denseArray(value, minimum, maximum)
    if type(value) ~= "table" then
        return nil, issue("array-type", "manifest array has an invalid type")
    end
    local count = 0
    local highest = 0
    for key in next, value do
        if type(key) ~= "number" or key ~= math.floor(key) or key < 1 then
            return nil, issue("array-shape", "manifest array must use dense positive integer keys")
        end
        count += 1
        highest = math.max(highest, key)
    end
    if highest ~= count then
        return nil, issue("array-shape", "manifest array must be dense")
    end
    if count < minimum or count > maximum then
        return nil, issue("array-bounds", "manifest array count is outside contract bounds")
    end
    return count, nil
end

local function stringArray(value, minimum, maximum, validateItem, requireUnique)
    local count, arrayError = denseArray(value, minimum, maximum)
    if arrayError ~= nil then
        return arrayError
    end
    local seen = {}
    for index = 1, count do
        local item = rawget(value, index)
        if not validateItem(item) then
            return issue("array-item", "manifest array contains an invalid string")
        end
        if requireUnique and seen[item] then
            return issue("duplicate-id", "manifest array values must be unique")
        end
        seen[item] = true
    end
    return nil
end

local function vector(value, minimum, maximum, exclusiveMinimum)
    local valueError = record(value, { x = true, y = true, z = true })
    if valueError ~= nil then
        return valueError
    end
    for _, axis in ipairs({ "x", "y", "z" }) do
        if not numberIn(value[axis], minimum, maximum, exclusiveMinimum) then
            return issue("number-bounds", "manifest vector component is outside contract bounds")
        end
    end
    return nil
end

local function bounds(value)
    local valueError = record(value, { minimum = true, maximum = true })
    if valueError ~= nil then
        return valueError
    end
    valueError = vector(value.minimum, -2048, 2048, false) or vector(value.maximum, -2048, 2048, false)
    if valueError ~= nil then
        return valueError
    end
    for _, axis in ipairs({ "x", "y", "z" }) do
        if value.minimum[axis] >= value.maximum[axis] then
            return issue("bounds-order", "manifest bounds minimum must be below maximum")
        end
    end
    return nil
end

local function transform(value)
    local valueError = record(value, { position = true, rotation = true })
    if valueError ~= nil then
        return valueError
    end
    return vector(value.position, -2048, 2048, false) or vector(value.rotation, -360, 360, false)
end

local function collision(value, decorative)
    local valueError = record(value, { anchored = true, canCollide = true, canTouch = true, canQuery = true })
    if valueError ~= nil then
        return valueError
    end
    if value.anchored ~= true then
        return issue("collision-authority", "manifest Parts must be anchored")
    end
    if decorative then
        if value.canCollide ~= false or value.canTouch ~= false or value.canQuery ~= false then
            return issue("decorative-collision", "decorative Parts must not collide touch or query")
        end
    elseif type(value.canCollide) ~= "boolean" or type(value.canTouch) ~= "boolean" or value.canQuery ~= true then
        return issue("collision-authority", "gameplay collision fields are invalid")
    end
    return nil
end

local function appearance(value)
    local valueError = record(value, { color = true, colorRole = true, material = true })
    if valueError ~= nil then
        return valueError
    end
    if
        type(value.color) ~= "string"
        or string.match(value.color, "^#[0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]$") == nil
    then
        return issue("appearance", "manifest color is invalid")
    end
    if not COLOR_ROLES[value.colorRole] or not MATERIALS[value.material] then
        return issue("appearance", "manifest appearance authority is invalid")
    end
    return nil
end

local function sourceReferences(value)
    local valueError = record(value, {
        sourceStageId = false,
        sourceMechanicIntentId = false,
        sourceCheckpointId = false,
        sourceHazardId = false,
        sourceFinishId = false,
        sourceAssetIntentIds = true,
    })
    if valueError ~= nil then
        return valueError
    end
    for _, key in ipairs({
        "sourceStageId",
        "sourceMechanicIntentId",
        "sourceCheckpointId",
        "sourceHazardId",
        "sourceFinishId",
    }) do
        if value[key] ~= nil and not sourceId(value[key]) then
            return issue("source-reference", "manifest source reference is invalid")
        end
    end
    return stringArray(value.sourceAssetIntentIds, 0, 128, sourceId, true)
end

local function geometry(value)
    local valueError = record(value, {
        methodId = true,
        normalizedGeometryHash = true,
        axisAlignedBounds = true,
        topSurfaceMaximumY = true,
        surfaceKind = true,
    })
    if valueError ~= nil then
        return valueError
    end
    if value.methodId ~= "geometry-evaluator-v0.1" or not hash(value.normalizedGeometryHash) then
        return issue("geometry", "manifest geometry authority is invalid")
    end
    if not numberIn(value.topSurfaceMaximumY, -2048, 2048, false) or not SURFACES[value.surfaceKind] then
        return issue("geometry", "manifest geometry summary is invalid")
    end
    return bounds(value.axisAlignedBounds)
end

local function behavior(value)
    if type(value) ~= "table" or type(rawget(value, "kind")) ~= "string" then
        return issue("behavior", "manifest behavior is invalid")
    end
    if value.kind == "none" or value.kind == "finish" then
        return record(value, { kind = true })
    elseif value.kind == "checkpoint" then
        local valueError = record(value, { kind = true, checkpointOrder = true })
        if valueError ~= nil then
            return valueError
        end
        if not integerIn(value.checkpointOrder, 1, 49) then
            return issue("checkpoint-order", "checkpoint behavior order is invalid")
        end
        return nil
    elseif value.kind == "kill" then
        local valueError = record(value, { kind = true, killMode = true })
        if valueError ~= nil then
            return valueError
        end
        if value.killMode ~= "touch" then
            return issue("kill-mode", "kill behavior mode is invalid")
        end
        return nil
    end
    return issue("behavior", "manifest behavior kind is invalid")
end

local function gameplayObject(value)
    local valueError = record(value, {
        id = true,
        order = true,
        sourceReferences = true,
        role = true,
        authority = true,
        className = true,
        shape = true,
        transform = true,
        size = true,
        collision = true,
        appearance = true,
        geometry = true,
        behavior = true,
    })
    if valueError ~= nil then
        return valueError
    end
    if not pascalId(value.id) or not integerIn(value.order, 0, 500) or not ROLES[value.role] then
        return issue("gameplay-object", "gameplay identity role or order is invalid")
    end
    if value.authority ~= "native-gameplay" or value.className ~= "Part" or not SHAPES[value.shape] then
        return issue("gameplay-authority", "gameplay native-Part authority is invalid")
    end
    return sourceReferences(value.sourceReferences)
        or transform(value.transform)
        or vector(value.size, 0, 256, true)
        or collision(value.collision, false)
        or appearance(value.appearance)
        or geometry(value.geometry)
        or behavior(value.behavior)
end

local function decorativeObject(value)
    local valueError = record(value, {
        id = true,
        zoneId = true,
        className = true,
        shape = true,
        transform = true,
        size = true,
        collision = true,
        appearance = true,
    })
    if valueError ~= nil then
        return valueError
    end
    if not pascalId(value.id) or not id(value.zoneId) or value.className ~= "Part" or not SHAPES[value.shape] then
        return issue("decorative-object", "decorative native-Part identity is invalid")
    end
    return transform(value.transform)
        or vector(value.size, 0, 256, true)
        or collision(value.collision, true)
        or appearance(value.appearance)
end

local function measurement(value)
    local valueError = record(value, {
        status = true,
        value = true,
        method = true,
        approximationKind = true,
        toleranceStuds = true,
        limitations = true,
        applicability = true,
    })
    if valueError ~= nil then
        return valueError
    end
    if value.status ~= "available" or not numberIn(value.value, 0, math.huge, false) then
        return issue("measurement", "transition measurement value is invalid")
    end
    if not MEASUREMENT_METHODS[value.method] or not MEASUREMENT_APPROXIMATIONS[value.approximationKind] then
        return issue("measurement", "transition measurement method is invalid")
    end
    if not numberIn(value.toleranceStuds, 0, 0.000001, false) or value.applicability ~= "broad-phase-only" then
        return issue("measurement", "transition measurement tolerance or applicability is invalid")
    end
    return stringArray(value.limitations, 0, 32, function(item)
        return boundedString(item, 1, 500)
    end, false)
end

local function landingRegion(value)
    local valueError = record(value, {
        status = true,
        method = true,
        approximationKind = true,
        spanAStuds = true,
        spanBStuds = true,
        toleranceStuds = true,
        limitations = true,
    })
    if valueError ~= nil then
        return valueError
    end
    if
        value.status ~= "available"
        or value.method ~= "exact-planar-intrinsic-edge-spans-v1"
        or value.approximationKind ~= "exact-native-primitive"
        or not numberIn(value.spanAStuds, 0, math.huge, false)
        or not numberIn(value.spanBStuds, 0, math.huge, false)
        or not numberIn(value.toleranceStuds, 0, 0.000001, false)
    then
        return issue("landing-region", "transition landing region is invalid")
    end
    return stringArray(value.limitations, 0, 32, function(item)
        return boundedString(item, 1, 500)
    end, false)
end

local function transition(value)
    local valueError = record(value, {
        transitionId = true,
        fromObjectId = true,
        toObjectId = true,
        fromGlobalOrder = true,
        toGlobalOrder = true,
        outcome = true,
        normalizedInputHash = true,
        horizontalSeparation = true,
        verticalRise = true,
        downwardDrop = true,
        landingRegion = true,
        sourceSurfaceKind = true,
        destinationSurfaceKind = true,
        limitations = true,
    })
    if valueError ~= nil then
        return valueError
    end
    if
        not id(value.transitionId)
        or not pascalId(value.fromObjectId)
        or not pascalId(value.toObjectId)
        or not integerIn(value.fromGlobalOrder, 0, 500)
        or not integerIn(value.toGlobalOrder, 1, 501)
        or value.outcome ~= "feasible-under-model"
        or not hash(value.normalizedInputHash)
        or not boundedString(value.sourceSurfaceKind, 1, 80)
        or not boundedString(value.destinationSurfaceKind, 1, 80)
    then
        return issue("transition", "transition identity or authority is invalid")
    end
    return measurement(value.horizontalSeparation)
        or measurement(value.verticalRise)
        or measurement(value.downwardDrop)
        or landingRegion(value.landingRegion)
        or stringArray(value.limitations, 1, 64, function(item)
            return boundedString(item, 1, 500)
        end, false)
end

local function messageRecord(value)
    local valueError = record(value, { code = true, severity = true, message = true, relatedSourceIds = true })
    if valueError ~= nil then
        return valueError
    end
    if not id(value.code) or not SEVERITIES[value.severity] or not boundedString(value.message, 1, 1000) then
        return issue("message-record", "manifest finding or limitation is invalid")
    end
    return stringArray(value.relatedSourceIds, 0, 128, sourceId, true)
end

local function validateMessageArray(value)
    local count, arrayError = denseArray(value, 0, 64)
    if arrayError ~= nil then
        return arrayError
    end
    local codes = {}
    for index = 1, count do
        local item = value[index]
        local itemError = messageRecord(item)
        if itemError ~= nil then
            return itemError
        end
        if codes[item.code] then
            return issue("duplicate-id", "manifest finding or limitation codes must be unique")
        end
        codes[item.code] = true
    end
    return nil
end

local function decorativeZone(value)
    local valueError = record(value, {
        zoneId = true,
        sourceStageId = true,
        sourceVisualStyleIntentId = true,
        sourceAssetIntentIds = true,
        bounds = true,
        collisionPolicy = true,
        nativePartFallback = true,
    })
    if valueError ~= nil then
        return valueError
    end
    if
        not id(value.zoneId)
        or not sourceId(value.sourceStageId)
        or not sourceId(value.sourceVisualStyleIntentId)
        or value.collisionPolicy ~= "non-colliding-only"
        or value.nativePartFallback ~= true
    then
        return issue("decorative-zone", "decorative zone identity or authority is invalid")
    end
    return stringArray(value.sourceAssetIntentIds, 1, 128, sourceId, true) or bounds(value.bounds)
end

local function validateProvenance(value)
    local valueError = record(value, {
        generationBundleHash = true,
        obbySpecId = true,
        obbySpecHash = true,
        generatorConfigurationHash = true,
        mechanicCatalogHash = true,
        layoutBundleHash = true,
        layoutSpecId = true,
        layoutSpecHash = true,
        layoutConfigurationHash = true,
        mechanicLayoutDefinitionHashes = true,
    })
    if valueError ~= nil then
        return valueError
    end
    for _, key in ipairs({
        "generationBundleHash",
        "obbySpecHash",
        "generatorConfigurationHash",
        "mechanicCatalogHash",
        "layoutBundleHash",
        "layoutSpecHash",
        "layoutConfigurationHash",
    }) do
        if not hash(value[key]) then
            return issue("provenance", "manifest provenance hash is invalid")
        end
    end
    if not sourceId(value.obbySpecId) or not id(value.layoutSpecId) then
        return issue("provenance", "manifest provenance identity is invalid")
    end
    return stringArray(value.mechanicLayoutDefinitionHashes, 1, 64, hash, true)
end

local function validateCoordinateSystem(value)
    local valueError = record(value, {
        units = true,
        handedness = true,
        upAxis = true,
        forwardAxis = true,
        rotationUnit = true,
        rotationOrder = true,
    })
    if valueError ~= nil then
        return valueError
    end
    if
        value.units ~= "studs"
        or value.handedness ~= "right-handed"
        or value.upAxis ~= "+Y"
        or value.forwardAxis ~= "-Z"
        or value.rotationUnit ~= "degrees"
        or value.rotationOrder ~= "XYZ"
    then
        return issue("coordinate-system", "manifest coordinate system is invalid")
    end
    return nil
end

local function validateCharacterPlacement(value)
    local valueError = record(value, { strategy = true, orientationPolicy = true, verticalOffset = true })
    if valueError ~= nil then
        return valueError
    end
    if
        value.strategy ~= "humanoid-root-part-cframe-v1"
        or not ORIENTATION_POLICIES[value.orientationPolicy]
        or not numberIn(value.verticalOffset, 2, 20, false)
    then
        return issue("character-placement", "manifest character placement is invalid")
    end
    return nil
end

local function validateNavigationStructure(value)
    local valueError = record(value, {
        routeId = true,
        sourceRouteId = true,
        characterPlacement = true,
        spawnObjectId = true,
        finishObjectId = true,
        checkpointObjectIds = true,
        safeRouteObjectIds = true,
        routeEntries = true,
        stages = true,
        reachability = true,
    })
    if valueError ~= nil then
        return valueError
    end
    if
        not id(value.routeId)
        or not id(value.sourceRouteId)
        or value.spawnObjectId ~= "Spawn"
        or value.finishObjectId ~= "Finish"
    then
        return issue("navigation", "manifest navigation identity is invalid")
    end
    valueError = validateCharacterPlacement(value.characterPlacement)
        or stringArray(value.checkpointObjectIds, 0, 49, pascalId, true)
        or stringArray(value.safeRouteObjectIds, 6, 500, pascalId, true)
    if valueError ~= nil then
        return valueError
    end

    local routeCount, routeError = denseArray(value.routeEntries, 6, 500)
    if routeError ~= nil then
        return routeError
    end
    for index = 1, routeCount do
        local entry = value.routeEntries[index]
        valueError = record(entry, { globalOrder = true, objectId = true, stageId = true, stageOrder = true })
        if valueError ~= nil then
            return valueError
        end
        if
            not integerIn(entry.globalOrder, 1, 500)
            or not pascalId(entry.objectId)
            or not id(entry.stageId)
            or not integerIn(entry.stageOrder, 1, 501)
        then
            return issue("route-entry", "manifest route entry is invalid")
        end
    end

    local stageCount, stageError = denseArray(value.stages, 5, 50)
    if stageError ~= nil then
        return stageError
    end
    for index = 1, stageCount do
        local stage = value.stages[index]
        valueError = record(stage, {
            stageId = true,
            sourceStageId = true,
            order = true,
            safeRouteObjectIds = true,
            checkpointObjectId = false,
        })
        if valueError ~= nil then
            return valueError
        end
        if not id(stage.stageId) or not sourceId(stage.sourceStageId) or not integerIn(stage.order, 1, 50) then
            return issue("navigation-stage", "manifest navigation stage is invalid")
        end
        valueError = stringArray(stage.safeRouteObjectIds, 1, 501, pascalId, true)
        if valueError ~= nil then
            return valueError
        end
        if stage.checkpointObjectId ~= nil and not pascalId(stage.checkpointObjectId) then
            return issue("checkpoint-id", "manifest stage checkpoint identity is invalid")
        end
    end

    local reachability = value.reachability
    valueError = record(reachability, {
        modelId = true,
        methodId = true,
        methodVersion = true,
        controllerProfileRef = true,
        overallOutcome = true,
        requiredTransitions = true,
    })
    if valueError ~= nil then
        return valueError
    end
    if
        reachability.modelId ~= "e1-coarse-surface-transition-v1"
        or reachability.methodId ~= "coarse-transition-classifier"
        or reachability.methodVersion ~= "2.0.0"
        or reachability.overallOutcome ~= "feasible-under-model"
    then
        return issue("reachability-authority", "manifest reachability authority is invalid")
    end
    local profile = reachability.controllerProfileRef
    valueError = record(profile, { profileId = true, profileVersion = true, controllerProfileHash = true })
    if valueError ~= nil then
        return valueError
    end
    if
        not sourceId(profile.profileId)
        or not boundedString(profile.profileVersion, 1, 40)
        or not hash(profile.controllerProfileHash)
    then
        return issue("controller-profile", "manifest controller profile reference is invalid")
    end
    local transitionCount, transitionError = denseArray(reachability.requiredTransitions, 6, 500)
    if transitionError ~= nil then
        return transitionError
    end
    for index = 1, transitionCount do
        valueError = transition(reachability.requiredTransitions[index])
        if valueError ~= nil then
            return valueError
        end
    end
    return nil
end

local function within(inside, outside)
    return inside.minimum.x >= outside.minimum.x
        and inside.minimum.y >= outside.minimum.y
        and inside.minimum.z >= outside.minimum.z
        and inside.maximum.x <= outside.maximum.x
        and inside.maximum.y <= outside.maximum.y
        and inside.maximum.z <= outside.maximum.z
end

local function validateSemantics(manifest)
    local objects = manifest.layers.gameplay.objects
    local byId = {}
    local safeInObjectOrder = {}
    local checkpoints = {}
    local spawnCount = 0
    local finishCount = 0
    local expectedCheckpointOrder = 1
    for index, object in ipairs(objects) do
        if byId[object.id] ~= nil then
            return issue("duplicate-id", "gameplay object IDs must be unique")
        end
        byId[object.id] = object
        if object.order ~= index - 1 then
            return issue("object-order", "gameplay object order must be contiguous from zero")
        end
        if object.role == "spawn" then
            spawnCount += 1
        elseif object.role == "finish" then
            finishCount += 1
        end
        if object.role == "platform" or object.role == "checkpoint" or object.role == "finish" then
            table.insert(safeInObjectOrder, object.id)
        end
        if object.role == "checkpoint" then
            table.insert(checkpoints, object.id)
            if object.behavior.kind ~= "checkpoint" or object.behavior.checkpointOrder ~= expectedCheckpointOrder then
                return issue("checkpoint-order", "checkpoint behavior order must be contiguous")
            end
            if object.sourceReferences.sourceCheckpointId == nil then
                return issue("source-reference", "checkpoint source reference is required")
            end
            expectedCheckpointOrder += 1
        elseif object.role == "kill" then
            if object.behavior.kind ~= "kill" or object.sourceReferences.sourceHazardId == nil then
                return issue("behavior-role", "hazard behavior and source reference must match its role")
            end
        elseif object.role == "finish" then
            if object.behavior.kind ~= "finish" or object.sourceReferences.sourceFinishId == nil then
                return issue("behavior-role", "finish behavior and source reference must match its role")
            end
        elseif object.behavior.kind ~= "none" then
            return issue("behavior-role", "spawn and platform behavior must be none")
        end
        local expectedCollision = object.role ~= "kill"
        local expectedTouch = object.role == "checkpoint" or object.role == "kill" or object.role == "finish"
        if object.collision.canCollide ~= expectedCollision or object.collision.canTouch ~= expectedTouch then
            return issue("collision-policy", "gameplay collision and touch flags must match role")
        end
        if
            (object.role == "spawn" or object.role == "checkpoint")
            and (object.transform.rotation.x ~= 0 or object.transform.rotation.z ~= 0)
        then
            return issue("placement-tilt", "spawn and checkpoint pitch and roll must be zero")
        end
        if not within(object.geometry.axisAlignedBounds, manifest.worldBounds) then
            return issue("world-bounds", "gameplay geometry must remain within world bounds")
        end
    end
    if spawnCount ~= 1 or objects[1].id ~= "Spawn" or objects[1].role ~= "spawn" then
        return issue("spawn", "Spawn must be the unique first gameplay object")
    end
    if finishCount ~= 1 or objects[#objects].id ~= "Finish" or objects[#objects].role ~= "finish" then
        return issue("finish", "Finish must be the unique final gameplay object")
    end

    local navigation = manifest.navigation
    if #navigation.checkpointObjectIds ~= #checkpoints then
        return issue("checkpoint-order", "navigation checkpoint coverage is incomplete")
    end
    for index, objectId in ipairs(checkpoints) do
        if navigation.checkpointObjectIds[index] ~= objectId then
            return issue("checkpoint-order", "navigation checkpoints must follow gameplay order")
        end
    end
    if #navigation.safeRouteObjectIds ~= #safeInObjectOrder then
        return issue("route-closure", "safe route must cover all safe gameplay")
    end
    for index, objectId in ipairs(safeInObjectOrder) do
        if navigation.safeRouteObjectIds[index] ~= objectId then
            return issue("route-order", "safe route must follow gameplay order")
        end
    end
    if navigation.safeRouteObjectIds[#navigation.safeRouteObjectIds] ~= "Finish" then
        return issue("finish-order", "Finish must be the final route object")
    end

    local stageById = {}
    local stageBySourceId = {}
    local routeLocation = {}
    local flattened = {}
    local stageCheckpointIds = {}
    for index, stage in ipairs(navigation.stages) do
        if stage.order ~= index or stageById[stage.stageId] or stageBySourceId[stage.sourceStageId] then
            return issue("duplicate-id", "navigation stage identities and order must be unique")
        end
        stageById[stage.stageId] = stage
        stageBySourceId[stage.sourceStageId] = stage
        local discoveredCheckpoint = nil
        for stageOrder, objectId in ipairs(stage.safeRouteObjectIds) do
            if routeLocation[objectId] ~= nil then
                return issue("duplicate-id", "stage route objects must be globally unique")
            end
            local object = byId[objectId]
            if object == nil or object.role == "spawn" or object.role == "kill" then
                return issue("dangling-reference", "stage route object must reference safe gameplay")
            end
            if object.id ~= "Finish" and object.sourceReferences.sourceStageId ~= stage.sourceStageId then
                return issue("source-reference", "route object source stage does not match navigation stage")
            end
            if object.role == "checkpoint" then
                if discoveredCheckpoint ~= nil then
                    return issue("checkpoint-order", "a stage cannot contain multiple checkpoints")
                end
                discoveredCheckpoint = object.id
            end
            routeLocation[objectId] = { stageId = stage.stageId, stageOrder = stageOrder }
            table.insert(flattened, objectId)
        end
        if stage.checkpointObjectId ~= discoveredCheckpoint then
            return issue("checkpoint-order", "stage checkpoint must match its route checkpoint")
        end
        if discoveredCheckpoint ~= nil then
            table.insert(stageCheckpointIds, discoveredCheckpoint)
        end
    end
    if #flattened ~= #navigation.safeRouteObjectIds then
        return issue("stage-route", "navigation stages must close the global route")
    end
    for index, objectId in ipairs(flattened) do
        if navigation.safeRouteObjectIds[index] ~= objectId then
            return issue("stage-route", "navigation stage route order differs from global route")
        end
    end
    if #stageCheckpointIds ~= #checkpoints then
        return issue("checkpoint-order", "navigation stage checkpoint coverage is incomplete")
    end

    if #navigation.routeEntries ~= #navigation.safeRouteObjectIds then
        return issue("route-entry", "route entry count must match safe route")
    end
    for index, entry in ipairs(navigation.routeEntries) do
        local location = routeLocation[entry.objectId]
        if
            entry.globalOrder ~= index
            or entry.objectId ~= navigation.safeRouteObjectIds[index]
            or location == nil
            or location.stageId ~= entry.stageId
            or location.stageOrder ~= entry.stageOrder
        then
            return issue("route-entry", "route entries must exactly index stage route positions")
        end
    end

    local transitionIds = {}
    local expectedPath = { navigation.spawnObjectId }
    for _, objectId in ipairs(navigation.safeRouteObjectIds) do
        table.insert(expectedPath, objectId)
    end
    local transitions = navigation.reachability.requiredTransitions
    if #transitions ~= #navigation.safeRouteObjectIds then
        return issue("transition-coverage", "every safe-route edge requires transition evidence")
    end
    for index, evidence in ipairs(transitions) do
        if transitionIds[evidence.transitionId] then
            return issue("duplicate-id", "transition IDs must be unique")
        end
        transitionIds[evidence.transitionId] = true
        if
            evidence.fromObjectId ~= expectedPath[index]
            or evidence.toObjectId ~= expectedPath[index + 1]
            or evidence.fromGlobalOrder ~= index - 1
            or evidence.toGlobalOrder ~= index
        then
            return issue("transition-adjacency", "transition evidence must match adjacent route objects")
        end
        local source = byId[evidence.fromObjectId]
        local destination = byId[evidence.toObjectId]
        if source == nil or destination == nil then
            return issue("dangling-reference", "transition evidence references an unknown object")
        end
        if
            evidence.sourceSurfaceKind ~= source.geometry.surfaceKind
            or evidence.destinationSurfaceKind ~= destination.geometry.surfaceKind
        then
            return issue("transition-surface", "transition evidence surface kinds do not match geometry")
        end
    end

    local zones = {}
    for _, zone in ipairs(manifest.decorativeZones) do
        if zones[zone.zoneId] then
            return issue("duplicate-id", "decorative zone IDs must be unique")
        end
        if stageBySourceId[zone.sourceStageId] == nil then
            return issue("dangling-reference", "decorative zone references an unknown source stage")
        end
        zones[zone.zoneId] = zone
    end
    local decorativeIds = {}
    for _, object in ipairs(manifest.layers.decorative.objects) do
        if byId[object.id] or decorativeIds[object.id] then
            return issue("duplicate-id", "decorative object IDs must be unique across object layers")
        end
        if zones[object.zoneId] == nil then
            return issue("dangling-reference", "decorative object references an unknown zone")
        end
        decorativeIds[object.id] = true
    end
    return nil
end

local function validateStructure(manifest)
    local manifestError = record(manifest, {
        schemaVersion = true,
        generatorVersion = true,
        projectionVersion = true,
        sceneId = true,
        sourceSpecId = true,
        sourcePlaceSpecHash = true,
        seed = true,
        seedIdentity = true,
        manifestHash = true,
        provenance = true,
        coordinateSystem = true,
        worldBounds = true,
        navigation = true,
        layers = true,
        decorativeZones = true,
        limitations = true,
        findings = true,
    })
    if manifestError ~= nil then
        return manifestError
    end
    if
        manifest.schemaVersion ~= "0.3"
        or manifest.generatorVersion ~= "0.3.0"
        or manifest.projectionVersion ~= "g1c-layout-projection-v1"
    then
        return issue("schema-version", "manifest version authorities are invalid")
    end
    if
        not id(manifest.sceneId)
        or not id(manifest.sourceSpecId)
        or not hash(manifest.sourcePlaceSpecHash)
        or not integerIn(manifest.seed, 0, 4294967295)
        or not hash(manifest.seedIdentity)
        or not hash(manifest.manifestHash)
    then
        return issue("manifest-identity", "manifest identity fields are invalid")
    end
    manifestError = validateProvenance(manifest.provenance)
        or validateCoordinateSystem(manifest.coordinateSystem)
        or bounds(manifest.worldBounds)
        or validateNavigationStructure(manifest.navigation)
    if manifestError ~= nil then
        return manifestError
    end

    manifestError = record(manifest.layers, { gameplay = true, decorative = true })
    if manifestError ~= nil then
        return manifestError
    end
    manifestError = record(manifest.layers.gameplay, { objects = true })
        or record(manifest.layers.decorative, { objects = true })
    if manifestError ~= nil then
        return manifestError
    end
    local gameplayCount, gameplayError = denseArray(manifest.layers.gameplay.objects, 7, 501)
    if gameplayError ~= nil then
        return gameplayError
    end
    for index = 1, gameplayCount do
        manifestError = gameplayObject(manifest.layers.gameplay.objects[index])
        if manifestError ~= nil then
            return manifestError
        end
    end
    local decorativeCount, decorativeError = denseArray(manifest.layers.decorative.objects, 0, 256)
    if decorativeError ~= nil then
        return decorativeError
    end
    for index = 1, decorativeCount do
        manifestError = decorativeObject(manifest.layers.decorative.objects[index])
        if manifestError ~= nil then
            return manifestError
        end
    end
    local zoneCount, zoneError = denseArray(manifest.decorativeZones, 5, 128)
    if zoneError ~= nil then
        return zoneError
    end
    for index = 1, zoneCount do
        manifestError = decorativeZone(manifest.decorativeZones[index])
        if manifestError ~= nil then
            return manifestError
        end
    end
    return validateMessageArray(manifest.limitations) or validateMessageArray(manifest.findings)
end

function ManifestValidatorV03.validateDetailed(manifest)
    local validationError = validateStructure(manifest)
    if validationError == nil then
        validationError = validateSemantics(manifest)
    end
    if validationError ~= nil then
        return nil, validationError
    end
    return manifest, nil
end

function ManifestValidatorV03.validate(manifest)
    local value, validationError = ManifestValidatorV03.validateDetailed(manifest)
    if value == nil then
        return false, validationError.message, validationError
    end
    return true, nil, nil
end

return table.freeze(ManifestValidatorV03)

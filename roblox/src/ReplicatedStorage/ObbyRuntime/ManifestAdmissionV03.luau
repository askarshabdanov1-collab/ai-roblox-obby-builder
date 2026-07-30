local ManifestAdmissionV03 = {}

local LIMITS = table.freeze({
    gameplay = table.freeze({ minimum = 7, maximum = 501 }),
    decorative = table.freeze({ minimum = 0, maximum = 256 }),
    zones = table.freeze({ minimum = 5, maximum = 128 }),
    checkpoints = table.freeze({ minimum = 0, maximum = 49 }),
    safeRoute = table.freeze({ minimum = 6, maximum = 500 }),
    routeEntries = table.freeze({ minimum = 6, maximum = 500 }),
    stages = table.freeze({ minimum = 5, maximum = 50 }),
    transitions = table.freeze({ minimum = 6, maximum = 500 }),
    limitations = table.freeze({ minimum = 0, maximum = 64 }),
    findings = table.freeze({ minimum = 0, maximum = 64 }),
})

local MAX_WORK_UNITS = 2612

local function failure(code, message)
    return nil, table.freeze({ code = code, message = message })
end

local function denseCount(value)
    if type(value) ~= "table" then
        return nil
    end
    local count = 0
    local highest = 0
    for key in next, value do
        if type(key) ~= "number" or key ~= math.floor(key) or key < 1 then
            return nil
        end
        count += 1
        highest = math.max(highest, key)
    end
    if count ~= highest then
        return nil
    end
    return count
end

function ManifestAdmissionV03.countWithin(name, count)
    local limit = LIMITS[name]
    return limit ~= nil
        and type(count) == "number"
        and count == math.floor(count)
        and count >= limit.minimum
        and count <= limit.maximum
end

function ManifestAdmissionV03.preflight(manifest, options)
    if
        type(manifest) ~= "table"
        or type(manifest.layers) ~= "table"
        or type(manifest.layers.gameplay) ~= "table"
        or type(manifest.layers.decorative) ~= "table"
        or type(manifest.navigation) ~= "table"
        or type(manifest.navigation.reachability) ~= "table"
    then
        return failure("admission-shape", "manifest collections are missing")
    end

    local collections = {
        gameplay = manifest.layers.gameplay.objects,
        decorative = manifest.layers.decorative.objects,
        zones = manifest.decorativeZones,
        checkpoints = manifest.navigation.checkpointObjectIds,
        safeRoute = manifest.navigation.safeRouteObjectIds,
        routeEntries = manifest.navigation.routeEntries,
        stages = manifest.navigation.stages,
        transitions = manifest.navigation.reachability.requiredTransitions,
        limitations = manifest.limitations,
        findings = manifest.findings,
    }
    local counts = {}
    for name, value in next, collections do
        local count = denseCount(value)
        if count == nil then
            return failure("array-shape", "manifest collection must be a dense array")
        end
        if not ManifestAdmissionV03.countWithin(name, count) then
            return failure("collection-limit", "manifest collection exceeds contract bounds")
        end
        counts[name] = count
    end

    local requiredWorkUnits = 0
    for _, count in next, counts do
        requiredWorkUnits += count
    end
    if requiredWorkUnits > MAX_WORK_UNITS then
        return failure("work-limit", "manifest exceeds the hard runtime work limit")
    end

    local maxWorkUnits = if options == nil then MAX_WORK_UNITS else options.maxWorkUnits
    if maxWorkUnits == nil then
        maxWorkUnits = MAX_WORK_UNITS
    end
    if type(maxWorkUnits) ~= "number" or maxWorkUnits ~= math.floor(maxWorkUnits) or maxWorkUnits < 0 then
        return failure("work-limit-config", "runtime work limit configuration is invalid")
    end
    if requiredWorkUnits > maxWorkUnits then
        return failure("work-limit", "manifest exceeds the configured runtime work limit")
    end

    return table.freeze({
        counts = table.freeze(counts),
        requiredWorkUnits = requiredWorkUnits,
    }),
        nil
end

ManifestAdmissionV03.LIMITS = LIMITS
ManifestAdmissionV03.MAX_WORK_UNITS = MAX_WORK_UNITS

return table.freeze(ManifestAdmissionV03)

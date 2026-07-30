local ManifestSnapshotV03 = {}

local DEFAULT_LIMITS = table.freeze({
    maxDepth = 64,
    maxEntries = 50000,
    maxNodes = 20000,
    maxStringBytes = 4 * 1024 * 1024,
})

local MAX_SAFE_INTEGER = 9007199254740991

local function failure(code, message)
    return nil, table.freeze({
        code = code,
        message = message,
    })
end

local function safeNumber(value)
    return value == value and math.abs(value) ~= math.huge and math.abs(value) <= MAX_SAFE_INTEGER
end

local function option(options, name)
    local value = if options == nil then nil else options[name]
    if type(value) == "number" and value == math.floor(value) and value >= 0 then
        return value
    end
    return DEFAULT_LIMITS[name]
end

function ManifestSnapshotV03.copy(root, options)
    if type(root) ~= "table" then
        return failure("snapshot-root-type", "manifest snapshot root must be a table")
    end

    local maxDepth = option(options, "maxDepth")
    local maxEntries = option(options, "maxEntries")
    local maxNodes = option(options, "maxNodes")
    local maxStringBytes = option(options, "maxStringBytes")
    local entries = 0
    local nodes = 1
    local stringBytes = 0
    local rootCopy = {}
    local visited = { [root] = true }
    local copies = { rootCopy }
    local stack = {
        {
            source = root,
            destination = rootCopy,
            depth = 1,
            key = nil,
        },
    }

    while #stack > 0 do
        local frame = stack[#stack]
        if getmetatable(frame.source) ~= nil then
            return failure("snapshot-metatable", "manifest data tables must not have metatables")
        end

        local key, value = next(frame.source, frame.key)
        frame.key = key
        if key == nil then
            table.remove(stack)
        else
            entries += 1
            if entries > maxEntries then
                return failure("snapshot-entry-limit", "manifest snapshot exceeds the entry limit")
            end

            local keyType = type(key)
            if keyType ~= "string" and keyType ~= "number" then
                return failure("snapshot-key-type", "manifest data contains an unsupported key type")
            end
            if keyType == "string" then
                stringBytes += #key
            elseif not safeNumber(key) or key ~= math.floor(key) then
                return failure("snapshot-key-type", "manifest data contains an unsafe numeric key")
            end

            local valueType = type(value)
            if valueType == "string" then
                stringBytes += #value
                frame.destination[key] = value
            elseif valueType == "number" then
                if not safeNumber(value) then
                    return failure("snapshot-number", "manifest data contains a non-finite or unsafe number")
                end
                frame.destination[key] = value
            elseif valueType == "boolean" then
                frame.destination[key] = value
            elseif valueType == "table" then
                if getmetatable(value) ~= nil then
                    return failure("snapshot-metatable", "manifest data tables must not have metatables")
                end
                if visited[value] then
                    return failure("snapshot-cycle", "manifest data must be a non-aliased tree")
                end
                if frame.depth >= maxDepth then
                    return failure("snapshot-depth-limit", "manifest snapshot exceeds the depth limit")
                end
                nodes += 1
                if nodes > maxNodes then
                    return failure("snapshot-node-limit", "manifest snapshot exceeds the node limit")
                end
                local childCopy = {}
                frame.destination[key] = childCopy
                visited[value] = true
                table.insert(copies, childCopy)
                table.insert(stack, {
                    source = value,
                    destination = childCopy,
                    depth = frame.depth + 1,
                    key = nil,
                })
            else
                return failure("snapshot-value-type", "manifest data contains an unsupported value type")
            end

            if stringBytes > maxStringBytes then
                return failure("snapshot-string-limit", "manifest snapshot exceeds the string-byte limit")
            end
        end
    end

    for index = #copies, 1, -1 do
        table.freeze(copies[index])
    end
    return rootCopy, nil
end

ManifestSnapshotV03.DEFAULT_LIMITS = DEFAULT_LIMITS

return table.freeze(ManifestSnapshotV03)

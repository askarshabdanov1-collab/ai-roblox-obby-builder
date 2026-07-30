local ManifestAdmissionV03 = require("./ManifestAdmissionV03")
local ManifestIndexesV03 = require("./ManifestIndexesV03")
local ManifestSnapshotV03 = require("./ManifestSnapshotV03")
local ManifestValidatorV03 = require("./ManifestValidatorV03")

local ManifestLoaderV03 = {}

local function failure(code, message)
    return nil, table.freeze({ code = code, message = message })
end

local function hash(value)
    return type(value) == "string" and #value == 71 and string.match(value, "^sha256:[0-9a-f]+$") ~= nil
end

function ManifestLoaderV03.load(moduleScript, expectedManifestHash, options)
    local requireModule = if options ~= nil and options.requireModule ~= nil then options.requireModule else require
    if type(requireModule) ~= "function" then
        return failure("require-config", "manifest require boundary is invalid")
    end

    local required, moduleResult = pcall(requireModule, moduleScript)
    if not required then
        return failure("module-require-failed", "configured manifest module failed to load")
    end
    if type(moduleResult) ~= "table" then
        return failure("module-result-type", "configured manifest module must return a table")
    end
    if rawget(moduleResult, "schemaVersion") ~= "0.3" then
        return failure("schema-version", "configured manifest schema version is unsupported")
    end
    if not hash(expectedManifestHash) then
        return failure("expected-hash-format", "configured expected manifest hash is invalid")
    end

    local snapshot, snapshotError = ManifestSnapshotV03.copy(moduleResult, {
        maxDepth = if options == nil then nil else options.maxSnapshotDepth,
        maxEntries = if options == nil then nil else options.maxSnapshotEntries,
        maxNodes = if options == nil then nil else options.maxSnapshotNodes,
        maxStringBytes = if options == nil then nil else options.maxSnapshotStringBytes,
    })
    if snapshot == nil then
        return nil, snapshotError
    end

    local preflight, preflightError = ManifestAdmissionV03.preflight(snapshot, {
        maxWorkUnits = if options == nil then nil else options.maxWorkUnits,
    })
    if preflight == nil then
        return nil, preflightError
    end

    local validated, validationError = ManifestValidatorV03.validateDetailed(snapshot)
    if validated == nil then
        return nil, validationError
    end
    if validated.manifestHash ~= expectedManifestHash then
        return failure("expected-hash-mismatch", "manifest identity does not match configured expected hash")
    end

    local indexes, structuralIdentity = ManifestIndexesV03.create(validated)
    return table.freeze({
        manifest = validated,
        indexes = indexes,
        requiredWorkUnits = preflight.requiredWorkUnits,
        structuralIdentity = structuralIdentity,
        hashTrust = "repository-module-expected-hash-v1",
    }),
        nil
end

return table.freeze(ManifestLoaderV03)

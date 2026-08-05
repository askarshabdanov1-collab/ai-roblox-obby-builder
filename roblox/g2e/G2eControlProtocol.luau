local G2eControlProtocol = {}

local CONTROL_SCHEMA_VERSION = "g2e-control-result-v1"

local function boundedText(value, fallback, maximum)
    if type(value) ~= "string" or value == "" then
        return fallback
    end
    return string.sub(value, 1, maximum)
end

local function result(command, status, details)
    local value = if type(details) == "table" then details else {}
    return table.freeze({
        schemaVersion = CONTROL_SCHEMA_VERSION,
        status = status,
        command = boundedText(command, "unknown", 80),
        fixtureId = boundedText(value.fixtureId, "none", 80),
        runKind = boundedText(value.runKind, "none", 40),
        runIndex = if type(value.runIndex) == "number" then value.runIndex else 0,
        recordCount = if type(value.recordCount) == "number" then value.recordCount else 0,
        diagnosticCode = boundedText(value.diagnosticCode, "none", 80),
        diagnosticField = boundedText(value.diagnosticField, "none", 80),
        diagnosticMessage = boundedText(value.diagnosticMessage, "none", 160),
    })
end

function G2eControlProtocol.success(command, details)
    return result(command, "PASS", details)
end

function G2eControlProtocol.failure(command, code, field, message)
    return result(command, "FAIL", {
        diagnosticCode = code,
        diagnosticField = field,
        diagnosticMessage = message,
    })
end

function G2eControlProtocol.validResult(value)
    return type(value) == "table"
        and value.schemaVersion == CONTROL_SCHEMA_VERSION
        and (value.status == "PASS" or value.status == "FAIL")
        and type(value.command) == "string"
        and type(value.fixtureId) == "string"
        and type(value.runKind) == "string"
        and type(value.runIndex) == "number"
        and type(value.recordCount) == "number"
        and type(value.diagnosticCode) == "string"
        and type(value.diagnosticField) == "string"
        and type(value.diagnosticMessage) == "string"
end

function G2eControlProtocol.invoke(command, callback, ...)
    local ok, value = pcall(callback, ...)
    if not ok then
        return G2eControlProtocol.failure(command, "g2e-control-invocation", "command", tostring(value))
    end
    if not G2eControlProtocol.validResult(value) then
        return G2eControlProtocol.failure(
            command,
            "g2e-control-result-shape",
            "result",
            "acceptance command did not return a bounded control result"
        )
    end
    return value
end

local State = {}
State.__index = State

function State:claimCold(fixtureId)
    if self.started then
        return nil,
            G2eControlProtocol.failure(
                "ClaimCold",
                "g2e-cold-session-used",
                "fixtureId",
                "a cold sequence requires a fresh server before any build attempt"
            )
    end
    self.started = true
    self.coldFixtureId = fixtureId
    return table.freeze({ fixtureId = fixtureId, runKind = "cold", runIndex = 1 }), nil
end

function State:nextManual(fixtureId)
    self.started = true
    self.manualIndex += 1
    return table.freeze({ fixtureId = fixtureId, runKind = "manual", runIndex = self.manualIndex })
end

function State:hasStarted()
    return self.started
end

function State:coldFixture()
    return self.coldFixtureId
end

function G2eControlProtocol.newState()
    return setmetatable({
        started = false,
        coldFixtureId = nil,
        manualIndex = 0,
    }, State)
end

local function run(fixtureId, runKind, runIndex)
    return table.freeze({ fixtureId = fixtureId, runKind = runKind, runIndex = runIndex })
end

function G2eControlProtocol.referenceSequence()
    local runs = { run("reference", "cold", 1) }
    for index = 1, 5 do
        table.insert(runs, run("reference", "repeated", index))
    end
    table.insert(runs, run("replacement-b", "replacement", 1))
    table.insert(runs, run("reference", "replacement", 2))
    return table.freeze(runs)
end

function G2eControlProtocol.maximumSequence()
    local runs = { run("maximum-50", "cold", 1) }
    for index = 1, 5 do
        table.insert(runs, run("maximum-50", "repeated", index))
    end
    return table.freeze(runs)
end

function G2eControlProtocol.zeroCheckpointSequence()
    return table.freeze({ run("minimum-zero-checkpoint", "cold", 1) })
end

G2eControlProtocol.CONTROL_SCHEMA_VERSION = CONTROL_SCHEMA_VERSION

return table.freeze(G2eControlProtocol)

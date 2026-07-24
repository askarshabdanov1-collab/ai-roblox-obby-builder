local ManifestValidator = require("../src/ReplicatedStorage/ObbyRuntime/ManifestValidator")
local BuildPlan = require("../src/ReplicatedStorage/ObbyRuntime/BuildPlan")
local manifest = require("../generated/VerticalSliceManifest")

local passed = 0

local function test(name, callback)
    local ok, testError = pcall(callback)
    if not ok then
        error(string.format("%s failed: %s", name, tostring(testError)))
    end
    passed += 1
    print(string.format("ok %d - %s", passed, name))
end

local function expect(condition, message)
    if not condition then
        error(message)
    end
end

local function clone(value)
    if type(value) ~= "table" then
        return value
    end
    local result = {}
    for key, child in pairs(value) do
        result[clone(key)] = clone(child)
    end
    return result
end

test("validates generated manifest", function()
    local valid, validationError = ManifestValidator.validate(manifest)
    expect(valid, validationError)
end)

test("plans every required native gameplay behavior", function()
    local plan = BuildPlan.create(manifest)
    expect(#plan.instructions == 6, "expected six gameplay build instructions")

    local roleCounts = {}
    for _, instruction in ipairs(plan.instructions) do
        local role = instruction.object.role
        roleCounts[role] = (roleCounts[role] or 0) + 1
    end
    expect(roleCounts.spawn == 1, "expected one spawn")
    expect(roleCounts.platform == 2, "expected two platform sections")
    expect(roleCounts.checkpoint == 1, "expected one checkpoint")
    expect(roleCounts.kill == 1, "expected one kill hazard")
    expect(roleCounts.finish == 1, "expected one finish")
    expect(plan.instructions[3].createsCheckpointSpawn, "checkpoint must create a respawn location")
    expect(plan.instructions[4].object.className == "WedgePart", "wedge must use WedgePart")
end)

test("fails closed on incompatible versions", function()
    local invalid = clone(manifest)
    invalid.schemaVersion = "999"
    local valid = ManifestValidator.validate(invalid)
    expect(not valid, "unsupported schema version was accepted")
end)

test("rejects decorative gameplay collision", function()
    local invalid = clone(manifest)
    invalid.layers.decorative.objects = {
        {
            id = "UnsafeDecoration",
            order = 0,
            role = "decoration",
            physics = {
                canCollide = true,
                canTouch = false,
            },
        },
    }
    local valid = ManifestValidator.validate(invalid)
    expect(not valid, "colliding decoration was accepted")
end)

print(string.format("1..%d", passed))

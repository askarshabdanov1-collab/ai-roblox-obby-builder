local ManifestValidator = require("../src/ReplicatedStorage/ObbyRuntime/ManifestValidator")
local BuildPlan = require("../src/ReplicatedStorage/ObbyRuntime/BuildPlan")
local NativePartFactory = require("../src/ReplicatedStorage/ObbyRuntime/NativePartFactory")
local PlayerProgress = require("../src/ReplicatedStorage/ObbyRuntime/PlayerProgress")
local SceneBuilderCore = require("../src/ReplicatedStorage/ObbyRuntime/SceneBuilderCore")
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

local FakeInstance = {}
FakeInstance.__index = FakeInstance

local function detach(instance)
    local parent = rawget(instance, "_parent")
    if parent == nil then
        return
    end
    for index, child in ipairs(parent._children) do
        if child == instance then
            table.remove(parent._children, index)
            break
        end
    end
end

function FakeInstance.__newindex(instance, key, value)
    if key == "Parent" then
        detach(instance)
        rawset(instance, "_parent", value)
        if value ~= nil then
            table.insert(value._children, instance)
        end
        return
    end
    rawset(instance, key, value)
end

function FakeInstance.new(className)
    return setmetatable({
        ClassName = className,
        Name = className,
        _children = {},
        _attributes = {},
        Destroyed = false,
    }, FakeInstance)
end

function FakeInstance:SetAttribute(name, value)
    self._attributes[name] = value
end

function FakeInstance:GetAttribute(name)
    return self._attributes[name]
end

function FakeInstance:GetChildren()
    local result = {}
    for _, child in ipairs(self._children) do
        table.insert(result, child)
    end
    return result
end

function FakeInstance:FindFirstChild(name)
    for _, child in ipairs(self._children) do
        if child.Name == name then
            return child
        end
    end
    return nil
end

function FakeInstance:IsA(className)
    return self.ClassName == className
end

function FakeInstance:Destroy()
    for _, child in ipairs(self:GetChildren()) do
        child:Destroy()
    end
    detach(self)
    rawset(self, "_parent", nil)
    self.Destroyed = true
end

local factoryRuntime = {
    newInstance = FakeInstance.new,
    vector3 = function(x, y, z)
        return { x = x, y = y, z = z }
    end,
    cframe = function(transform)
        return {
            position = clone(transform.position),
            rotation = clone(transform.rotation),
        }
    end,
    color = function(hex)
        return hex
    end,
    materials = {
        SmoothPlastic = "SmoothPlastic",
        Plastic = "Plastic",
        Metal = "Metal",
        Neon = "Neon",
        Concrete = "Concrete",
        Wood = "Wood",
    },
    shapes = {
        Block = "Block",
        Ball = "Ball",
        Cylinder = "Cylinder",
    },
}

local function objectForShape(shape)
    local object = clone(manifest.layers.gameplay.objects[2])
    object.id = shape .. "Test"
    object.role = "platform"
    object.behavior = { kind = "platform" }
    object.physics.canTouch = false
    object.colorRole = "primary"
    object.shape = shape
    object.className = if shape == "Wedge" then "WedgePart" else "Part"
    object.transform.rotation = { x = 15, y = 30, z = 45 }
    return object
end

test("validates generated manifest and navigation", function()
    local valid, validationError = ManifestValidator.validate(manifest)
    expect(valid, validationError)
    expect(manifest.navigation.safeRouteObjectIds[3] == "WedgeClimb01", "safe route order was lost")
    for _, objectId in ipairs(manifest.navigation.safeRouteObjectIds) do
        expect(objectId ~= "KillFloor", "hazard entered safe route")
    end
end)

test("fails closed on incompatible versions and malformed manifests", function()
    local wrongSchema = clone(manifest)
    wrongSchema.schemaVersion = "999"
    expect(not ManifestValidator.validate(wrongSchema), "unsupported schema version was accepted")

    local wrongGenerator = clone(manifest)
    wrongGenerator.generatorVersion = "0.2.1"
    expect(not ManifestValidator.validate(wrongGenerator), "unsupported generator version was accepted")

    local malformed = clone(manifest)
    malformed.layers.gameplay.objects[1].shape = "Wedge"
    malformed.layers.gameplay.objects[1].className = "Part"
    expect(not ManifestValidator.validate(malformed), "unsupported class/shape was accepted")

    local badHash = clone(manifest)
    badHash.manifestHash = "sha256:abc"
    expect(not ManifestValidator.validate(badHash), "short hash was accepted")
end)

test("constructs every supported native shape with position and rotation", function()
    for _, shape in ipairs({ "Block", "Ball", "Cylinder", "Wedge" }) do
        local object = objectForShape(shape)
        local part = NativePartFactory.create(object, factoryRuntime)
        local expectedClass = if shape == "Wedge" then "WedgePart" else "Part"
        expect(part.ClassName == expectedClass, shape .. " used wrong class")
        if shape ~= "Wedge" then
            expect(part.Shape == shape, shape .. " property was not applied")
        end
        expect(part.CFrame.position.x == object.transform.position.x, "position was not applied")
        expect(part.CFrame.rotation.y == 30, "rotation was not applied")
        expect(part.Material == object.material, "material was not applied")
        expect(part.Anchored and part.CanCollide, "physics was not applied")
    end
    for _, material in ipairs({ "SmoothPlastic", "Plastic", "Metal", "Neon", "Concrete", "Wood" }) do
        local object = objectForShape("Block")
        object.material = material
        local part = NativePartFactory.create(object, factoryRuntime)
        expect(part.Material == material, material .. " was not mapped")
    end
end)

test("configures only the initial SpawnLocation as an eligible spawn", function()
    local plan = BuildPlan.create(manifest)
    local spawnCount = 0
    for _, instruction in ipairs(plan.instructions) do
        local part = NativePartFactory.create(instruction.object, factoryRuntime)
        if part.ClassName == "SpawnLocation" then
            spawnCount += 1
            expect(instruction.object.order == 0, "non-start spawn was constructed")
            expect(part.Neutral and part.Enabled and part.Duration == 0, "start spawn configuration is invalid")
        end
        if instruction.object.role == "checkpoint" then
            expect(part.ClassName == "Part", "checkpoint must not create a SpawnLocation")
        end
    end
    expect(spawnCount == 1, "expected exactly one eligible SpawnLocation")
end)

test("constructs non-colliding decorative native objects", function()
    local decoration = objectForShape("Wedge")
    decoration.role = "decoration"
    decoration.behavior = { kind = "decoration" }
    decoration.physics.canCollide = false
    decoration.physics.canTouch = false
    local part = NativePartFactory.create(decoration, factoryRuntime)
    expect(part.ClassName == "WedgePart", "decoration did not use native WedgePart")
    expect(not part.CanCollide and not part.CanTouch, "decoration gained gameplay behavior")
end)

test("isolates checkpoints and respawns for two players", function()
    local state = PlayerProgress.new(0.75)
    local playerA = {}
    local playerB = {}
    local firstRespawn = { name = "first" }
    local laterRespawn = { name = "later" }

    expect(state:respawnTransform(playerA, "scene") == nil, "new player A skipped initial spawn")
    expect(state:respawnTransform(playerB, "scene") == nil, "new player B skipped initial spawn")
    expect(
        state:activateCheckpoint(playerA, "scene", "Checkpoint01", 1, firstRespawn, 1),
        "first checkpoint did not activate"
    )
    expect(state:respawnTransform(playerA, "scene") == firstRespawn, "player A lost checkpoint")
    expect(state:respawnTransform(playerB, "scene") == nil, "player B inherited player A checkpoint")
    expect(
        not state:activateCheckpoint(playerA, "scene", "Checkpoint01", 1, firstRespawn, 1.1),
        "checkpoint touch was not debounced"
    )
    expect(
        state:activateCheckpoint(playerA, "scene", "Checkpoint02", 2, laterRespawn, 1.2),
        "later checkpoint did not replace earlier progress"
    )
    expect(state:respawnTransform(playerA, "scene") == laterRespawn, "latest checkpoint was not used")
    expect(
        not state:activateCheckpoint(playerA, "scene", "Checkpoint01", 1, firstRespawn, 2),
        "older checkpoint regressed progress"
    )
end)

test("kills deterministically and records finish once", function()
    local humanoid = { Health = 500 }
    PlayerProgress.kill(humanoid)
    expect(humanoid.Health == 0, "hazard did not guarantee death")

    local state = PlayerProgress.new(0.75)
    local player = {}
    expect(state:finish(player, "scene"), "first finish was not recorded")
    expect(not state:finish(player, "scene"), "finish was not idempotent")
    expect(state:finish(player, "other-scene"), "finish state leaked across scenes")
end)

local function coreRuntime(options)
    local folders = {}
    local runtime = {
        validate = function()
            return true, nil
        end,
        createPlan = BuildPlan.create,
        newFolder = function()
            local folder = FakeInstance.new("Folder")
            table.insert(folders, folder)
            return folder
        end,
        createPart = function(object)
            if options ~= nil and options.failOnId == object.id then
                error("injected staging failure")
            end
            return NativePartFactory.create(object, factoryRuntime)
        end,
        connectBehavior = function() end,
    }
    return runtime, folders
end

local function ownedRoot(workspace)
    local root = FakeInstance.new("Folder")
    root.Name = "GeneratedObby"
    root:SetAttribute("GeneratedBy", "AIObbyBuilder/0.2")
    root.Parent = workspace
    return root
end

test("replaces only owned generated content", function()
    local workspace = FakeInstance.new("Folder")
    local root = ownedRoot(workspace)
    local old = FakeInstance.new("Part")
    old.Name = "OldScene"
    old.Parent = root
    local runtime = coreRuntime(nil)

    local result = SceneBuilderCore.build(manifest, workspace, runtime)
    expect(result == root, "owned root was not reused")
    expect(old.Destroyed, "old generated content was not cleaned up")
    expect(#root:GetChildren() == #BuildPlan.create(manifest).instructions, "new scene was not committed")
end)

test("refuses unowned roots without deleting them", function()
    local workspace = FakeInstance.new("Folder")
    local root = FakeInstance.new("Folder")
    root.Name = "GeneratedObby"
    root.Parent = workspace
    local child = FakeInstance.new("Part")
    child.Parent = root
    local runtime = coreRuntime(nil)

    local ok = pcall(function()
        SceneBuilderCore.build(manifest, workspace, runtime)
    end)
    expect(not ok, "unowned root was accepted")
    expect(not root.Destroyed and not child.Destroyed, "unowned content was deleted")
end)

test("preserves previous scene and destroys staging on failure", function()
    local workspace = FakeInstance.new("Folder")
    local root = ownedRoot(workspace)
    local old = FakeInstance.new("Part")
    old.Name = "PreviousValidScene"
    old.Parent = root
    local runtime, folders = coreRuntime({ failOnId = "Checkpoint01" })

    local ok = pcall(function()
        SceneBuilderCore.build(manifest, workspace, runtime)
    end)
    expect(not ok, "staging failure was hidden")
    expect(root:FindFirstChild("PreviousValidScene") == old, "previous scene was not preserved")
    expect(not old.Destroyed, "previous scene was destroyed")
    expect(#folders == 1 and folders[1].Destroyed, "staging folder was not destroyed")
end)

print(string.format("1..%d", passed))

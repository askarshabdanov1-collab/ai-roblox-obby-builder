local ManifestValidator = require("../src/ReplicatedStorage/ObbyRuntime/ManifestValidator")
local BuildPlan = require("../src/ReplicatedStorage/ObbyRuntime/BuildPlan")
local CharacterPlacement = require("../src/ReplicatedStorage/ObbyRuntime/CharacterPlacement")
local NativePartFactory = require("../src/ReplicatedStorage/ObbyRuntime/NativePartFactory")
local PlacementController = require("../src/ReplicatedStorage/ObbyRuntime/PlacementController")
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

    local badPlacement = clone(manifest)
    badPlacement.navigation.characterPlacement.verticalOffset = 1
    expect(not ManifestValidator.validate(badPlacement), "unsafe character offset was accepted")

    local tiltedSpawn = clone(manifest)
    tiltedSpawn.layers.gameplay.objects[1].transform.rotation.x = 15
    expect(not ManifestValidator.validate(tiltedSpawn), "tilted spawn placement surface was accepted")
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

test("places the HumanoidRootPart at exact center and configured height", function()
    local object = {
        transform = {
            position = { x = 12, y = 7, z = -9 },
            rotation = { x = 0, y = 90, z = 0 },
        },
        size = { x = 20, y = 4, z = 10 },
    }
    local target = CharacterPlacement.transformFor(object, 3)
    expect(target.position.x == 12 and target.position.z == -9, "horizontal placement was not centered")
    expect(target.position.y == 12, "vertical offset was not measured from the top surface")
    expect(target.rotation.y == 90, "declared orientation was not preserved")
end)

test("preserves cardinal spawn orientations", function()
    for _, yaw in ipairs({ 0, 90, 180, 270 }) do
        local object = {
            transform = {
                position = { x = 0, y = 0, z = 0 },
                rotation = { x = 0, y = yaw, z = 0 },
            },
            size = { x = 10, y = 2, z = 10 },
        }
        local rootPart = {}
        CharacterPlacement.apply(rootPart, object, 3, function(transform)
            return clone(transform)
        end)
        expect(rootPart.CFrame.rotation.y == yaw, string.format("%d degree orientation changed", yaw))
    end
end)

local function placementHarness(state)
    local applied = {}
    local waitCount = 0
    local controller
    controller = PlacementController.new(state, function(character)
        waitCount += 1
        return character.delayedRoot
    end, function(rootPart, object, verticalOffset)
        table.insert(applied, {
            rootPart = rootPart,
            object = object,
            verticalOffset = verticalOffset,
        })
    end)
    return controller, applied, function()
        return waitCount
    end
end

test("uses identical placement for initial spawn and checkpoint respawn", function()
    local state = PlayerProgress.new(0.75)
    local controller, applied, waitCount = placementHarness(state)
    local player = {}
    local initialCharacter = { delayedRoot = { name = "initial-root" } }
    player.Character = initialCharacter
    local spawn = { id = "Spawn" }
    local checkpoint = { id = "Checkpoint01" }
    controller:activateScene("scene", spawn, 3)

    expect(controller:placeCharacter(player, initialCharacter), "initial spawn placement failed")
    expect(applied[1].object == spawn, "initial spawn did not use start object")
    expect(applied[1].verticalOffset == 3, "initial spawn did not use configured offset")
    expect(waitCount() == 1, "delayed HumanoidRootPart lookup was not used")

    state:activateCheckpoint(player, "scene", "Checkpoint01", 1, checkpoint, 1)
    local respawnCharacter = { delayedRoot = { name = "checkpoint-root" } }
    player.Character = respawnCharacter
    expect(controller:placeCharacter(player, respawnCharacter), "checkpoint placement failed")
    expect(applied[2].object == checkpoint, "checkpoint respawn did not use checkpoint object")
    expect(applied[2].verticalOffset == 3, "checkpoint did not use the shared configured offset")
end)

test("keeps placement isolated between two players", function()
    local state = PlayerProgress.new(0.75)
    local controller, applied = placementHarness(state)
    local spawn = { id = "Spawn" }
    local checkpoint = { id = "Checkpoint01" }
    local playerA = {}
    local playerB = {}
    local characterA = { delayedRoot = {} }
    local characterB = { delayedRoot = {} }
    playerA.Character = characterA
    playerB.Character = characterB
    controller:activateScene("scene", spawn, 3)
    state:activateCheckpoint(playerA, "scene", "Checkpoint01", 1, checkpoint, 1)

    controller:placeCharacter(playerA, characterA)
    controller:placeCharacter(playerB, characterB)
    expect(applied[1].object == checkpoint, "player A lost checkpoint placement")
    expect(applied[2].object == spawn, "player B inherited player A checkpoint")
end)

test("fails safely when HumanoidRootPart never appears", function()
    local state = PlayerProgress.new(0.75)
    local applied = false
    local controller = PlacementController.new(state, function()
        return nil
    end, function()
        applied = true
    end)
    local player = {}
    local character = {}
    player.Character = character
    controller:activateScene("scene", { id = "Spawn" }, 3)
    expect(not controller:placeCharacter(player, character), "missing root part was treated as placed")
    expect(not applied, "placement ran without a HumanoidRootPart")
end)

test("rejects delayed callbacks from a replaced scene", function()
    local state = PlayerProgress.new(0.75)
    local applied = {}
    local oldSpawn = { id = "OldSpawn" }
    local newSpawn = { id = "NewSpawn" }
    local controller
    local replaceDuringWait = true
    controller = PlacementController.new(state, function(character)
        if replaceDuringWait then
            replaceDuringWait = false
            controller:activateScene("new-scene", newSpawn, 4)
        end
        return character.delayedRoot
    end, function(_, object)
        table.insert(applied, object)
    end)
    local player = {}
    local character = { delayedRoot = {} }
    player.Character = character
    controller:activateScene("old-scene", oldSpawn, 3)
    state:activateCheckpoint(player, "old-scene", "OldCheckpoint", 1, { id = "OldCheckpoint" }, 1)

    expect(not controller:placeCharacter(player, character), "stale scene callback relocated the player")
    expect(#applied == 0, "stale scene placement was applied")

    local newCharacter = { delayedRoot = {} }
    player.Character = newCharacter
    expect(controller:placeCharacter(player, newCharacter), "replacement scene placement failed")
    expect(applied[1] == newSpawn, "replacement scene used an old placement target")
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

    expect(state:respawnObject(playerA, "scene") == nil, "new player A skipped initial spawn")
    expect(state:respawnObject(playerB, "scene") == nil, "new player B skipped initial spawn")
    expect(
        state:activateCheckpoint(playerA, "scene", "Checkpoint01", 1, firstRespawn, 1),
        "first checkpoint did not activate"
    )
    expect(state:respawnObject(playerA, "scene") == firstRespawn, "player A lost checkpoint")
    expect(state:respawnObject(playerB, "scene") == nil, "player B inherited player A checkpoint")
    expect(
        not state:activateCheckpoint(playerA, "scene", "Checkpoint01", 1, firstRespawn, 1.1),
        "checkpoint touch was not debounced"
    )
    expect(
        state:activateCheckpoint(playerA, "scene", "Checkpoint02", 2, laterRespawn, 1.2),
        "later checkpoint did not replace earlier progress"
    )
    expect(state:respawnObject(playerA, "scene") == laterRespawn, "latest checkpoint was not used")
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

local ManifestValidator = require("../src/ReplicatedStorage/ObbyRuntime/ManifestValidator")
local ManifestValidatorV03 = require("../src/ReplicatedStorage/ObbyRuntime/ManifestValidatorV03")
local BuildPlan = require("../src/ReplicatedStorage/ObbyRuntime/BuildPlan")
local CharacterPlacement = require("../src/ReplicatedStorage/ObbyRuntime/CharacterPlacement")
local NativePartFactory = require("../src/ReplicatedStorage/ObbyRuntime/NativePartFactory")
local PlacementController = require("../src/ReplicatedStorage/ObbyRuntime/PlacementController")
local PlayerProgress = require("../src/ReplicatedStorage/ObbyRuntime/PlayerProgress")
local SafeRouteNavigator = require("../src/ReplicatedStorage/ObbyRuntime/SafeRouteNavigator")
local SceneBuilderCore = require("../src/ReplicatedStorage/ObbyRuntime/SceneBuilderCore")
local manifest = require("../generated/VerticalSliceManifest")
local manifestV03 = require("../generated/G1cReferenceManifest")
local registerG2BuildPlanTests = require("./G2BuildPlanTests")
local registerG2ManifestAdmissionTests = require("./G2ManifestAdmissionTests")
local registerG2NativePartFactoryTests = require("./G2NativePartFactoryTests")
local registerG2SceneBuilderCoreTests = require("./G2SceneBuilderCoreTests")
local registerG2RuntimeSessionTests = require("./G2RuntimeSessionTests")
local registerG2BuilderTests = require("./G2BuilderTests")
local registerG2eAcceptanceHarnessTests = require("./G2eAcceptanceHarnessTests")

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

test("resolves spawn and checkpoint targets from global safe-route metadata", function()
    local navigator = SafeRouteNavigator.new(manifest)
    expect(navigator:nextObject("Spawn").id == "JumpPlatform01", "spawn did not target the first route object")
    expect(navigator:nextObject("Checkpoint01").id == "WedgeClimb01", "checkpoint did not target the next route object")
    expect(navigator:nextObject("FinishPlatform") == nil, "final route object unexpectedly had a next target")

    local reordered = clone(manifest)
    reordered.layers.gameplay.objects[1], reordered.layers.gameplay.objects[5] =
        reordered.layers.gameplay.objects[5], reordered.layers.gameplay.objects[1]
    local reorderedNavigator = SafeRouteNavigator.new(reordered)
    expect(
        reorderedNavigator:nextObject("Spawn").id == "JumpPlatform01",
        "construction order changed the first route target"
    )
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

    local badOrientation = clone(manifest)
    badOrientation.navigation.characterPlacement.orientationPolicy = "construction-order"
    expect(not ManifestValidator.validate(badOrientation), "unsupported orientation policy was accepted")

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

local routeAwarePlacement = {
    strategy = "humanoid-root-part-cframe-v1",
    orientationPolicy = "face-next-safe-route-object",
    verticalOffset = 3,
}

local function placementObject(id, x, y, z, yaw)
    return {
        id = id,
        transform = {
            position = { x = x, y = y, z = z },
            rotation = { x = 0, y = yaw, z = 0 },
        },
        size = { x = 20, y = 4, z = 10 },
    }
end

local function routeNavigator(nextByObjectId)
    return {
        nextObject = function(_, objectId)
            return nextByObjectId[objectId]
        end,
    }
end

local function approximately(actual, expected)
    return math.abs(actual - expected) < 0.000001
end

test("places the HumanoidRootPart at exact center and configured height", function()
    local object = placementObject("Spawn", 12, 7, -9, 90)
    local target = CharacterPlacement.transformFor(object, routeAwarePlacement, nil)
    expect(target.position.x == 12 and target.position.z == -9, "horizontal placement was not centered")
    expect(target.position.y == 12, "vertical offset was not measured from the top surface")
    expect(target.rotation.y == 90, "fallback orientation was not preserved")
end)

test("faces cardinal and diagonal safe-route directions", function()
    local source = placementObject("Spawn", 0, 0, 0, 37)
    local cases = {
        { name = "+X", target = placementObject("Target", 10, 0, 0, 0), yaw = 270 },
        { name = "-X", target = placementObject("Target", -10, 0, 0, 0), yaw = 90 },
        { name = "+Z", target = placementObject("Target", 0, 0, 10, 0), yaw = 180 },
        { name = "-Z", target = placementObject("Target", 0, 0, -10, 0), yaw = 0 },
        { name = "diagonal", target = placementObject("Target", 10, 50, 10, 0), yaw = 225 },
    }
    for _, case in ipairs(cases) do
        local target = CharacterPlacement.transformFor(source, routeAwarePlacement, case.target)
        expect(approximately(target.rotation.y, case.yaw), case.name .. " route-facing yaw was incorrect")
    end
end)

test("uses explicit yaw for policy and route-facing fallbacks", function()
    local source = placementObject("FinalCheckpoint", 4, 7, -2, 37)
    local verticalOnly = placementObject("VerticalTarget", 4, 100, -2, 0)
    local invalidHorizontal = placementObject("InvalidTarget", 10, 7, -2, 0)
    invalidHorizontal.transform.position.x = "invalid"

    expect(
        CharacterPlacement.transformFor(source, routeAwarePlacement, verticalOnly).rotation.y == 37,
        "vertical-only route target did not use fallback yaw"
    )
    expect(
        CharacterPlacement.transformFor(source, routeAwarePlacement, invalidHorizontal).rotation.y == 37,
        "invalid route direction did not use fallback yaw"
    )
    expect(
        CharacterPlacement.transformFor(source, routeAwarePlacement, nil).rotation.y == 37,
        "final checkpoint without a next route target did not use fallback yaw"
    )
    local finalCheckpointManifest = clone(manifest)
    finalCheckpointManifest.navigation.safeRouteObjectIds = { "JumpPlatform01", "Checkpoint01" }
    local finalCheckpointNavigator = SafeRouteNavigator.new(finalCheckpointManifest)
    expect(
        finalCheckpointNavigator:nextObject("Checkpoint01") == nil,
        "final checkpoint unexpectedly resolved a next safe-route target"
    )

    local explicitPlacement = clone(routeAwarePlacement)
    explicitPlacement.orientationPolicy = "explicit-yaw"
    local routeTarget = placementObject("Target", 100, 7, -2, 0)
    expect(
        CharacterPlacement.transformFor(source, explicitPlacement, routeTarget).rotation.y == 37,
        "explicit-yaw policy was overridden by route geometry"
    )
end)

test("rejects unknown safe-route targets", function()
    local unknownTarget = clone(manifest)
    unknownTarget.navigation.safeRouteObjectIds[1] = "UnknownRouteTarget"
    local ok = pcall(function()
        SafeRouteNavigator.new(unknownTarget)
    end)
    expect(not ok, "unknown safe-route target was accepted")
end)

local function placementHarness(state)
    local applied = {}
    local waitCount = 0
    local controller
    controller = PlacementController.new(state, function(character)
        waitCount += 1
        return character.delayedRoot
    end, function(rootPart, object, placement, nextObject)
        table.insert(applied, {
            rootPart = rootPart,
            object = object,
            placement = placement,
            nextObject = nextObject,
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
    local spawn = placementObject("Spawn", 0, 3, 0, 0)
    local firstRouteObject = placementObject("FirstRouteObject", 0, 4, 16, 0)
    local checkpoint = placementObject("Checkpoint01", 0, 7, 31, 90)
    local nextRouteObject = placementObject("NextRouteObject", 0, 10, 45, 0)
    controller:activateScene(
        "scene",
        spawn,
        routeAwarePlacement,
        routeNavigator({
            Spawn = firstRouteObject,
            Checkpoint01 = nextRouteObject,
        })
    )

    expect(controller:placeCharacter(player, initialCharacter), "initial spawn placement failed")
    expect(applied[1].object == spawn, "initial spawn did not use start object")
    expect(applied[1].placement == routeAwarePlacement, "initial spawn did not use configured placement")
    expect(applied[1].nextObject == firstRouteObject, "initial spawn did not face the first route object")
    local initialTransform =
        CharacterPlacement.transformFor(applied[1].object, applied[1].placement, applied[1].nextObject)
    expect(initialTransform.position.x == 0 and initialTransform.position.z == 0, "initial spawn lost exact center")
    expect(initialTransform.rotation.y == 180, "initial spawn did not face its first route objective")
    expect(waitCount() == 1, "delayed HumanoidRootPart lookup was not used")

    state:activateCheckpoint(player, "scene", "Checkpoint01", 1, checkpoint, 1)
    local respawnCharacter = { delayedRoot = { name = "checkpoint-root" } }
    player.Character = respawnCharacter
    expect(controller:placeCharacter(player, respawnCharacter), "checkpoint placement failed")
    expect(applied[2].object == checkpoint, "checkpoint respawn did not use checkpoint object")
    expect(applied[2].placement == routeAwarePlacement, "checkpoint did not use shared placement")
    expect(applied[2].nextObject == nextRouteObject, "checkpoint did not face the next route object")
    local checkpointTransform =
        CharacterPlacement.transformFor(applied[2].object, applied[2].placement, applied[2].nextObject)
    expect(checkpointTransform.position.x == 0 and checkpointTransform.position.z == 31, "checkpoint lost exact center")
    expect(checkpointTransform.rotation.y == 180, "checkpoint did not face its next route objective")
end)

test("keeps placement isolated between two players", function()
    local state = PlayerProgress.new(0.75)
    local controller, applied = placementHarness(state)
    local spawn = placementObject("Spawn", 0, 0, 0, 0)
    local firstRouteObject = placementObject("FirstRouteObject", 10, 0, 0, 0)
    local checkpoint = placementObject("Checkpoint01", 20, 0, 0, 90)
    local nextRouteObject = placementObject("NextRouteObject", 20, 0, -10, 0)
    local playerA = {}
    local playerB = {}
    local characterA = { delayedRoot = {} }
    local characterB = { delayedRoot = {} }
    playerA.Character = characterA
    playerB.Character = characterB
    controller:activateScene(
        "scene",
        spawn,
        routeAwarePlacement,
        routeNavigator({
            Spawn = firstRouteObject,
            Checkpoint01 = nextRouteObject,
        })
    )
    state:activateCheckpoint(playerA, "scene", "Checkpoint01", 1, checkpoint, 1)

    controller:placeCharacter(playerA, characterA)
    controller:placeCharacter(playerB, characterB)
    expect(applied[1].object == checkpoint, "player A lost checkpoint placement")
    expect(applied[1].nextObject == nextRouteObject, "player A lost checkpoint route target")
    expect(applied[2].object == spawn, "player B inherited player A checkpoint")
    expect(applied[2].nextObject == firstRouteObject, "player B inherited player A route target")
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
    controller:activateScene("scene", placementObject("Spawn", 0, 0, 0, 0), routeAwarePlacement, routeNavigator({}))
    expect(not controller:placeCharacter(player, character), "missing root part was treated as placed")
    expect(not applied, "placement ran without a HumanoidRootPart")
end)

test("rejects delayed callbacks from a replaced scene", function()
    local state = PlayerProgress.new(0.75)
    local applied = {}
    local oldSpawn = placementObject("OldSpawn", 0, 0, 0, 0)
    local oldRouteTarget = placementObject("OldRouteTarget", 10, 0, 0, 0)
    local newSpawn = placementObject("NewSpawn", 0, 0, 0, 0)
    local newRouteTarget = placementObject("NewRouteTarget", -10, 0, 0, 0)
    local controller
    local replaceDuringWait = true
    controller = PlacementController.new(state, function(character)
        if replaceDuringWait then
            replaceDuringWait = false
            local newPlacement = clone(routeAwarePlacement)
            newPlacement.verticalOffset = 4
            controller:activateScene("new-scene", newSpawn, newPlacement, routeNavigator({ NewSpawn = newRouteTarget }))
        end
        return character.delayedRoot
    end, function(_, object, placement, nextObject)
        table.insert(applied, {
            object = object,
            placement = placement,
            nextObject = nextObject,
        })
    end)
    local player = {}
    local character = { delayedRoot = {} }
    player.Character = character
    controller:activateScene("old-scene", oldSpawn, routeAwarePlacement, routeNavigator({ OldSpawn = oldRouteTarget }))
    state:activateCheckpoint(player, "old-scene", "OldCheckpoint", 1, placementObject("OldCheckpoint", 5, 0, 0, 0), 1)

    expect(not controller:placeCharacter(player, character), "stale scene callback relocated the player")
    expect(#applied == 0, "stale scene placement was applied")

    local newCharacter = { delayedRoot = {} }
    player.Character = newCharacter
    expect(controller:placeCharacter(player, newCharacter), "replacement scene placement failed")
    expect(applied[1].object == newSpawn, "replacement scene used an old placement source")
    expect(applied[1].nextObject == newRouteTarget, "replacement scene used old route data")
    expect(applied[1].placement.verticalOffset == 4, "replacement scene used old placement data")
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

test("accepts the generated SceneManifest 0.3 validation transport", function()
    local valid, validationError = ManifestValidatorV03.validate(manifestV03)
    expect(valid, validationError or "generated SceneManifest 0.3 was rejected")
end)

test("keeps SceneManifest 0.2 and 0.3 validators version-isolated", function()
    local validV03 = ManifestValidatorV03.validate(manifest)
    local validV02 = ManifestValidator.validate(manifestV03)
    expect(not validV03, "0.3 validator accepted a 0.2 manifest")
    expect(not validV02, "0.2 validator accepted a 0.3 manifest")
end)

test("rejects incomplete or unsafe SceneManifest 0.3 route evidence", function()
    local hazardRoute = clone(manifestV03)
    local hazardId = nil
    for _, object in ipairs(hazardRoute.layers.gameplay.objects) do
        if object.role == "kill" then
            hazardId = object.id
            break
        end
    end
    expect(hazardId ~= nil, "reference manifest lacks a hazard test object")
    hazardRoute.navigation.safeRouteObjectIds[1] = hazardId
    local hazardValid = ManifestValidatorV03.validate(hazardRoute)
    expect(not hazardValid, "0.3 validator accepted a hazard route endpoint")

    local indeterminate = clone(manifestV03)
    indeterminate.navigation.reachability.requiredTransitions[1].outcome = "indeterminate"
    local evidenceValid = ManifestValidatorV03.validate(indeterminate)
    expect(not evidenceValid, "0.3 validator accepted indeterminate required evidence")
end)

registerG2ManifestAdmissionTests(test, expect)
registerG2BuildPlanTests(test, expect)
registerG2NativePartFactoryTests(test, expect)
registerG2SceneBuilderCoreTests(test, expect)
registerG2RuntimeSessionTests(test, expect)
registerG2BuilderTests(test, expect)
registerG2eAcceptanceHarnessTests(test, expect)

print(string.format("1..%d", passed))

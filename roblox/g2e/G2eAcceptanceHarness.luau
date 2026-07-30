local HttpService = game:GetService("HttpService")
local G2eObservationV03 = require("./G2eObservationV03")

local G2eAcceptanceHarness = {}

local MEASUREMENT_PREFIX = "[G2 runtime measurement] "
local OBSERVATION_PREFIX = "[G2 acceptance observation] "

local function approximately(actual, expected)
    return math.abs(actual - expected) < 0.00001
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
    elapsed,
    result,
    beforeHeap,
    configuredCollections
)
    local counts = G2eAcceptanceHarness.assertScene(result, manifest)
    local collections = configuredCollections
        or {
            observations = { { id = "scene-assertions", status = "PASS" } },
            warnings = {},
            errors = {},
            evidence = { "scene-assertions" },
            requiredObservationIds = { "scene-assertions" },
            requiredEvidenceIds = { "scene-assertions" },
        }
    local observation = G2eObservationV03.build({
        fixtureId = fixtureId,
        manifest = manifest,
        counts = counts,
        collections = collections,
    })
    local measurement = {
        schemaVersion = "g2-studio-measurement-v1",
        repositoryCommit = environment.repositoryCommit,
        studioVersion = environment.studioVersion,
        osBuild = environment.osBuild,
        fixtureId = fixtureId,
        manifestHash = manifest.manifestHash,
        runKind = runKind,
        runIndex = runIndex,
        elapsedMilliseconds = elapsed * 1000,
        gameplayObjects = #manifest.layers.gameplay.objects,
        decorativeObjects = #manifest.layers.decorative.objects,
        runtimeOwnedInstances = counts.total,
        connections = result.session:connectionCount(),
        luaHeapKilobytesBefore = beforeHeap,
        luaHeapKilobytesAfter = collectgarbage("count"),
        warnings = observation.warningCount,
        errors = observation.errorCount,
        orphans = 0,
    }
    for _, record in ipairs(G2eObservationV03.orderedRecords(measurement, observation)) do
        local prefix = if record.kind == "measurement" then MEASUREMENT_PREFIX else OBSERVATION_PREFIX
        print(prefix .. HttpService:JSONEncode(record.payload))
    end
    if observation.status == "FAIL" then
        warn(
            string.format(
                "[G2 acceptance diagnostic] code=%s field=%s",
                observation.diagnosticCode,
                observation.diagnosticField
            )
        )
    end
    return measurement, observation
end

function G2eAcceptanceHarness.bindControl(api)
    local folder = Instance.new("Folder")
    folder.Name = "G2eControl"
    folder.Parent = game:GetService("ServerStorage")
    for name, callback in pairs({
        Build = function(fixtureId, runKind, runIndex)
            return api:build(fixtureId, runKind, runIndex)
        end,
        RunReferenceReplacementSequence = function()
            return api:runReferenceReplacementSequence()
        end,
        RunMaximumSequence = function()
            return api:runMaximumSequence()
        end,
        RunFailureBoundary = function(boundary)
            return api:runFailureBoundary(boundary)
        end,
    }) do
        local bindable = Instance.new("BindableFunction")
        bindable.Name = name
        bindable.OnInvoke = callback
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

return table.freeze(G2eAcceptanceHarness)

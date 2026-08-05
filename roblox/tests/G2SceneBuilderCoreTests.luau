local ManifestLoaderV03 = require("../src/ReplicatedStorage/ObbyRuntime/ManifestLoaderV03")
local SceneBuilderCoreV03 = require("../src/ReplicatedStorage/ObbyRuntime/SceneBuilderCoreV03")
local FakeInstanceV03 = require("./support/FakeInstanceV03")

local reference = require("../generated/G2ReferenceManifestV03")
local boundary20 = require("../generated/G2Boundary20ManifestV03")
local boundary21 = require("../generated/G2Boundary21ManifestV03")
local decorative = require("../generated/G2DecorativeManifestV03")
local maximum50 = require("../generated/G2Maximum50ManifestV03")
local maximumParts = require("../generated/G2MaximumPartsManifestV03")
local replacement = require("../generated/G2ReplacementManifestV03")
local wedge = require("../generated/G2WedgeManifestV03")
local zeroCheckpoint = require("../generated/G2ZeroCheckpointManifestV03")

local function admit(value)
    local admitted, admissionError = ManifestLoaderV03.load({}, value.manifestHash, {
        requireModule = function()
            return value
        end,
    })
    assert(admitted ~= nil, admissionError and admissionError.message or "fixture admission failed")
    return admitted
end

local function harness()
    local tracker = FakeInstanceV03.tracker()
    local runtime = FakeInstanceV03.runtime(tracker)
    local workspace = FakeInstanceV03.new("Workspace", tracker)
    return tracker, runtime, workspace
end

local function activeRoots(workspace)
    local roots = {}
    for _, child in ipairs(workspace:GetChildren()) do
        if child.Name == "GeneratedObby" then
            table.insert(roots, child)
        end
    end
    return roots
end

local function replacementRuntime(workspace, state)
    return SceneBuilderCoreV03.newReplacementRuntime(workspace, state, function(value)
        return value == workspace and value:IsA("Workspace")
    end)
end

local function commit(candidate, workspace, state, options)
    return SceneBuilderCoreV03.commitCandidate(candidate, replacementRuntime(workspace, state), options)
end

local function publishReference(runtime, workspace)
    local state = SceneBuilderCoreV03.newRootState()
    local candidate, buildError = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
    assert(candidate ~= nil, buildError and buildError.message or "candidate failed")
    local root, commitError = commit(candidate, workspace, state)
    assert(root ~= nil, commitError and commitError.message or "initial commit failed")
    return state, root
end

return function(test, expect)
    test("rejects fake-only Destroyed member reads like Roblox Studio", function()
        local instance = FakeInstanceV03.new("Model")
        local readSucceeded = pcall(function()
            return instance.Destroyed
        end)
        expect(not readSucceeded, "fake Instance accepted the non-Roblox Destroyed member")
    end)

    test("builds a complete deterministic candidate outside Workspace", function()
        local tracker, runtime, workspace = harness()
        local candidate, buildError = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
        expect(candidate ~= nil, buildError and buildError.message or "candidate failed")
        expect(candidate.root.Parent == candidate.stagingContainer, "candidate escaped private staging")
        expect(candidate.stagingContainer.Parent == nil, "private staging entered Workspace")
        expect(#workspace:GetChildren() == 0, "candidate mutated active Workspace")
        expect(candidate.root.ClassName == "Model", "candidate root is not a Model")
        expect(candidate.root:GetAttribute("GeneratedBy") == "AIObbyBuilder/0.3", "ownership marker changed")
        expect(candidate.root:GetAttribute("SchemaVersion") == "0.3", "schema marker changed")
        expect(candidate.root:GetAttribute("ManifestHash") == reference.manifestHash, "hash marker changed")
        expect(candidate.root:GetAttribute("CandidateState") == "complete", "candidate is incomplete")
        expect(candidate.gameplayContainer.Name == "Gameplay", "gameplay container changed")
        expect(candidate.decorativeContainer.Name == "Decorative", "decorative container changed")
        expect(candidate.helperContainer.Name == "RuntimeInfrastructure", "helper container changed")
        expect(candidate.metadataContainer.Name == "Metadata", "metadata container changed")
        expect(
            #candidate.gameplayContainer:GetChildren() == candidate.plan.counts.gameplayParts,
            "gameplay count changed"
        )
        expect(
            #candidate.decorativeContainer:GetChildren() == candidate.plan.counts.decorativeParts,
            "decorative count changed"
        )
        expect(#candidate.helperContainer:GetChildren() == 1, "helper count changed")
        expect(candidate.helper.Name == "_RuntimeSpawnLocation", "helper identity changed")
        expect(candidate.partById.Spawn ~= nil and candidate.partById.Finish ~= nil, "lookup closure failed")
        expect(table.isfrozen(candidate.partById), "candidate lookup is mutable")
        expect(tracker.connections == 0, "candidate construction bound gameplay behavior")
    end)

    test("accepts a real-shaped replacement runtime record", function()
        local _, runtime, workspace = harness()
        local state = SceneBuilderCoreV03.newRootState()
        local replacementContext = replacementRuntime(workspace, state)
        local candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
        local root, commitError = SceneBuilderCoreV03.commitCandidate(candidate, replacementContext)
        expect(root ~= nil, commitError and commitError.message or "real-shaped replacement runtime failed")
        expect(root.Parent == workspace and state.currentRoot == root, "replacement runtime did not store exact root")
    end)

    test("rejects missing and wrong Workspace identity with typed fields", function()
        local _, runtime, workspace = harness()
        local state = SceneBuilderCoreV03.newRootState()
        local valid = replacementRuntime(workspace, state)

        local missingWorkspace = table.clone(valid)
        missingWorkspace.workspace = nil
        local candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
        local root, commitError = SceneBuilderCoreV03.commitCandidate(candidate, missingWorkspace)
        expect(
            root == nil and commitError.code == "commit-runtime-workspace" and commitError.field == "workspace",
            "missing Workspace did not fail with its typed field"
        )

        local wrongWorkspace = table.clone(valid)
        wrongWorkspace.workspace = FakeInstanceV03.new("Workspace")
        candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
        root, commitError = SceneBuilderCoreV03.commitCandidate(candidate, wrongWorkspace)
        expect(
            root == nil and commitError.code == "commit-runtime-workspace" and commitError.field == "workspace-identity",
            "wrong Workspace identity was accepted"
        )
    end)

    test("rejects missing current-root accessors before scene mutation", function()
        local _, runtime, workspace = harness()
        local state = SceneBuilderCoreV03.newRootState()
        local malformed = table.clone(replacementRuntime(workspace, state))
        malformed.getCurrentRoot = nil
        local candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
        local root, commitError = SceneBuilderCoreV03.commitCandidate(candidate, malformed)
        expect(
            root == nil and commitError.code == "commit-runtime-current-root" and commitError.field == "getCurrentRoot",
            "missing current-root accessor was accepted"
        )
        expect(#workspace:GetChildren() == 0, "malformed accessor mutated Workspace")
    end)

    test("rejects each malformed replacement session hook independently", function()
        for _, field in ipairs({ "getCurrentSession", "getCurrentGenerationToken", "setCurrent" }) do
            local _, runtime, workspace = harness()
            local state = SceneBuilderCoreV03.newRootState()
            local malformed = table.clone(replacementRuntime(workspace, state))
            malformed[field] = nil
            local candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
            local root, commitError = SceneBuilderCoreV03.commitCandidate(candidate, malformed)
            expect(
                root == nil and commitError.code == "commit-runtime-session" and commitError.field == field,
                field .. " did not fail with its typed field"
            )
            expect(#workspace:GetChildren() == 0 and state.currentRoot == nil, field .. " mutated root state")
        end
    end)

    test("rejects stale current-root and wrong manifest identity independently", function()
        local _, runtime, workspace = harness()
        local state, previous = publishReference(runtime, workspace)

        state.currentRoot = nil
        local candidate = SceneBuilderCoreV03.buildCandidate(admit(replacement), runtime)
        local root, commitError = commit(candidate, workspace, state)
        expect(
            root == nil and commitError.code == "commit-runtime-current-root" and commitError.field == "currentRoot",
            "stale current-root pointer did not receive a typed failure"
        )
        expect(previous.Parent == workspace, "stale current-root rejection changed the old scene")

        state.currentRoot = previous
        state.currentManifestHash = "sha256:" .. string.rep("0", 64)
        candidate = SceneBuilderCoreV03.buildCandidate(admit(replacement), runtime)
        root, commitError = commit(candidate, workspace, state)
        expect(
            root == nil and commitError.code == "commit-runtime-manifest" and commitError.field == "currentManifestHash",
            "wrong manifest identity did not receive a typed failure"
        )
        expect(previous.Parent == workspace, "manifest rejection changed the old scene")
    end)

    test("rejects malformed next-session hooks before pointer swap", function()
        local _, runtime, workspace = harness()
        local state = SceneBuilderCoreV03.newRootState()
        local candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
        local token = "g2d-generation-v1:test"
        candidate.root:SetAttribute("GenerationToken", token)
        local root, commitError = SceneBuilderCoreV03.commitCandidate(
            candidate,
            replacementRuntime(workspace, state),
            { nextSession = {}, nextGenerationToken = token }
        )
        expect(
            root == nil and commitError.code == "commit-runtime-session" and commitError.field == "nextSession",
            "malformed session hooks were accepted"
        )
        expect(#workspace:GetChildren() == 0 and state.currentRoot == nil, "session rejection changed root state")
    end)

    test("constructs Wedge decoration and 0/20/21/50-stage fixtures exactly", function()
        local _, runtime = harness()
        local wedgeCandidate, wedgeError = SceneBuilderCoreV03.buildCandidate(admit(wedge), runtime)
        expect(wedgeCandidate ~= nil, wedgeError and wedgeError.message or "Wedge fixture failed")
        expect(wedgeCandidate.gameplayParts[2].ClassName == "WedgePart", "Wedge did not use WedgePart")

        local decorativeCandidate, decorativeError = SceneBuilderCoreV03.buildCandidate(admit(decorative), runtime)
        expect(decorativeCandidate ~= nil, decorativeError and decorativeError.message or "decoration fixture failed")
        expect(#decorativeCandidate.decorativeParts == 1, "decoration count changed")
        local decorativePart = decorativeCandidate.decorativeParts[1]
        expect(
            not decorativePart.CanCollide and not decorativePart.CanTouch and not decorativePart.CanQuery,
            "decoration gained gameplay interaction"
        )

        for _, case in ipairs({
            { manifest = zeroCheckpoint, stages = 5, checkpoints = 0 },
            { manifest = boundary20, stages = 20, checkpoints = 3 },
            { manifest = boundary21, stages = 21, checkpoints = 4 },
            { manifest = maximum50, stages = 50, checkpoints = 9 },
        }) do
            local candidate, buildError = SceneBuilderCoreV03.buildCandidate(admit(case.manifest), runtime)
            expect(candidate ~= nil, buildError and buildError.message or "boundary fixture failed")
            expect(#case.manifest.navigation.stages == case.stages, "stage boundary changed")
            expect(#case.manifest.navigation.checkpointObjectIds == case.checkpoints, "checkpoint boundary changed")
            expect(
                candidate.plan.counts.manifestParts
                    == #case.manifest.layers.gameplay.objects + #case.manifest.layers.decorative.objects,
                "boundary Part count changed"
            )
        end
    end)

    test("enforces N-1 N and N+1 construction budgets at the 757-Part contract maximum", function()
        local admitted = admit(maximumParts)
        local tracker, runtime = harness()
        local expectedManifestParts = 757
        local expectedTotalParts = 758
        local expectedInstances = 764
        local allocationStart = tracker.allocations
        local rejected, budgetError = SceneBuilderCoreV03.buildCandidate(admitted, runtime, {
            maxParts = expectedTotalParts - 1,
            maxInstances = expectedInstances,
        })
        expect(rejected == nil and budgetError.code == "candidate-budget", "N-1 Part budget was admitted")
        expect(tracker.allocations == allocationStart, "rejected work allocated Instances")

        local exact, exactError = SceneBuilderCoreV03.buildCandidate(admitted, runtime, {
            maxParts = expectedTotalParts,
            maxInstances = expectedInstances,
        })
        expect(exact ~= nil, exactError and exactError.message or "N budget failed")
        expect(exact.plan.counts.manifestParts == expectedManifestParts, "maximum manifest Part count changed")
        expect(exact.plan.counts.totalParts == expectedTotalParts, "helper Part budget changed")
        expect(exact.plan.counts.totalInstances == expectedInstances, "bounded container budget changed")
        expect(tracker.allocations - allocationStart == expectedInstances, "N allocated the wrong Instance count")

        local nextTracker = FakeInstanceV03.tracker()
        local nextRuntime = FakeInstanceV03.runtime(nextTracker)
        local plusOne, plusOneError = SceneBuilderCoreV03.buildCandidate(admitted, nextRuntime, {
            maxParts = expectedTotalParts + 1,
            maxInstances = expectedInstances + 1,
        })
        expect(plusOne ~= nil, plusOneError and plusOneError.message or "N+1 budget failed")
        expect(plusOne.plan.structuralIdentity == exact.plan.structuralIdentity, "budget changed plan identity")
        expect(nextTracker.allocations == expectedInstances, "N+1 changed actual work")
    end)

    test("publishes the new root before destroying the previous root", function()
        local tracker, runtime, workspace = harness()
        local state, previous = publishReference(runtime, workspace)
        local candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
        local pointerWasNewAtDestroy = false
        tracker.onDestroy = function(instance)
            if instance == previous then
                pointerWasNewAtDestroy = state.currentRoot == candidate.root
            end
        end
        local root, commitError = commit(candidate, workspace, state)
        expect(root ~= nil, commitError and commitError.message or "replacement failed")
        expect(root == candidate.root and state.currentRoot == root, "current root pointer did not switch")
        expect(pointerWasNewAtDestroy, "old root was destroyed before pointer switch")
        expect(FakeInstanceV03.isDestroyed(previous), "retired root was not destroyed")
        expect(
            #activeRoots(workspace) == 1 and activeRoots(workspace)[1] == root,
            "active root is partial or ambiguous"
        )
        expect(FakeInstanceV03.isDestroyed(candidate.stagingContainer), "private staging survived commit")
    end)

    test("replaces a distinct admitted scene and records its exact manifest identity", function()
        local _, runtime, workspace = harness()
        local state, previous = publishReference(runtime, workspace)
        local candidate, buildError = SceneBuilderCoreV03.buildCandidate(admit(replacement), runtime)
        expect(candidate ~= nil, buildError and buildError.message or "replacement candidate failed")
        local root, commitError = commit(candidate, workspace, state)
        expect(root ~= nil, commitError and commitError.message or "replacement commit failed")
        expect(FakeInstanceV03.isDestroyed(previous), "previous scene survived replacement")
        expect(root:GetAttribute("ManifestHash") == replacement.manifestHash, "replacement hash changed")
        expect(state.currentManifestHash == replacement.manifestHash, "root-state identity did not switch")
        expect(#activeRoots(workspace) == 1 and activeRoots(workspace)[1] == root, "replacement was ambiguous")
    end)

    test("cleans candidates after every injected construction boundary", function()
        local boundaries = {
            "before-root",
            "after-root",
            "after-containers",
            "after-gameplay",
            "after-decorative",
            "after-helper",
            "before-validation",
        }
        for _, boundary in ipairs(boundaries) do
            local tracker, runtime, workspace = harness()
            local state, previous = publishReference(runtime, workspace)
            local allocationStart = tracker.allocations
            local candidate, buildError = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime, {
                failAt = boundary,
            })
            expect(
                candidate == nil and buildError.code == "candidate-injected-failure",
                boundary .. " was not injected"
            )
            expect(state.currentRoot == previous and previous.Parent == workspace, boundary .. " changed active root")
            expect(#activeRoots(workspace) == 1, boundary .. " left an ambiguous active root")
            for index = allocationStart + 1, #tracker.instances do
                expect(FakeInstanceV03.isDestroyed(tracker.instances[index]), boundary .. " leaked candidate state")
            end
        end
    end)

    test("rolls back every injected pre-pointer commit boundary", function()
        local boundaries = { "before-commit", "after-retire", "after-publish", "before-pointer" }
        for _, boundary in ipairs(boundaries) do
            local _, runtime, workspace = harness()
            local state, previous = publishReference(runtime, workspace)
            local candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
            local root, commitError = commit(candidate, workspace, state, {
                failAt = boundary,
            })
            expect(root == nil and commitError.code == "commit-injected-failure", boundary .. " was not injected")
            expect(state.currentRoot == previous, boundary .. " changed the current pointer")
            expect(previous.Parent == workspace and previous.Name == "GeneratedObby", boundary .. " lost old root")
            expect(not FakeInstanceV03.isDestroyed(previous), boundary .. " destroyed old root")
            expect(
                FakeInstanceV03.isDestroyed(candidate.root) and FakeInstanceV03.isDestroyed(candidate.stagingContainer),
                boundary .. " leaked candidate"
            )
            expect(#activeRoots(workspace) == 1, boundary .. " left a partial active root")
        end
    end)

    test("refuses unowned cross-version duplicate and changed-identity roots", function()
        for _, owner in ipairs({ "unowned", "AIObbyBuilder/0.2" }) do
            local _, runtime, workspace = harness()
            local existing = FakeInstanceV03.new("Model")
            existing.Name = "GeneratedObby"
            if owner ~= "unowned" then
                existing:SetAttribute("GeneratedBy", owner)
            end
            existing.Parent = workspace
            local state = SceneBuilderCoreV03.newRootState()
            local candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
            local root, commitError = commit(candidate, workspace, state)
            expect(root == nil and commitError.code == "active-root-ownership", owner .. " root was replaced")
            expect(
                existing.Parent == workspace and not FakeInstanceV03.isDestroyed(existing),
                owner .. " root was changed"
            )
        end

        local _, runtime, workspace = harness()
        local state, previous = publishReference(runtime, workspace)
        local duplicate = FakeInstanceV03.new("Model")
        duplicate.Name = "GeneratedObby"
        duplicate:SetAttribute("GeneratedBy", "AIObbyBuilder/0.3")
        duplicate.Parent = workspace
        local candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
        local root, commitError = commit(candidate, workspace, state)
        expect(root == nil and commitError.code == "active-root-ambiguous", "duplicate active roots were accepted")
        expect(
            not FakeInstanceV03.isDestroyed(previous) and not FakeInstanceV03.isDestroyed(duplicate),
            "ambiguous roots were modified"
        )

        duplicate:Destroy()
        candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
        candidate.root:SetAttribute("ManifestHash", "sha256:" .. string.rep("0", 64))
        root, commitError = commit(candidate, workspace, state)
        expect(root == nil and commitError.code == "candidate-identity", "changed candidate identity was accepted")
        expect(
            state.currentRoot == previous and not FakeInstanceV03.isDestroyed(previous),
            "identity rejection changed active root"
        )

        previous:SetAttribute("ManifestHash", "sha256:" .. string.rep("1", 64))
        candidate = SceneBuilderCoreV03.buildCandidate(admit(replacement), runtime)
        root, commitError = commit(candidate, workspace, state)
        expect(root == nil and commitError.code == "commit-runtime-manifest", "changed active identity was accepted")
        expect(
            state.currentRoot == previous and not FakeInstanceV03.isDestroyed(previous),
            "active identity rejection changed root"
        )
    end)

    test("rejects an explicitly disposed candidate without touching the active scene", function()
        local _, runtime, workspace = harness()
        local state, previous = publishReference(runtime, workspace)
        local candidate = SceneBuilderCoreV03.buildCandidate(admit(replacement), runtime)
        local disposed, disposeError = SceneBuilderCoreV03.disposeCandidate(candidate)
        expect(disposed == true, disposeError and disposeError.message or "candidate disposal failed")
        local root, commitError = commit(candidate, workspace, state)
        expect(root == nil and commitError.code == "candidate-identity", "disposed candidate was accepted")
        expect(state.currentRoot == previous and previous.Parent == workspace, "disposed candidate changed old scene")
        expect(FakeInstanceV03.isDestroyed(candidate.root), "disposed candidate root survived")
    end)

    test("rejects a candidate removed from its owned staging hierarchy", function()
        local _, runtime, workspace = harness()
        local state, previous = publishReference(runtime, workspace)
        local candidate = SceneBuilderCoreV03.buildCandidate(admit(replacement), runtime)
        candidate.root.Parent = nil
        local root, commitError = commit(candidate, workspace, state)
        expect(root == nil and commitError.code == "candidate-identity", "removed candidate was accepted")
        expect(state.currentRoot == previous and previous.Parent == workspace, "removed candidate changed old scene")
        expect(FakeInstanceV03.isDestroyed(candidate.root), "removed candidate root survived cleanup")
        expect(FakeInstanceV03.isDestroyed(candidate.stagingContainer), "removed candidate staging survived cleanup")
    end)

    test("keeps the new root authoritative when retired-root cleanup fails", function()
        local _, runtime, workspace = harness()
        local state, previous = publishReference(runtime, workspace)
        previous.FailDestroy = true
        local candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
        local root, cleanupError = commit(candidate, workspace, state)
        expect(root == candidate.root and cleanupError.code == "commit-cleanup", "cleanup failure hid committed root")
        expect(state.currentRoot == root and root.Parent == workspace, "cleanup failure rolled back committed root")
        expect(previous.Parent == candidate.stagingContainer, "failed retired root was not quarantined")
        expect(#activeRoots(workspace) == 1, "cleanup failure left ambiguous active roots")
    end)
end

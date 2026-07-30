local ManifestLoaderV03 = require("../src/ReplicatedStorage/ObbyRuntime/ManifestLoaderV03")
local SceneBuilderCoreV03 = require("../src/ReplicatedStorage/ObbyRuntime/SceneBuilderCoreV03")
local FakeInstanceV03 = require("./support/FakeInstanceV03")

local reference = require("../generated/G2ReferenceManifestV03")

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

local function publishReference(runtime, workspace)
    local state = SceneBuilderCoreV03.newRootState()
    local candidate, buildError = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
    assert(candidate ~= nil, buildError and buildError.message or "candidate failed")
    local root, commitError = SceneBuilderCoreV03.commitCandidate(candidate, workspace, state)
    assert(root ~= nil, commitError and commitError.message or "initial commit failed")
    return state, root
end

return function(test, expect)
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
        local root, commitError = SceneBuilderCoreV03.commitCandidate(candidate, workspace, state)
        expect(root ~= nil, commitError and commitError.message or "replacement failed")
        expect(root == candidate.root and state.currentRoot == root, "current root pointer did not switch")
        expect(pointerWasNewAtDestroy, "old root was destroyed before pointer switch")
        expect(previous.Destroyed, "retired root was not destroyed")
        expect(
            #activeRoots(workspace) == 1 and activeRoots(workspace)[1] == root,
            "active root is partial or ambiguous"
        )
        expect(candidate.stagingContainer.Destroyed, "private staging survived commit")
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
                expect(tracker.instances[index].Destroyed, boundary .. " leaked candidate state")
            end
        end
    end)

    test("rolls back every injected pre-pointer commit boundary", function()
        local boundaries = { "before-commit", "after-retire", "after-publish", "before-pointer" }
        for _, boundary in ipairs(boundaries) do
            local _, runtime, workspace = harness()
            local state, previous = publishReference(runtime, workspace)
            local candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
            local root, commitError = SceneBuilderCoreV03.commitCandidate(candidate, workspace, state, {
                failAt = boundary,
            })
            expect(root == nil and commitError.code == "commit-injected-failure", boundary .. " was not injected")
            expect(state.currentRoot == previous, boundary .. " changed the current pointer")
            expect(previous.Parent == workspace and previous.Name == "GeneratedObby", boundary .. " lost old root")
            expect(not previous.Destroyed, boundary .. " destroyed old root")
            expect(candidate.root.Destroyed and candidate.stagingContainer.Destroyed, boundary .. " leaked candidate")
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
            local root, commitError = SceneBuilderCoreV03.commitCandidate(candidate, workspace, state)
            expect(root == nil and commitError.code == "active-root-ownership", owner .. " root was replaced")
            expect(existing.Parent == workspace and not existing.Destroyed, owner .. " root was changed")
        end

        local _, runtime, workspace = harness()
        local state, previous = publishReference(runtime, workspace)
        local duplicate = FakeInstanceV03.new("Model")
        duplicate.Name = "GeneratedObby"
        duplicate:SetAttribute("GeneratedBy", "AIObbyBuilder/0.3")
        duplicate.Parent = workspace
        local candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
        local root, commitError = SceneBuilderCoreV03.commitCandidate(candidate, workspace, state)
        expect(root == nil and commitError.code == "active-root-ambiguous", "duplicate active roots were accepted")
        expect(not previous.Destroyed and not duplicate.Destroyed, "ambiguous roots were modified")

        duplicate:Destroy()
        candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
        candidate.root:SetAttribute("ManifestHash", "sha256:" .. string.rep("0", 64))
        root, commitError = SceneBuilderCoreV03.commitCandidate(candidate, workspace, state)
        expect(root == nil and commitError.code == "candidate-identity", "changed candidate identity was accepted")
        expect(state.currentRoot == previous and not previous.Destroyed, "identity rejection changed active root")
    end)

    test("keeps the new root authoritative when retired-root cleanup fails", function()
        local _, runtime, workspace = harness()
        local state, previous = publishReference(runtime, workspace)
        previous.FailDestroy = true
        local candidate = SceneBuilderCoreV03.buildCandidate(admit(reference), runtime)
        local root, cleanupError = SceneBuilderCoreV03.commitCandidate(candidate, workspace, state)
        expect(root == candidate.root and cleanupError.code == "commit-cleanup", "cleanup failure hid committed root")
        expect(state.currentRoot == root and root.Parent == workspace, "cleanup failure rolled back committed root")
        expect(previous.Parent == candidate.stagingContainer, "failed retired root was not quarantined")
        expect(#activeRoots(workspace) == 1, "cleanup failure left ambiguous active roots")
    end)
end

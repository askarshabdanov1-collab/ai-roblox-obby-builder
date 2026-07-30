local BuildPlanV03 = require("../src/ReplicatedStorage/ObbyRuntime/BuildPlanV03")
local ManifestLoaderV03 = require("../src/ReplicatedStorage/ObbyRuntime/ManifestLoaderV03")
local NativePartFactoryV03 = require("../src/ReplicatedStorage/ObbyRuntime/NativePartFactoryV03")
local FakeInstanceV03 = require("./support/FakeInstanceV03")

local reference = require("../generated/G2ReferenceManifestV03")

local function admittedPlan()
    local admitted = ManifestLoaderV03.load({}, reference.manifestHash, {
        requireModule = function()
            return reference
        end,
    })
    return BuildPlanV03.create(admitted)
end

local function with(record, overrides)
    local result = table.clone(record)
    for key, value in next, overrides do
        result[key] = value
    end
    return result
end

return function(test, expect)
    test("maps Block Ball Cylinder and Wedge to exact native classes", function()
        local plan = admittedPlan()
        local base = plan.gameplayRecords[2]
        for _, case in ipairs({
            { shape = "Block", className = "Part" },
            { shape = "Ball", className = "Part" },
            { shape = "Cylinder", className = "Part" },
            { shape = "Wedge", className = "WedgePart" },
        }) do
            local tracker = FakeInstanceV03.tracker()
            local part, factoryError =
                NativePartFactoryV03.create(with(base, { shape = case.shape }), FakeInstanceV03.runtime(tracker))
            expect(part ~= nil, factoryError and factoryError.message or case.shape .. " failed")
            expect(part.ClassName == case.className, case.shape .. " used the wrong native class")
            if case.className == "Part" then
                expect(part.Shape == case.shape, case.shape .. " PartType was not applied")
            end
            expect(tracker.allocations == 1, case.shape .. " allocated the wrong number of Instances")
        end
    end)

    test("applies exact transform size appearance collision name and attributes", function()
        local plan = admittedPlan()
        local record = plan.gameplayRecords[2]
        local tracker = FakeInstanceV03.tracker()
        local part, factoryError = NativePartFactoryV03.create(record, FakeInstanceV03.runtime(tracker))
        expect(part ~= nil, factoryError and factoryError.message or "gameplay Part failed")
        expect(part.Name == record.id, "deterministic Part name changed")
        expect(
            part.Size.x == record.size.x and part.Size.y == record.size.y and part.Size.z == record.size.z,
            "size changed"
        )
        expect(part.CFrame.position.x == record.transform.position.x, "position changed")
        expect(part.CFrame.rotation.y == record.transform.rotation.y, "rotation changed")
        expect(part.Color == record.appearance.color, "color changed")
        expect(part.Material == record.appearance.material, "material changed")
        expect(part.Anchored == record.collision.anchored, "anchored changed")
        expect(part.CanCollide == record.collision.canCollide, "CanCollide changed")
        expect(part.CanTouch == record.collision.canTouch, "CanTouch changed")
        expect(part.CanQuery == record.collision.canQuery, "CanQuery changed")
        expect(part.Transparency == 0, "manifest Part transparency changed")
        expect(part:GetAttribute("ObjectId") == record.id, "object diagnostic identity missing")
        expect(part:GetAttribute("ManifestHash") == plan.manifestHash, "manifest diagnostic identity missing")
        expect(
            part:GetAttribute("SourceStageId") == record.sourceReferences.sourceStageId,
            "source-stage diagnostic changed"
        )
        expect(tracker.connections == 0, "factory bound gameplay behavior")
    end)

    test("forces decorative and helper records to remain non-authoritative", function()
        local plan = admittedPlan()
        local base = plan.gameplayRecords[2]
        local decorative = with(base, {
            id = "DecorativeTest",
            layer = "decorative",
            role = nil,
            zoneId = "stage-1-decoration",
            sourceReferences = nil,
            collision = {
                anchored = true,
                canCollide = false,
                canTouch = false,
                canQuery = false,
            },
        })
        local tracker = FakeInstanceV03.tracker()
        local part = NativePartFactoryV03.create(decorative, FakeInstanceV03.runtime(tracker))
        expect(not part.CanCollide and not part.CanTouch and not part.CanQuery, "decoration gained interaction")

        local helper = NativePartFactoryV03.create(plan.helperSpawnRecord, FakeInstanceV03.runtime(tracker))
        expect(helper.ClassName == "SpawnLocation", "helper did not use SpawnLocation")
        expect(helper.Transparency == 1, "helper became visible")
        expect(not helper.CanCollide and not helper.CanTouch and not helper.CanQuery, "helper gained interaction")
        expect(helper.Neutral and helper.Enabled and helper.Duration == 0, "helper spawn configuration changed")
        expect(helper:GetAttribute("NonAuthoritative") == true, "helper authority marker is missing")
        expect(tracker.connections == 0, "helper construction bound behavior")
    end)

    test("rejects unsupported shape material and unsafe decoration before allocation", function()
        local plan = admittedPlan()
        local base = plan.gameplayRecords[2]
        local cases = {
            with(base, { shape = "Mesh" }),
            with(base, { appearance = { color = "#FFFFFF", colorRole = "primary", material = "Wood" } }),
            with(base, {
                layer = "decorative",
                role = nil,
                zoneId = "stage-1-decoration",
                sourceReferences = nil,
                collision = { anchored = true, canCollide = true, canTouch = false, canQuery = false },
            }),
        }
        for _, record in ipairs(cases) do
            local tracker = FakeInstanceV03.tracker()
            local part, factoryError = NativePartFactoryV03.create(record, FakeInstanceV03.runtime(tracker))
            expect(part == nil and factoryError.code == "factory-record", "unsupported record was constructed")
            expect(tracker.allocations == 0, "unsupported record allocated an Instance")
        end
    end)
end

local FakeInstanceV03 = {}

local BASE_PART_CLASSES = {
    Part = true,
    SpawnLocation = true,
    WedgePart = true,
}

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

function FakeInstanceV03.__newindex(instance, key, value)
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

function FakeInstanceV03.__index(instance, key)
    if key == "Parent" then
        return rawget(instance, "_parent")
    end
    return FakeInstanceV03[key]
end

function FakeInstanceV03.new(className, tracker)
    local instance = setmetatable({
        ClassName = className,
        Name = className,
        _children = {},
        _attributes = {},
        _tracker = tracker,
        Destroyed = false,
    }, FakeInstanceV03)
    if tracker ~= nil then
        tracker.allocations += 1
        table.insert(tracker.instances, instance)
    end
    return instance
end

function FakeInstanceV03:SetAttribute(name, value)
    self._attributes[name] = value
end

function FakeInstanceV03:GetAttribute(name)
    return self._attributes[name]
end

function FakeInstanceV03:GetChildren()
    local result = {}
    for _, child in ipairs(self._children) do
        table.insert(result, child)
    end
    return result
end

function FakeInstanceV03:FindFirstChild(name)
    for _, child in ipairs(self._children) do
        if child.Name == name then
            return child
        end
    end
    return nil
end

function FakeInstanceV03:IsA(className)
    return self.ClassName == className or (className == "BasePart" and BASE_PART_CLASSES[self.ClassName] == true)
end

function FakeInstanceV03:Destroy()
    if self.FailDestroy then
        error("injected destroy failure")
    end
    for _, child in ipairs(self:GetChildren()) do
        child:Destroy()
    end
    detach(self)
    rawset(self, "_parent", nil)
    self.Destroyed = true
    if self._tracker ~= nil and self._tracker.onDestroy ~= nil then
        self._tracker.onDestroy(self)
    end
end

function FakeInstanceV03.tracker()
    return {
        allocations = 0,
        connections = 0,
        instances = {},
    }
end

function FakeInstanceV03.runtime(tracker)
    return {
        newInstance = function(className)
            return FakeInstanceV03.new(className, tracker)
        end,
        vector3 = function(x, y, z)
            return { x = x, y = y, z = z }
        end,
        cframe = function(transform)
            return {
                position = {
                    x = transform.position.x,
                    y = transform.position.y,
                    z = transform.position.z,
                },
                rotation = {
                    x = transform.rotation.x,
                    y = transform.rotation.y,
                    z = transform.rotation.z,
                },
            }
        end,
        color = function(hex)
            return hex
        end,
        materials = {
            Neon = "Neon",
            SmoothPlastic = "SmoothPlastic",
        },
        shapes = {
            Ball = "Ball",
            Block = "Block",
            Cylinder = "Cylinder",
        },
    }
end

return table.freeze(FakeInstanceV03)

local BuildPlan = {}

function BuildPlan.create(manifest)
    local instructions = {}
    for _, object in ipairs(manifest.layers.gameplay.objects) do
        table.insert(instructions, {
            object = object,
            touchBehavior = object.behavior.kind,
        })
    end
    for _, object in ipairs(manifest.layers.decorative.objects) do
        table.insert(instructions, {
            object = object,
            touchBehavior = "decoration",
        })
    end

    return {
        sceneId = manifest.sceneId,
        manifestHash = manifest.manifestHash,
        instructions = instructions,
    }
end

return BuildPlan

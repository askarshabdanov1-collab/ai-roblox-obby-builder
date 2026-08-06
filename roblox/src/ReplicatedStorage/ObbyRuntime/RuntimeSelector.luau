local RuntimeSelector = {}

local SUPPORTED_RUNTIME_VERSIONS = table.freeze({
    ["0.2"] = true,
    ["0.3"] = true,
})

local SUPPORTED_EXECUTION_MODES = table.freeze({
    production = true,
    ["studio-acceptance"] = true,
})

function RuntimeSelector.resolve(runtimeVersion, executionMode)
    if not SUPPORTED_RUNTIME_VERSIONS[runtimeVersion] then
        return nil, string.format("unsupported SceneManifest runtime version: %s", tostring(runtimeVersion))
    end
    if not SUPPORTED_EXECUTION_MODES[executionMode] then
        return nil, string.format("unsupported runtime execution mode: %s", tostring(executionMode))
    end
    if runtimeVersion == "0.2" and executionMode ~= "production" then
        return nil,
            string.format(
                "unsupported runtime selection: SceneManifest %s cannot use %s mode",
                runtimeVersion,
                executionMode
            )
    end

    return table.freeze({
        runtimeVersion = runtimeVersion,
        executionMode = executionMode,
        autoBuild = executionMode == "production",
    }),
        nil
end

return table.freeze(RuntimeSelector)

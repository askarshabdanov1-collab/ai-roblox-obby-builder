-- Development-only Studio feasibility plugin. It stores no settings and has no production call site.
local EncodingService = game:GetService("EncodingService")
local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")

local ORIGIN = "roblox-studio-plugin://ai-obby-builder-studio-feasibility"
local MAXIMUM_BYTES = 65536
local sequence = 1
local evidenceSequence = 1
local activation = nil
local binding = nil
local armed = false
local autoStartInFlight = false
local lastArmedProbeAt = 0

local toolbar = plugin:CreateToolbar("AI Obby Builder Dev")
local toggle = toolbar:CreateButton("Studio feasibility", "Open the development-only loopback probe", "")
local widget = plugin:CreateDockWidgetPluginGuiAsync(
    "AIObbyBuilderStudioFeasibility",
    DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Float, false, false, 460, 330, 360, 220)
)
widget.Title = "Studio feasibility (development only)"

local panel = Instance.new("Frame")
panel.Size = UDim2.fromScale(1, 1)
panel.BackgroundTransparency = 1
panel.Parent = widget

local input = Instance.new("TextBox")
input.ClearTextOnFocus = false
input.MultiLine = true
input.PlaceholderText = "Paste activation in Edit mode, then Prepare / Arm"
input.Size = UDim2.new(1, -16, 0, 130)
input.Position = UDim2.fromOffset(8, 8)
input.TextWrapped = true
input.TextXAlignment = Enum.TextXAlignment.Left
input.TextYAlignment = Enum.TextYAlignment.Top
input.Parent = panel

local status = Instance.new("TextLabel")
status.BackgroundTransparency = 1
status.Position = UDim2.fromOffset(8, 145)
status.Size = UDim2.new(1, -16, 0, 100)
status.TextWrapped = true
status.TextXAlignment = Enum.TextXAlignment.Left
status.TextYAlignment = Enum.TextYAlignment.Top
status.Text = "Paste activation in Edit mode and Prepare / Arm. It is kept only in this Studio process."
status.Parent = panel

local function button(text, x)
    local value = Instance.new("TextButton")
    value.Size = UDim2.fromOffset(106, 30)
    value.Position = UDim2.fromOffset(x, 285)
    value.Text = text
    value.Parent = panel
    return value
end

local arm = button("Prepare / Arm", 8)
local submitEvidence = button("Submit evidence", 118)
local stop = button("Stop", 228)
local recover = button("Recovery", 338)

local function hexToBytes(value)
    if type(value) ~= "string" or #value ~= 64 or string.find(value, "[^0-9a-f]") then
        return nil
    end
    local bytes = {}
    for index = 1, #value, 2 do
        table.insert(bytes, string.char(tonumber(string.sub(value, index, index + 1), 16)))
    end
    return table.concat(bytes)
end

local function xorBytes(value, mask)
    local parts = {}
    for index = 1, #value do
        parts[index] = string.char(bit32.bxor(string.byte(value, index), mask))
    end
    return table.concat(parts)
end

local function base64Url(value)
    local encoded = buffer.tostring(EncodingService:Base64Encode(buffer.fromstring(value)))
    return string.gsub(string.gsub(string.gsub(encoded, "+", "-"), "/", "_"), "=", "")
end

local function sha256(value)
    return EncodingService:ComputeStringHash(value, Enum.HashAlgorithm.Sha256)
end

local function sha256Hex(value)
    local parts = {}
    for index = 1, #value do
        parts[index] = string.format("%02x", string.byte(value, index))
    end
    return "sha256:" .. table.concat(parts)
end

local function hmac(secret, message)
    local key = if #secret > 64 then sha256(secret) else secret
    key = key .. string.rep("\0", 64 - #key)
    return base64Url(sha256(xorBytes(key, 0x5c) .. sha256(xorBytes(key, 0x36) .. message)))
end

local function currentBinding()
    if activation == nil then
        return nil, "activation-required"
    end
    local root = workspace:FindFirstChild("GeneratedObby")
    if root == nil then
        return nil, "generated-root-required"
    end
    local owner = root:GetAttribute("GeneratedBy")
    local manifestHash = root:GetAttribute("ManifestHash")
    local generationToken = root:GetAttribute("GenerationToken")
    if owner ~= "AIObbyBuilder/0.3" or type(manifestHash) ~= "string" or type(generationToken) ~= "string" then
        return nil, "invalid-generated-root-binding"
    end
    binding = {
        executionId = activation.executionId,
        sceneId = "place-" .. tostring(game.PlaceId),
        generatedRootOwner = owner,
        manifestHash = manifestHash,
        sceneGeneration = generationToken,
        playtestSessionId = "playtest-" .. HttpService:GenerateGUID(false),
    }
    return binding, nil
end

local function send(command, payload)
    if activation == nil then
        return nil, "activation-required"
    end
    local raw = HttpService:JSONEncode(payload)
    if #raw > MAXIMUM_BYTES then
        return nil, "payload-too-large"
    end
    local secret = hexToBytes(activation.secretHex)
    if secret == nil then
        return nil, "invalid-activation-secret"
    end
    local digest = sha256Hex(raw)
    local preimage = table.concat({
        "1.0.0",
        activation.sessionId,
        tostring(sequence),
        "request-" .. tostring(sequence),
        tostring(activation.expiresAtEpochMs),
        command,
        digest,
        "127.0.0.1",
        ORIGIN,
    }, "\n")
    local message = {
        protocolVersion = "1.0.0",
        sessionId = activation.sessionId,
        sequence = sequence,
        requestId = "request-" .. tostring(sequence),
        expiresAtEpochMs = activation.expiresAtEpochMs,
        command = command,
        payloadBase64 = buffer.tostring(EncodingService:Base64Encode(buffer.fromstring(raw))),
        payloadDigest = digest,
        peerAddress = "127.0.0.1",
        origin = ORIGIN,
        authenticationTag = hmac(secret, preimage),
    }
    local ok, response = pcall(function()
        return HttpService:RequestAsync({
            Url = activation.bridgeUrl .. "/v1/message",
            Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = HttpService:JSONEncode(message),
        })
    end)
    if not ok or not response.Success then
        return nil, "loopback-request-failed"
    end
    sequence += 1
    return HttpService:JSONDecode(response.Body), nil
end

local function show(value)
    status.Text = HttpService:JSONEncode(value)
end

toggle.Click:Connect(function()
    widget.Enabled = not widget.Enabled
end)

local function capabilityOffer()
    return {
        protocolVersion = "1.0.0",
        studioVersion = "manual-observation",
        windowsVersion = "manual-observation",
        pluginVersion = "0.1.0-dev",
        bridgeVersion = "0.1.0-dev",
        orchestratorVersion = "0.2.0",
        adapterId = "studio-feasibility-model-v1",
        transports = { "http-polling" },
        playtestModes = { "single-player" },
        captureCapabilities = { "none" },
        securityFeatures = {
            "loopback-only-v1",
            "message-auth-v1",
            "sequence-v1",
            "expiry-v1",
            "payload-digest-v1",
            "integrity-v1",
        },
        maximumPayloadBytes = 65536,
    }
end

local function handshakeAndStart(value)
    local response, requestCode = send("reconcile", {
        binding = value,
        capabilityOffer = capabilityOffer(),
    })
    if response == nil then
        return false, { ok = false, code = requestCode }
    end
    local started, startCode = send("start", {})
    if started == nil or started.ok ~= true then
        return false, { handshake = response, start = started, code = startCode }
    end
    return true, { handshake = response, start = started, binding = value }
end

arm.Click:Connect(function()
    if RunService:IsRunning() then
        show({ ok = false, code = "arm-requires-edit-mode" })
        return
    end
    local ok, parsed = pcall(function()
        return HttpService:JSONDecode(input.Text)
    end)
    if
        not ok
        or type(parsed) ~= "table"
        or parsed.protocolVersion ~= "1.0.0"
        or parsed.bridgeUrl ~= "http://127.0.0.1:4318"
    then
        show({ ok = false, code = "invalid-activation" })
        return
    end
    if hexToBytes(parsed.secretHex) == nil then
        show({ ok = false, code = "invalid-activation-secret" })
        return
    end
    activation = parsed
    binding = nil
    sequence = 1
    evidenceSequence = 1
    armed = true
    input.Text = ""
    show({
        ok = true,
        code = "armed-waiting-for-generated-root",
        executionId = activation.executionId,
    })
end)

RunService.Heartbeat:Connect(function()
    if not armed or autoStartInFlight or not RunService:IsRunning() then
        return
    end
    if os.clock() - lastArmedProbeAt < 0.25 then
        return
    end
    lastArmedProbeAt = os.clock()
    if workspace:FindFirstChild("GeneratedObby") == nil then
        return
    end
    autoStartInFlight = true
    local value, code = currentBinding()
    if value == nil then
        armed = false
        show({ ok = false, code = code })
    else
        local started, result = handshakeAndStart(value)
        armed = false
        if started then
            show({ ok = true, code = "armed-started", binding = value, result = result })
        else
            show(result)
        end
    end
    autoStartInFlight = false
end)

stop.Click:Connect(function()
    local response, code = send("stop", {})
    show({ stop = response, code = code, binding = binding })
end)

submitEvidence.Click:Connect(function()
    if binding == nil then
        show({ ok = false, code = "binding-required" })
        return
    end
    local observation = HttpService:JSONEncode({ event = "binding-observed" })
    local response, code = send("submit-evidence", {
        executionId = binding.executionId,
        sceneId = binding.sceneId,
        generatedRootOwner = binding.generatedRootOwner,
        manifestHash = binding.manifestHash,
        sceneGeneration = binding.sceneGeneration,
        playtestSessionId = binding.playtestSessionId,
        sequence = evidenceSequence,
        payloadBase64 = buffer.tostring(EncodingService:Base64Encode(buffer.fromstring(observation))),
        payloadDigest = sha256Hex(observation),
        completionMarker = true,
    })
    if response ~= nil and response.ok == true then
        evidenceSequence += 1
    end
    show({ evidence = response, code = code, binding = binding })
end)
recover.Click:Connect(function()
    local response, code = send("reconcile", { binding = binding })
    show({ recovery = response, code = code, binding = binding })
end)

return {
    sceneId = "vertical-slice-001",
    spawn = Vector3.new(0, 3, 0),
    parts = {
        { id = "StartPlatform", role = "platform", position = Vector3.new(0, 0, 0), size = Vector3.new(24, 2, 24), color = Color3.fromRGB(31, 41, 55), material = Enum.Material.SmoothPlastic, collision = true },
        { id = "JumpPlatform01", role = "platform", position = Vector3.new(0, 3, 18), size = Vector3.new(10, 2, 10), color = Color3.fromRGB(34, 211, 238), material = Enum.Material.SmoothPlastic, collision = true },
        { id = "Checkpoint01", role = "checkpoint", position = Vector3.new(0, 6, 34), size = Vector3.new(12, 1, 12), color = Color3.fromRGB(250, 204, 21), material = Enum.Material.Neon, collision = true },
        { id = "FinishPlatform", role = "finish", position = Vector3.new(0, 10, 52), size = Vector3.new(18, 2, 18), color = Color3.fromRGB(217, 70, 239), material = Enum.Material.SmoothPlastic, collision = true },
    },
}

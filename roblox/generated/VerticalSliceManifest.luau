-- This file is generated from examples/vertical-slice/place-spec.json.
-- Do not edit it by hand; run `npm run fixtures:generate`.
return {
    ["coordinateSystem"] = {
        ["forwardAxis"] = "-Z",
        ["handedness"] = "right-handed",
        ["rotationOrder"] = "XYZ",
        ["rotationUnit"] = "degrees",
        ["units"] = "studs",
        ["upAxis"] = "+Y",
    },
    ["generatorVersion"] = "0.2.0",
    ["layers"] = {
        ["decorative"] = {
            ["objects"] = {},
        },
        ["gameplay"] = {
            ["objects"] = {
                {
                    ["behavior"] = {
                        ["kind"] = "spawn",
                    },
                    ["className"] = "SpawnLocation",
                    ["color"] = "#22D3EE",
                    ["id"] = "Spawn",
                    ["material"] = "SmoothPlastic",
                    ["order"] = 0,
                    ["physics"] = {
                        ["anchored"] = true,
                        ["canCollide"] = true,
                        ["canQuery"] = true,
                        ["canTouch"] = false,
                    },
                    ["role"] = "spawn",
                    ["shape"] = "Block",
                    ["size"] = {
                        ["x"] = 12,
                        ["y"] = 1,
                        ["z"] = 12,
                    },
                    ["transform"] = {
                        ["position"] = {
                            ["x"] = 0,
                            ["y"] = 3,
                            ["z"] = 0,
                        },
                        ["rotation"] = {
                            ["x"] = 0,
                            ["y"] = 0,
                            ["z"] = 0,
                        },
                    },
                },
                {
                    ["behavior"] = {
                        ["kind"] = "platform",
                    },
                    ["className"] = "Part",
                    ["color"] = "#22D3EE",
                    ["id"] = "JumpPlatform01",
                    ["material"] = "SmoothPlastic",
                    ["order"] = 1,
                    ["physics"] = {
                        ["anchored"] = true,
                        ["canCollide"] = true,
                        ["canQuery"] = true,
                        ["canTouch"] = false,
                    },
                    ["role"] = "platform",
                    ["shape"] = "Block",
                    ["size"] = {
                        ["x"] = 10,
                        ["y"] = 2,
                        ["z"] = 10,
                    },
                    ["transform"] = {
                        ["position"] = {
                            ["x"] = 0,
                            ["y"] = 4,
                            ["z"] = 16,
                        },
                        ["rotation"] = {
                            ["x"] = 0,
                            ["y"] = 0,
                            ["z"] = 0,
                        },
                    },
                },
                {
                    ["behavior"] = {
                        ["checkpointOrder"] = 1,
                        ["kind"] = "checkpoint",
                    },
                    ["className"] = "Part",
                    ["color"] = "#FACC15",
                    ["id"] = "Checkpoint01",
                    ["material"] = "Neon",
                    ["order"] = 2,
                    ["physics"] = {
                        ["anchored"] = true,
                        ["canCollide"] = true,
                        ["canQuery"] = true,
                        ["canTouch"] = true,
                    },
                    ["role"] = "checkpoint",
                    ["shape"] = "Block",
                    ["size"] = {
                        ["x"] = 12,
                        ["y"] = 1,
                        ["z"] = 12,
                    },
                    ["transform"] = {
                        ["position"] = {
                            ["x"] = 0,
                            ["y"] = 7,
                            ["z"] = 31,
                        },
                        ["rotation"] = {
                            ["x"] = 0,
                            ["y"] = 0,
                            ["z"] = 0,
                        },
                    },
                },
                {
                    ["behavior"] = {
                        ["kind"] = "platform",
                    },
                    ["className"] = "WedgePart",
                    ["color"] = "#D946EF",
                    ["id"] = "WedgeClimb01",
                    ["material"] = "Metal",
                    ["order"] = 3,
                    ["physics"] = {
                        ["anchored"] = true,
                        ["canCollide"] = true,
                        ["canQuery"] = true,
                        ["canTouch"] = false,
                    },
                    ["role"] = "platform",
                    ["shape"] = "Wedge",
                    ["size"] = {
                        ["x"] = 12,
                        ["y"] = 4,
                        ["z"] = 10,
                    },
                    ["transform"] = {
                        ["position"] = {
                            ["x"] = 0,
                            ["y"] = 10,
                            ["z"] = 45,
                        },
                        ["rotation"] = {
                            ["x"] = 0,
                            ["y"] = 0,
                            ["z"] = 0,
                        },
                    },
                },
                {
                    ["behavior"] = {
                        ["damage"] = 100,
                        ["kind"] = "kill",
                    },
                    ["className"] = "Part",
                    ["color"] = "#EF4444",
                    ["id"] = "KillFloor",
                    ["material"] = "Neon",
                    ["order"] = 4,
                    ["physics"] = {
                        ["anchored"] = true,
                        ["canCollide"] = true,
                        ["canQuery"] = true,
                        ["canTouch"] = true,
                    },
                    ["role"] = "kill",
                    ["shape"] = "Block",
                    ["size"] = {
                        ["x"] = 44,
                        ["y"] = 1,
                        ["z"] = 76,
                    },
                    ["transform"] = {
                        ["position"] = {
                            ["x"] = 0,
                            ["y"] = -2,
                            ["z"] = 30,
                        },
                        ["rotation"] = {
                            ["x"] = 0,
                            ["y"] = 0,
                            ["z"] = 0,
                        },
                    },
                },
                {
                    ["behavior"] = {
                        ["kind"] = "finish",
                    },
                    ["className"] = "Part",
                    ["color"] = "#FACC15",
                    ["id"] = "FinishPlatform",
                    ["material"] = "SmoothPlastic",
                    ["order"] = 5,
                    ["physics"] = {
                        ["anchored"] = true,
                        ["canCollide"] = true,
                        ["canQuery"] = true,
                        ["canTouch"] = true,
                    },
                    ["role"] = "finish",
                    ["shape"] = "Block",
                    ["size"] = {
                        ["x"] = 16,
                        ["y"] = 2,
                        ["z"] = 16,
                    },
                    ["transform"] = {
                        ["position"] = {
                            ["x"] = 0,
                            ["y"] = 13,
                            ["z"] = 60,
                        },
                        ["rotation"] = {
                            ["x"] = 0,
                            ["y"] = 0,
                            ["z"] = 0,
                        },
                    },
                },
            },
        },
    },
    ["manifestHash"] = "sha256:492e0c1cefb32214d1e3f89a1935c277cc7b97f7508a355a4ec19c1fb4d4fd6a",
    ["sceneId"] = "brainrot-tower-vertical-slice-scene",
    ["schemaVersion"] = "0.2",
    ["seed"] = 424242,
    ["sourceSpecHash"] = "sha256:f928245e43c729e29537d9fb44a64be0629a3b0f0461d90d8b84f78b0a3735c0",
    ["sourceSpecId"] = "brainrot-tower-vertical-slice",
    ["worldBounds"] = {
        ["maximum"] = {
            ["x"] = 44.911844,
            ["y"] = 42.911844,
            ["z"] = 74.911844,
        },
        ["minimum"] = {
            ["x"] = -44.911844,
            ["y"] = -46.911844,
            ["z"] = -14.911844,
        },
    },
}

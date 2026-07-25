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
                    ["colorRole"] = "primary",
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
                    ["colorRole"] = "primary",
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
                    ["colorRole"] = "reward",
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
                            ["y"] = 90,
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
                    ["colorRole"] = "secondary",
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
                        ["killMode"] = "set-health-zero",
                        ["kind"] = "kill",
                    },
                    ["className"] = "Part",
                    ["color"] = "#EF4444",
                    ["colorRole"] = "hazard",
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
                    ["colorRole"] = "reward",
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
    ["manifestHash"] = "sha256:41d83751bd860ad5a35a20d6f48293b028a10af66140aa6cd43b7fecaef13d79",
    ["navigation"] = {
        ["characterPlacement"] = {
            ["strategy"] = "humanoid-root-part-cframe-v1",
            ["verticalOffset"] = 3,
        },
        ["coarseReachability"] = {
            ["avatarRig"] = "R15-default",
            ["jumpPower"] = 50,
            ["maxDownwardDrop"] = 20,
            ["maxHorizontalGap"] = 6,
            ["maxVerticalRise"] = 5,
            ["model"] = "axis-aligned-surfaces-v1",
            ["walkSpeed"] = 16,
        },
        ["routeEntries"] = {
            {
                ["objectId"] = "JumpPlatform01",
                ["routeOrder"] = 1,
                ["stageId"] = "tower-entry",
                ["stageRouteOrder"] = 1,
            },
            {
                ["objectId"] = "Checkpoint01",
                ["routeOrder"] = 2,
                ["stageId"] = "tower-entry",
                ["stageRouteOrder"] = 2,
            },
            {
                ["objectId"] = "WedgeClimb01",
                ["routeOrder"] = 3,
                ["stageId"] = "tower-entry",
                ["stageRouteOrder"] = 3,
            },
            {
                ["objectId"] = "FinishPlatform",
                ["routeOrder"] = 4,
                ["stageId"] = "tower-entry",
                ["stageRouteOrder"] = 4,
            },
        },
        ["safeRouteObjectIds"] = {
            "JumpPlatform01",
            "Checkpoint01",
            "WedgeClimb01",
            "FinishPlatform",
        },
        ["stages"] = {
            {
                ["id"] = "tower-entry",
                ["order"] = 1,
                ["safeRouteObjectIds"] = {
                    "JumpPlatform01",
                    "Checkpoint01",
                    "WedgeClimb01",
                    "FinishPlatform",
                },
            },
        },
    },
    ["sceneId"] = "brainrot-tower-vertical-slice-scene",
    ["schemaVersion"] = "0.2",
    ["seed"] = 424242,
    ["sourceSpecHash"] = "sha256:a822282776d2a83f3168b9c4a0c91e0b2bb370f5379df8d9f42cad2c79c2543d",
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

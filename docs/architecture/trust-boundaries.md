# Trust boundaries

Repository-controlled fixtures are still validated before compilation. The compiler output is
validated again before emission, and the Roblox runtime independently rejects incompatible
versions, unsupported shapes/materials, invalid ordering, unsafe physics, duplicate IDs, and
colliding decoration.

The Roblox builder creates all new instances in an unparented staging folder. Only after staging
succeeds does it clear the explicitly marked generated root. It refuses to touch an existing folder
without the expected ownership attribute.

Future natural-language descriptions, model responses, files, URLs, meshes, images, and worker
output are untrusted. No future external worker may execute arbitrary repository content or receive
broad credentials. Modly, Blender, Vertex AI, Roblox Open Cloud, analytics, image generation, and
external ML models are out of scope for Phase 0.

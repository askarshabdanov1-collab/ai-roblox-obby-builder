function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function isVector3(value, positive = false) {
  if (!isObject(value)) return false;
  for (const key of ["x", "y", "z"]) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) return false;
    if (positive && value[key] <= 0) return false;
  }
  return true;
}

export function validatePlaceSpec(input) {
  const errors = [];
  if (!isObject(input)) return { ok: false, errors: ["PlaceSpec must be an object"] };
  if (input.version !== "0.1") errors.push("version must equal 0.1");
  if (typeof input.name !== "string" || input.name.length < 1 || input.name.length > 80) errors.push("name must contain 1–80 characters");
  if (input.genre !== "obby") errors.push("genre must equal obby");
  if (!Number.isInteger(input.floors) || input.floors < 1 || input.floors > 100) errors.push("floors must be an integer from 1 to 100");

  const style = input.visualStyle;
  if (!isObject(style)) {
    errors.push("visualStyle must be an object");
  } else {
    if (typeof style.summary !== "string" || style.summary.length === 0) errors.push("visualStyle.summary is required");
    if (!Array.isArray(style.primaryColors) || style.primaryColors.length < 1 || style.primaryColors.length > 4 || !style.primaryColors.every(isHexColor)) errors.push("visualStyle.primaryColors must contain 1–4 hex colors");
    if (!isHexColor(style.rewardColor)) errors.push("visualStyle.rewardColor must be a hex color");
    if (typeof style.shapeLanguage !== "string" || style.shapeLanguage.length === 0) errors.push("visualStyle.shapeLanguage is required");
    if (!Array.isArray(style.materials) || style.materials.length < 1 || style.materials.length > 4 || !style.materials.every((item) => typeof item === "string")) errors.push("visualStyle.materials must contain 1–4 names");
  }

  const retention = input.retention;
  if (!isObject(retention)) {
    errors.push("retention must be an object");
  } else {
    if (!Number.isInteger(retention.targetSessionMinutes) || retention.targetSessionMinutes < 3 || retention.targetSessionMinutes > 120) errors.push("retention.targetSessionMinutes must be 3–120");
    if (!Number.isInteger(retention.firstRewardSeconds) || retention.firstRewardSeconds < 5 || retention.firstRewardSeconds > 120) errors.push("retention.firstRewardSeconds must be 5–120");
    if (!Number.isInteger(retention.checkpointIntervalSeconds) || retention.checkpointIntervalSeconds < 10 || retention.checkpointIntervalSeconds > 180) errors.push("retention.checkpointIntervalSeconds must be 10–180");
  }

  return { ok: errors.length === 0, errors };
}

export function validateSceneManifest(input) {
  const errors = [];
  if (!isObject(input)) return { ok: false, errors: ["SceneManifest must be an object"] };
  if (input.version !== "0.1") errors.push("version must equal 0.1");
  if (typeof input.sceneId !== "string" || !/^[a-z0-9-]+$/.test(input.sceneId)) errors.push("sceneId must use lowercase letters, numbers, and hyphens");
  if (!isObject(input.spawn) || !isVector3(input.spawn.position) || !isVector3(input.spawn.rotation)) errors.push("spawn must contain numeric position and rotation vectors");
  if (!Array.isArray(input.parts) || input.parts.length < 1 || input.parts.length > 2000) {
    errors.push("parts must contain 1–2000 entries");
  } else {
    const ids = new Set();
    const roles = new Set(["platform", "checkpoint", "kill", "decoration", "finish"]);
    const shapes = new Set(["Block", "Ball", "Cylinder", "Wedge"]);
    const materials = new Set(["SmoothPlastic", "Plastic", "Metal", "Neon", "Concrete", "Wood"]);

    input.parts.forEach((part, index) => {
      const prefix = `parts[${index}]`;
      if (!isObject(part)) {
        errors.push(`${prefix} must be an object`);
        return;
      }
      if (typeof part.id !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(part.id)) errors.push(`${prefix}.id is invalid`);
      if (ids.has(part.id)) errors.push(`${prefix}.id must be unique`);
      ids.add(part.id);
      if (!roles.has(part.role)) errors.push(`${prefix}.role is invalid`);
      if (!shapes.has(part.shape)) errors.push(`${prefix}.shape is invalid`);
      if (!isObject(part.transform) || !isVector3(part.transform.position) || !isVector3(part.transform.rotation)) errors.push(`${prefix}.transform is invalid`);
      if (!isVector3(part.size, true)) errors.push(`${prefix}.size must be positive`);
      if (!isHexColor(part.color)) errors.push(`${prefix}.color must be a hex color`);
      if (!materials.has(part.material)) errors.push(`${prefix}.material is invalid`);
      if (typeof part.collision !== "boolean") errors.push(`${prefix}.collision must be boolean`);
    });
  }
  return { ok: errors.length === 0, errors };
}

import { normalizeNumber } from "@obby/canonical-json";
import { DeterministicRandom } from "@obby/obby-generator";
import type {
  LayoutObject,
  MechanicLayoutDefinition,
  Vector3,
} from "@obby/obby-layout-contracts";

import type { HorizontalDirection } from "./packing.js";
import type { NativePartRecipeMetadata } from "./types.js";
import { LayoutEngineError } from "./types.js";

const mechanicIds = [
  "balance-beam",
  "checkpoint-recovery",
  "finish-approach",
  "hazard-avoidance",
  "height-changes",
  "narrow-platforms",
  "static-jumps",
  "stepping-stones",
  "turning-jumps",
] as const;

export const NATIVE_PART_RECIPE_REGISTRY = Object.freeze(
  Object.fromEntries(
    mechanicIds.map((mechanicId) => [
      mechanicId,
      Object.freeze({
        recipeId: `native-part-${mechanicId}-v2`,
        recipeVersion: "2.0.0",
        primitiveFamily: "native-parts",
        gameplayAuthority: "native-gameplay",
      } satisfies NativePartRecipeMetadata),
    ]),
  ) as Readonly<Record<string, NativePartRecipeMetadata>>,
);

export type RecipeObject = Pick<LayoutObject, "shape" | "size" | "transform">;

export type ExpandRecipeInput = {
  mechanicId: string;
  definition: MechanicLayoutDefinition;
  difficultyLevel: number;
  cell: Readonly<{ x: number; z: number }>;
  incoming: HorizontalDirection;
  outgoing: HorizontalDirection;
  cellWidth: number;
  cellDepth: number;
  baseCenterY: number;
  seed: number;
  precisionDecimalPlaces: number;
};

function parameter(
  definition: MechanicLayoutDefinition,
  difficultyLevel: number,
  parameterId: string,
): number {
  const profile = definition.difficultyProfiles.find(
    (candidate) => candidate.difficultyLevel === difficultyLevel,
  );
  const value = profile?.parameters.find(
    (candidate) => candidate.parameterId === parameterId,
  );
  if (value === undefined)
    throw new LayoutEngineError(
      "unsupported-mechanic",
      `${definition.mechanicLayoutDefinitionId} lacks ${parameterId} at difficulty ${difficultyLevel}`,
    );
  if (value.unit === "count" && !Number.isSafeInteger(value.value))
    throw new LayoutEngineError(
      "unsupported-mechanic",
      `${parameterId} must be a safe integer count`,
    );
  return value.value;
}

function rounded(value: number, precisionDecimalPlaces: number): number {
  return normalizeNumber(value, precisionDecimalPlaces);
}

function yawFor(
  direction: HorizontalDirection,
  precisionDecimalPlaces: number,
): number {
  return rounded(
    (Math.atan2(-direction.x, -direction.z) * 180) / Math.PI,
    precisionDecimalPlaces,
  );
}

function mix(
  left: number,
  right: number,
  ratio: number,
  precisionDecimalPlaces: number,
): number {
  return rounded(left + (right - left) * ratio, precisionDecimalPlaces);
}

function pointDirection(
  index: number,
  count: number,
  incoming: HorizontalDirection,
  outgoing: HorizontalDirection,
): HorizontalDirection {
  if (count === 1) return outgoing;
  return index < (count - 1) / 2 ? incoming : outgoing;
}

function routePoint(
  ratio: number,
  start: Readonly<{ x: number; z: number }>,
  center: Readonly<{ x: number; z: number }>,
  finish: Readonly<{ x: number; z: number }>,
  incoming: HorizontalDirection,
  outgoing: HorizontalDirection,
  precisionDecimalPlaces: number,
): Readonly<{ x: number; z: number }> {
  if (incoming.x === outgoing.x && incoming.z === outgoing.z)
    return {
      x: mix(start.x, finish.x, ratio, precisionDecimalPlaces),
      z: mix(start.z, finish.z, ratio, precisionDecimalPlaces),
    };
  if (ratio <= 0.5) {
    const legRatio = ratio * 2;
    return {
      x: mix(start.x, center.x, legRatio, precisionDecimalPlaces),
      z: mix(start.z, center.z, legRatio, precisionDecimalPlaces),
    };
  }
  const legRatio = (ratio - 0.5) * 2;
  return {
    x: mix(center.x, finish.x, legRatio, precisionDecimalPlaces),
    z: mix(center.z, finish.z, legRatio, precisionDecimalPlaces),
  };
}

export function expandNativePartRecipe(
  input: ExpandRecipeInput,
): readonly RecipeObject[] {
  const recipe = NATIVE_PART_RECIPE_REGISTRY[input.mechanicId];
  if (input.definition.definitionVersion !== recipe?.recipeVersion)
    throw new LayoutEngineError(
      "unsupported-mechanic",
      `${input.mechanicId} has no supported versioned native-Part recipe`,
    );
  const count = parameter(
    input.definition,
    input.difficultyLevel,
    "route-object-count",
  );
  if (
    !Number.isSafeInteger(count) ||
    count < input.definition.routeObjectBudget.minimum ||
    count > input.definition.routeObjectBudget.maximum
  )
    throw new LayoutEngineError(
      "unsupported-mechanic",
      `${input.mechanicId} route-object count violates its authority`,
    );
  const length = parameter(
    input.definition,
    input.difficultyLevel,
    "platform-length",
  );
  const width = parameter(
    input.definition,
    input.difficultyLevel,
    "platform-width",
  );
  const thickness = parameter(
    input.definition,
    input.difficultyLevel,
    "platform-thickness",
  );
  const lateral = parameter(
    input.definition,
    input.difficultyLevel,
    "lateral-amplitude",
  );
  const vertical = parameter(
    input.definition,
    input.difficultyLevel,
    "vertical-amplitude",
  );
  const yawStep = parameter(
    input.definition,
    input.difficultyLevel,
    "yaw-step-degrees",
  );
  const routeSpanFraction = parameter(
    input.definition,
    input.difficultyLevel,
    "route-span-fraction",
  );
  const random = new DeterministicRandom(input.seed);
  const mirror = random.integer(0, 1) === 0 ? -1 : 1;
  const entrySpan =
    Math.min(input.cellWidth, input.cellDepth) * routeSpanFraction;
  const start = {
    x: input.cell.x - input.incoming.x * entrySpan,
    z: input.cell.z - input.incoming.z * entrySpan,
  };
  const finish = {
    x: input.cell.x + input.outgoing.x * entrySpan,
    z: input.cell.z + input.outgoing.z * entrySpan,
  };
  const result: RecipeObject[] = [];
  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 0 : index / (count - 1);
    const direction = pointDirection(
      index,
      count,
      input.incoming,
      input.outgoing,
    );
    const perpendicular = { x: -direction.z, z: direction.x };
    const middleWeight = count === 1 ? 0 : 1 - Math.abs(2 * ratio - 1);
    const alternating = index % 2 === 0 ? -1 : 1;
    const lateralOffset =
      input.mechanicId === "turning-jumps" ||
      input.mechanicId === "stepping-stones" ||
      input.mechanicId === "hazard-avoidance"
        ? lateral * middleWeight * mirror * alternating
        : 0;
    const verticalOffset =
      input.mechanicId === "height-changes" ? vertical * middleWeight : 0;
    const routePosition = routePoint(
      ratio,
      start,
      input.cell,
      finish,
      input.incoming,
      input.outgoing,
      input.precisionDecimalPlaces,
    );
    const position: Vector3 = {
      x: rounded(
        routePosition.x + perpendicular.x * lateralOffset,
        input.precisionDecimalPlaces,
      ),
      y: rounded(
        input.baseCenterY + verticalOffset,
        input.precisionDecimalPlaces,
      ),
      z: rounded(
        routePosition.z + perpendicular.z * lateralOffset,
        input.precisionDecimalPlaces,
      ),
    };
    result.push({
      shape: "Block",
      size: {
        x: direction.x === 0 ? width : length,
        y: thickness,
        z: direction.z === 0 ? width : length,
      },
      transform: {
        position,
        rotationDegrees: {
          x: 0,
          y: rounded(
            yawFor(direction, input.precisionDecimalPlaces) +
              (input.mechanicId === "turning-jumps"
                ? yawStep * middleWeight * mirror
                : 0),
            input.precisionDecimalPlaces,
          ),
          z: 0,
        },
      },
    });
  }
  return Object.freeze(result);
}

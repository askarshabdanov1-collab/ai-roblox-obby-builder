import { normalizeNumber } from "@obby/canonical-json";

import { LayoutEngineError, type SerpentineCell } from "./types.js";

export type HorizontalDirection = Readonly<{ x: -1 | 0 | 1; z: -1 | 0 | 1 }>;

export function packSerpentineCell(
  index: number,
  columns: number,
  cellWidth: number,
  cellDepth: number,
  precisionDecimalPlaces: number,
): SerpentineCell {
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    !Number.isSafeInteger(columns) ||
    columns < 1 ||
    !Number.isFinite(cellWidth) ||
    cellWidth <= 0 ||
    !Number.isFinite(cellDepth) ||
    cellDepth <= 0 ||
    !Number.isSafeInteger(precisionDecimalPlaces) ||
    precisionDecimalPlaces < 0
  )
    throw new LayoutEngineError(
      "packing-limit",
      "serpentine packing requires a bounded index, column count, and positive cell dimensions",
    );
  const row = Math.floor(index / columns);
  const withinRow = index % columns;
  const column = row % 2 === 0 ? withinRow : columns - 1 - withinRow;
  return Object.freeze({
    index,
    row,
    column,
    x: normalizeNumber(column * cellWidth, precisionDecimalPlaces),
    z: normalizeNumber(row * cellDepth, precisionDecimalPlaces),
  });
}

export function directionBetween(
  source: Readonly<{ x: number; z: number }>,
  destination: Readonly<{ x: number; z: number }>,
): HorizontalDirection {
  const x = Math.sign(destination.x - source.x) as -1 | 0 | 1;
  const z = Math.sign(destination.z - source.z) as -1 | 0 | 1;
  if ((x === 0) === (z === 0))
    throw new LayoutEngineError(
      "packing-limit",
      "serpentine neighbors must differ on exactly one horizontal axis",
    );
  return Object.freeze({ x, z });
}

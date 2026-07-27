export type ChargeMarkdownWork = (units: number) => void;

export function markdownSortingWorkUnits(length: number): number {
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new RangeError(
      "Markdown sorting length must be a non-negative safe integer",
    );
  }
  const comparisonsPerItem = Math.ceil(Math.log2(Math.max(1, length)));
  if (
    comparisonsPerItem !== 0 &&
    length > Math.floor(Number.MAX_SAFE_INTEGER / comparisonsPerItem)
  ) {
    throw new RangeError(
      "Markdown sorting work exceeds the safe integer range",
    );
  }
  return length * comparisonsPerItem;
}

export function sortMarkdownCollection<T>(
  values: readonly T[],
  compare: (left: T, right: T) => number,
  charge: ChargeMarkdownWork,
): T[] {
  charge(markdownSortingWorkUnits(values.length));
  return [...values].toSorted(compare);
}

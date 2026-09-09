/**
 * Parses raw bounds data into a standardized bounds structure
 *
 * @param bounds - Raw bounds data in OCHRE format
 * @returns Parsed bounds object
 * @internal
 */
export function parseBounds(
  bounds: string,
): [[number, number], [number, number]] {
  const coordinates = bounds.trimStart().startsWith("[")
    ? parseJsonBounds(bounds)
    : bounds
        .split(";")
        .map((pair) =>
          pair.split(",").map((coordinate) => Number(coordinate.trim())),
        );
  const [southWest, northEast] = coordinates;
  if (
    southWest?.length !== 2 ||
    northEast?.length !== 2 ||
    southWest.some((coordinate) => Number.isNaN(coordinate)) ||
    northEast.some((coordinate) => Number.isNaN(coordinate))
  ) {
    throw new Error(`Invalid bounds: ${bounds}`, { cause: bounds });
  }

  return [
    [southWest[0]!, southWest[1]!],
    [northEast[0]!, northEast[1]!],
  ];
}

function parseJsonBounds(bounds: string): Array<Array<number>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bounds) as unknown;
  } catch {
    throw new Error(`Invalid bounds: ${bounds}`, { cause: bounds });
  }

  if (!isNumberPairArray(parsed)) {
    throw new Error(`Invalid bounds: ${bounds}`, { cause: bounds });
  }

  return parsed;
}

function isNumberPairArray(value: unknown): value is Array<Array<number>> {
  return (
    Array.isArray(value) &&
    value.every(
      (pair) =>
        Array.isArray(pair) &&
        pair.every((coordinate) => typeof coordinate === "number"),
    )
  );
}

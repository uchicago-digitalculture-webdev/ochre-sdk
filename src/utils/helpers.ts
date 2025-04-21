import type { DataCategory } from "../types/main.js";
import { categorySchema } from "../schemas.js";

/**
 * Get the category of an item from the OCHRE API response
 * @param keys - The keys of the OCHRE API response
 * @returns The category of the item
 * @internal
 */
export function getItemCategory(keys: ReadonlyArray<string>): DataCategory {
  const categoryFound = keys.find(
    (key) => categorySchema.safeParse(key).success,
  );
  if (!categoryFound) {
    const unknownKey = keys.find(
      (key) =>
        ![
          "uuid",
          "uuidBelongsTo",
          "belongsTo",
          "publicationDateTime",
          "metadata",
          "languages",
        ].includes(key),
    );

    throw new Error(`Invalid OCHRE data; found unexpected "${unknownKey}" key`);
  }

  const categoryKey = categorySchema.parse(categoryFound);

  return categoryKey;
}

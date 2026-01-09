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

/**
 * Get the categories of items from the OCHRE API response
 * @param keys - The keys of the OCHRE API response
 * @returns The categories of the items
 * @internal
 */
export function getItemCategories(
  keys: ReadonlyArray<string>,
): Array<DataCategory> {
  const categories = keys.map((key) => categorySchema.safeParse(key));
  if (categories.some((result) => !result.success)) {
    throw new Error(
      `Invalid OCHRE data; found unexpected keys: ${categories
        .filter((result) => !result.success)
        .map((result) => result.error.message)
        .join(", ")}`,
    );
  }

  return categories
    .filter((result) => result.success)
    .map((result) => result.data);
}

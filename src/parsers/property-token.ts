/**
 * The attributes a property value can carry its text in
 */
type PropertyValueTextSource = {
  rawValue?: string;
  payload?: string;
  slug?: string;
};

/**
 * The text a property value stands for
 *
 * OCHRE spreads that text over four places, so which one wins is real domain
 * knowledge and this is the only place it is written down. The content step is
 * injected because the two callers reach it differently: the item parser builds
 * a full multilingual string, while the rich-text parser needs one language's
 * plain text. Reading the sources in a different order is what let the two
 * disagree for a value carrying both a `slug` and `content`.
 * @param value - The raw property value
 * @param readContentText - Reads the value's `content` as plain text, or null when it has none
 * @returns The text, or an empty string when the value carries none
 * @internal
 */
export function readPropertyValueText(
  value: PropertyValueTextSource,
  readContentText: () => string | null,
): string {
  return (
    value.rawValue ?? value.payload ?? readContentText() ?? value.slug ?? ""
  );
}

/**
 * The UUID a property value points at, treating an empty attribute as absent
 * @param value - The raw property value
 * @returns The UUID, or null when there is none
 * @internal
 */
export function readPropertyValueUuid(
  value: { uuid?: string } | undefined,
): string | null {
  return value?.uuid == null || value.uuid === "" ? null : value.uuid;
}

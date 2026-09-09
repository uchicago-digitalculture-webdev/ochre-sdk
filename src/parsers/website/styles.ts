import type { SimplifiedProperty } from "#/types/index.js";
import type {
  ResponsiveStyles,
  Style,
  StylesheetItem,
} from "#/types/website.js";
import type { XMLWebsiteStyle } from "#/xml/types.js";
import { getProperty } from "#/getters.js";

const STYLESHEET_NON_STYLE_KEYS = new Set([
  "variableUuid",
  "valueUuid",
  "category",
  "payload",
  "content",
]);

/**
 * The CSS declarations a presentation variant carries
 *
 * @param properties - Array of properties to parse
 * @param cssVariant - CSS variant to parse
 * @returns Array of CSS styles
 */
function parseCssStylesFromProperties<T extends ReadonlyArray<string>>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  cssVariant?: string,
): Array<Style> {
  const cssProperties =
    getProperty(properties, {
      label: "presentation",
      valueContent: cssVariant != null ? `css-${cssVariant}` : "css",
    })?.properties ?? [];

  const styles: Array<Style> = [];
  for (const property of cssProperties) {
    const value = property.values[0]?.content.toString();
    if (value != null) {
      styles.push({ label: property.variable.label, value });
    }
  }

  return styles;
}

/**
 * The CSS declarations for every viewport a resource defines
 * @param properties - Array of properties to parse
 * @returns The styles per viewport
 * @internal
 */
export function parseResponsiveCssStyles<T extends ReadonlyArray<string>>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
): ResponsiveStyles {
  return {
    default: parseCssStylesFromProperties(properties),
    tablet: parseCssStylesFromProperties(properties, "tablet"),
    mobile: parseCssStylesFromProperties(properties, "mobile"),
  };
}

/**
 * An empty set of responsive styles, for resources that define none
 * @returns The empty styles
 * @internal
 */
export function emptyResponsiveStyles(): ResponsiveStyles {
  return { default: [], tablet: [], mobile: [] };
}

/**
 * The stylesheet a website attaches to a property variable or value
 *
 * OCHRE has no viewport dimension on stylesheet entries, so these only ever
 * carry default styles, unlike the per-element styles above.
 * @param styles - The raw stylesheet entries
 * @returns The parsed stylesheet items
 * @internal
 */
export function parseStylesheets(
  styles: Array<XMLWebsiteStyle>,
): Array<StylesheetItem> {
  const parsedStyles: Array<StylesheetItem> = [];

  for (const style of styles) {
    const defaultStyles: Array<Style> = [];

    for (const [label, value] of Object.entries(style)) {
      if (STYLESHEET_NON_STYLE_KEYS.has(label)) {
        continue;
      }

      const valueString = value?.toString();
      if (valueString != null) {
        defaultStyles.push({ label, value: valueString });
      }
    }

    const stylesByViewport: StylesheetItem["styles"] = {
      ...emptyResponsiveStyles(),
      default: defaultStyles,
    };

    if (style.category === "propertyValue" || style.valueUuid != null) {
      if (style.valueUuid == null) {
        throw new Error(
          `Stylesheet property value "${style.variableUuid}" is missing a value UUID`,
          { cause: style },
        );
      }

      parsedStyles.push({
        uuid: style.valueUuid,
        category: "propertyValue",
        variableUuid: style.variableUuid,
        icon: style.lucideIcon ?? null,
        styles: stylesByViewport,
      });
      continue;
    }

    parsedStyles.push({
      uuid: style.variableUuid,
      category: "propertyVariable",
      icon: style.lucideIcon ?? null,
      styles: stylesByViewport,
    });
  }

  return parsedStyles;
}

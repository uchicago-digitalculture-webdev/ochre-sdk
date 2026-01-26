import type {
  FakeString,
  OchrePropertyValueContent,
  OchreStringContent,
  OchreStringItem,
  OchreStringRichTextItem,
  OchreStringRichTextItemContent,
} from "../types/internal.raw.js";
import type { Style } from "../types/main.js";
import {
  PRESENTATION_ITEM_UUID,
  TEXT_ANNOTATION_ENTRY_PAGE_VARIANT_UUID,
  TEXT_ANNOTATION_HOVER_CARD_UUID,
  TEXT_ANNOTATION_ITEM_PAGE_VARIANT_UUID,
  TEXT_ANNOTATION_TEXT_STYLING_HEADING_LEVEL_UUID,
  TEXT_ANNOTATION_TEXT_STYLING_UUID,
  TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID,
  TEXT_ANNOTATION_UUID,
} from "../constants.js";
import {
  emailSchema,
  renderOptionsSchema,
  whitespaceSchema,
} from "../schemas.js";

/**
 * Finds a string item in an array by language code
 *
 * @param content - Array of string items to search
 * @param language - Language code to search for
 * @returns Matching string item or null if not found
 * @internal
 */
function getStringItemByLanguage(
  content: Array<OchreStringItem>,
  language: string,
): OchreStringItem | null {
  const stringItemToFind = content.find((item) => item.lang === language);
  return stringItemToFind ?? null;
}

/**
 * Parses email addresses in a string into HTML links
 *
 * @param string - Input string to parse
 * @returns String with emails converted to HTML links
 *
 * @example
 * ```ts
 * const parsed = parseEmail("Contact us at info@example.com");
 * // Returns: "Contact us at <ExternalLink href="mailto:info@example.com">info@example.com</ExternalLink>"
 * ```
 */
export function parseEmail(string: string): string {
  const splitString = string.split(" ");
  const returnSplitString: Array<string> = [];

  for (const string of splitString) {
    const cleanString = string
      .replaceAll(/(?<=\s|^)[([{]+|[)\]}]+(?=\s|$)/g, "")
      .replaceAll(/[!),:;?\]]/g, "")
      .replace(/\.$/, "");

    const index = string.indexOf(cleanString);

    const before = string.slice(0, index);
    const after = string.slice(index + cleanString.length);

    const isEmail = emailSchema.safeParse(cleanString).success;
    if (isEmail) {
      returnSplitString.push(
        `${before}<ExternalLink href="mailto:${cleanString}">${cleanString}</ExternalLink>${after}`,
      );
      continue;
    }

    returnSplitString.push(string);
  }

  return returnSplitString.join(" ");
}

/**
 * Applies text rendering options (bold, italic, underline) to a string
 *
 * @param contentString - The string content to render
 * @param renderString - Space-separated string of render options
 * @returns String with markdown formatting applied
 * @internal
 */
function parseRenderOptions(
  contentString: string,
  renderString: string,
): string {
  let returnString = contentString;

  const result = renderOptionsSchema.safeParse(renderString);
  if (!result.success) {
    console.warn(`Invalid render options string provided: “${renderString}”`);

    return contentString;
  }

  for (const option of result.data) {
    switch (option) {
      case "bold": {
        returnString = `**${returnString}**`;
        break;
      }
      case "italic": {
        returnString = `*${returnString}*`;
        break;
      }
      case "underline": {
        returnString = `_${returnString}_`;
        break;
      }
    }
  }

  return returnString.replaceAll("&#39;", "'");
}

/**
 * Applies whitespace options to a string (newline, trailing, leading)
 *
 * @param contentString - The string content to modify
 * @param whitespace - Space-separated string of whitespace options
 * @returns String with whitespace modifications applied
 * @internal
 */
function parseWhitespace(contentString: string, whitespace: string): string {
  let returnString = contentString;

  const result = whitespaceSchema.safeParse(whitespace);
  if (!result.success) {
    console.warn(`Invalid whitespace string provided: “${whitespace}”`);

    return contentString;
  }

  for (const option of result.data) {
    switch (option) {
      case "newline": {
        if (returnString.trim() === "***") {
          returnString = `${returnString}\n`;
        } else {
          returnString = `<br />\n${returnString}`;
        }
        break;
      }
      case "trailing": {
        returnString = `${returnString} `;
        break;
      }
      case "leading": {
        returnString = ` ${returnString}`;
        break;
      }
    }
  }

  return returnString.replaceAll("&#39;", "'");
}

/**
 * Converts a FakeString (string|number|boolean) to a proper string
 *
 * @param string - FakeString value to convert
 * @returns Converted string value
 *
 * @example
 * ```ts
 * parseFakeString(true); // Returns "Yes"
 * parseFakeString(123); // Returns "123"
 * parseFakeString("test"); // Returns "test"
 * ```
 */
export function parseFakeString(string: FakeString): string {
  return String(string)
    .replaceAll("&#39;", "'")
    .replaceAll("{", String.raw`\{`)
    .replaceAll("}", String.raw`\}`);
}

/**
 * Result type for parseRichTextItemString containing styled content and optional whitespace
 * @internal
 */
type RichTextItemStringResult = { content: string; whitespace: string | null };

/**
 * Parses a rich text item's string field, applying rend styling and preserving whitespace
 *
 * @param stringField - The string field from a rich text item (FakeString or OchreStringRichTextItemContent)
 * @returns Object containing styled content and optional whitespace to apply after MDX wrapping
 * @internal
 */
function parseRichTextItemString(
  stringField: FakeString | OchreStringRichTextItemContent | undefined,
): RichTextItemStringResult {
  if (stringField == null) {
    return { content: "", whitespace: null };
  }

  if (
    typeof stringField === "string" ||
    typeof stringField === "number" ||
    typeof stringField === "boolean"
  ) {
    return {
      content: parseFakeString(stringField)
        .replaceAll("<", String.raw`\<`)
        .replaceAll("{", String.raw`\{`),
      whitespace: null,
    };
  }

  let content = parseFakeString(stringField.content)
    .replaceAll("<", String.raw`\<`)
    .replaceAll("{", String.raw`\{`);

  if (stringField.rend != null) {
    content = parseRenderOptions(content, stringField.rend);
  }

  return { content, whitespace: stringField.whitespace ?? null };
}

/**
 * Applies whitespace to a result string if whitespace is provided
 *
 * @param result - The string to apply whitespace to
 * @param whitespace - Optional whitespace string to apply
 * @returns String with whitespace applied, or original string if no whitespace
 * @internal
 */
function applyWhitespaceToResult(
  result: string,
  whitespace: string | null,
): string {
  if (whitespace != null) {
    return parseWhitespace(result, whitespace);
  }
  return result;
}

/**
 * Metadata extracted from text annotation properties
 * @internal
 */
type AnnotationMetadata = {
  linkVariant: "hover-card" | "item-page" | "entry-page" | null;
  textStyling: {
    variant: string;
    size: string;
    headingLevel: string | null;
    cssStyles: Array<Style>;
  } | null;
};

/**
 * Extracts annotation metadata from item properties (link variants and text styling)
 *
 * @param item - Rich text item that may contain properties
 * @returns Annotation metadata including link variant and text styling info
 * @internal
 */
function extractAnnotationMetadata(
  item: OchreStringRichTextItem,
): AnnotationMetadata {
  const result: AnnotationMetadata = { linkVariant: null, textStyling: null };

  if (
    typeof item === "string" ||
    typeof item === "number" ||
    typeof item === "boolean"
  ) {
    return result;
  }

  if (!("properties" in item) || item.properties == null) {
    return result;
  }

  const itemProperty =
    Array.isArray(item.properties.property) ?
      item.properties.property[0]
    : item.properties.property;

  if (itemProperty == null) {
    return result;
  }

  const itemPropertyLabelUuid = itemProperty.label.uuid;
  const itemPropertyValueUuid =
    (
      typeof itemProperty.value === "object" &&
      "uuid" in itemProperty.value &&
      itemProperty.value.uuid != null
    ) ?
      itemProperty.value.uuid
    : null;

  if (
    itemPropertyLabelUuid !== PRESENTATION_ITEM_UUID ||
    itemPropertyValueUuid !== TEXT_ANNOTATION_UUID
  ) {
    return result;
  }

  const textAnnotationProperties =
    itemProperty.property != null ?
      Array.isArray(itemProperty.property) ?
        itemProperty.property
      : [itemProperty.property]
    : [];

  for (const textAnnotationProperty of textAnnotationProperties) {
    const textAnnotationPropertyValueUuid =
      (
        typeof textAnnotationProperty.value === "object" &&
        "uuid" in textAnnotationProperty.value &&
        textAnnotationProperty.value.uuid != null
      ) ?
        textAnnotationProperty.value.uuid
      : null;

    switch (textAnnotationPropertyValueUuid) {
      case TEXT_ANNOTATION_HOVER_CARD_UUID: {
        result.linkVariant = "hover-card";

        break;
      }
      case TEXT_ANNOTATION_ITEM_PAGE_VARIANT_UUID: {
        result.linkVariant = "item-page";

        break;
      }
      case TEXT_ANNOTATION_ENTRY_PAGE_VARIANT_UUID: {
        result.linkVariant = "entry-page";

        break;
      }
      default: {
        if (
          textAnnotationPropertyValueUuid ===
            TEXT_ANNOTATION_TEXT_STYLING_UUID &&
          textAnnotationProperty.property != null
        ) {
          let textStylingVariant = "block";
          let textStylingSize = "md";
          let textStylingHeadingLevel: string | null = null;
          let textStylingCss: Array<Style> = [];

          const textStylingProperties =
            Array.isArray(textAnnotationProperty.property) ?
              textAnnotationProperty.property
            : [textAnnotationProperty.property];

          const textStylingVariantProperty = textStylingProperties.find(
            (property) =>
              property.label.uuid === TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID,
          );

          if (textStylingVariantProperty != null) {
            const textStylingPropertyVariant = parseFakeString(
              (textStylingVariantProperty.value as OchrePropertyValueContent)
                .content as FakeString,
            );

            const textStylingNestedProperties =
              textStylingVariantProperty.property != null ?
                Array.isArray(textStylingVariantProperty.property) ?
                  textStylingVariantProperty.property
                : [textStylingVariantProperty.property]
              : [];

            const textStylingSizeProperty = textStylingNestedProperties.find(
              (prop) => {
                const label = parseFakeString(prop.label.content as FakeString);
                return label === "size";
              },
            );

            if (textStylingSizeProperty != null) {
              const textStylingSizePropertyValue = parseFakeString(
                (textStylingSizeProperty.value as OchrePropertyValueContent)
                  .content as FakeString,
              );
              textStylingSize = textStylingSizePropertyValue;
            }

            textStylingVariant = textStylingPropertyVariant;
          }

          const textStylingHeadingLevelProperty = textStylingProperties.find(
            (property) =>
              property.label.uuid ===
              TEXT_ANNOTATION_TEXT_STYLING_HEADING_LEVEL_UUID,
          );

          if (textStylingHeadingLevelProperty != null) {
            textStylingHeadingLevel = parseFakeString(
              (
                textStylingHeadingLevelProperty.value as OchrePropertyValueContent
              ).content as FakeString,
            );
          }

          const textStylingCssProperties = textStylingProperties.filter(
            (property) =>
              property.label.uuid !==
                TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID &&
              property.label.uuid !==
                TEXT_ANNOTATION_TEXT_STYLING_HEADING_LEVEL_UUID,
          );

          if (textStylingCssProperties.length > 0) {
            textStylingCss = textStylingCssProperties.map((property) => ({
              label: parseFakeString(property.label.content as FakeString),
              value: parseFakeString(
                (property.value as OchrePropertyValueContent)
                  .content as FakeString,
              ),
            }));
          }

          result.textStyling = {
            variant: textStylingVariant,
            size: textStylingSize,
            headingLevel: textStylingHeadingLevel,
            cssStyles: textStylingCss,
          };
        }
      }
    }
  }

  return result;
}

/**
 * Wraps content with text styling annotation if provided
 *
 * @param content - The content to wrap
 * @param textStyling - Text styling metadata or null
 * @returns Content wrapped with Annotation element if styling exists, or original content
 * @internal
 */
function wrapWithTextStyling(
  content: string,
  textStyling: AnnotationMetadata["textStyling"],
): string {
  if (textStyling == null) {
    return content;
  }

  return `<Annotation type="text-styling" variant="${textStyling.variant}" size="${textStyling.size}"${
    textStyling.headingLevel != null ?
      ` headingLevel="${textStyling.headingLevel}"`
    : ""
  }${
    textStyling.cssStyles.length > 0 ?
      ` cssStyles={{default: ${JSON.stringify(textStyling.cssStyles)}, tablet: [], mobile: []}}`
    : ""
  }>${content}</Annotation>`;
}

/**
 * Parses an OchreStringItem into a formatted string
 *
 * @param item - OchreStringItem to parse
 * @returns Formatted string with applied rendering and whitespace
 */
export function parseStringItem(item: OchreStringItem): string {
  let returnString = "";

  switch (typeof item.string) {
    case "string":
    case "number":
    case "boolean": {
      returnString = parseFakeString(item.string);
      break;
    }
    case "object": {
      const stringItems =
        Array.isArray(item.string) ? item.string : [item.string];

      for (const stringItem of stringItems) {
        if (
          typeof stringItem === "string" ||
          typeof stringItem === "number" ||
          typeof stringItem === "boolean"
        ) {
          returnString += parseFakeString(stringItem);
        } else {
          if ("string" in stringItem) {
            returnString += parseStringDocumentItem(
              stringItem as OchreStringRichTextItem,
            );
          } else {
            const renderedText =
              stringItem.content == null ? ""
              : stringItem.rend != null ?
                parseRenderOptions(
                  parseFakeString(stringItem.content),
                  stringItem.rend,
                )
              : parseFakeString(stringItem.content);

            const whitespacedText =
              stringItem.whitespace != null ?
                parseWhitespace(renderedText, stringItem.whitespace)
              : renderedText;

            returnString += whitespacedText;
          }
        }
      }
      break;
    }
    default: {
      returnString = "";
      break;
    }
  }

  return returnString;
}

/**
 * Parses rich text content into a formatted string with links and annotations
 *
 * @param item - Rich text item to parse
 * @returns Formatted string with HTML/markdown elements
 */
export function parseStringDocumentItem(item: OchreStringRichTextItem): string {
  if (
    typeof item === "string" ||
    typeof item === "number" ||
    typeof item === "boolean"
  ) {
    return parseEmail(parseFakeString(item));
  }

  if ("whitespace" in item && !("content" in item) && !("string" in item)) {
    if (item.whitespace === "newline") {
      // newline in markdown
      return "  \n";
    } else {
      const result = parseWhitespace("", item.whitespace);

      return result;
    }
  }

  if ("links" in item) {
    const { content: itemString, whitespace: itemWhitespace } =
      parseRichTextItemString(item.string);

    const itemLinks = Array.isArray(item.links) ? item.links : [item.links];

    for (const link of itemLinks) {
      if ("resource" in link) {
        const linkResource =
          Array.isArray(link.resource) ? link.resource[0]! : link.resource;

        let linkContent: string | null = null;
        if (linkResource.content != null) {
          linkContent = parseFakeString(linkResource.content)
            .replaceAll("<", String.raw`\<`)
            .replaceAll("{", String.raw`\{`);
        }

        switch (linkResource.type) {
          case "IIIF":
          case "image": {
            if (linkResource.rend === "inline") {
              return applyWhitespaceToResult(
                `<InlineImage uuid="${linkResource.uuid}" ${
                  linkContent !== null ? `content="${linkContent}"` : ""
                } height={${linkResource.height?.toString() ?? "null"}} width={${linkResource.width?.toString() ?? "null"}} />`,
                itemWhitespace,
              );
            } else if (linkResource.publicationDateTime != null) {
              const annotationMetadata = extractAnnotationMetadata(item);

              const innerContent = wrapWithTextStyling(
                itemString,
                annotationMetadata.textStyling,
              );

              let linkElement: string;

              switch (annotationMetadata.linkVariant) {
                case "hover-card": {
                  linkElement = `<Annotation type="hover-card" uuid="${linkResource.uuid}">${innerContent}</Annotation>`;

                  break;
                }
                case "item-page": {
                  linkElement = `<InternalLink type="item" uuid="${linkResource.uuid}">${innerContent}</InternalLink>`;

                  break;
                }
                case "entry-page": {
                  linkElement = `<InternalLink type="entry" uuid="${linkResource.uuid}">${innerContent}</InternalLink>`;

                  break;
                }
                default: {
                  linkElement = `<InternalLink uuid="${linkResource.uuid}">${innerContent}</InternalLink>`;
                }
              }

              return applyWhitespaceToResult(linkElement, itemWhitespace);
            } else {
              return applyWhitespaceToResult(
                `<TooltipSpan${
                  linkContent !== null ? ` content="${linkContent}"` : ""
                }>${itemString}</TooltipSpan>`,
                itemWhitespace,
              );
            }
          }
          case "internalDocument": {
            const annotationMetadata = extractAnnotationMetadata(item);

            const innerContent = wrapWithTextStyling(
              itemString,
              annotationMetadata.textStyling,
            );

            let linkElement: string;

            switch (annotationMetadata.linkVariant) {
              case "hover-card": {
                linkElement = `<Annotation type="hover-card" uuid="${linkResource.uuid}">${innerContent}</Annotation>`;

                break;
              }
              case "item-page": {
                linkElement = `<InternalLink type="item" uuid="${linkResource.uuid}">${innerContent}</InternalLink>`;

                break;
              }
              case "entry-page": {
                linkElement = `<InternalLink type="entry" uuid="${linkResource.uuid}">${innerContent}</InternalLink>`;

                break;
              }
              default: {
                if ("properties" in item && item.properties != null) {
                  const itemProperty =
                    Array.isArray(item.properties.property) ?
                      item.properties.property[0]
                    : item.properties.property;
                  if (itemProperty != null) {
                    const itemPropertyLabelUuid = itemProperty.label.uuid;
                    const itemPropertyValueUuid =
                      (
                        typeof itemProperty.value === "object" &&
                        "uuid" in itemProperty.value &&
                        itemProperty.value.uuid != null
                      ) ?
                        itemProperty.value.uuid
                      : null;
                    linkElement = `<InternalLink uuid="${linkResource.uuid}" properties="${itemPropertyLabelUuid}"${
                      itemPropertyValueUuid !== null ?
                        ` value="${itemPropertyValueUuid}"`
                      : ""
                    }>${innerContent}</InternalLink>`;
                  } else {
                    linkElement = `<InternalLink uuid="${linkResource.uuid}">${innerContent}</InternalLink>`;
                  }
                } else {
                  linkElement = `<InternalLink uuid="${linkResource.uuid}">${innerContent}</InternalLink>`;
                }
              }
            }

            return applyWhitespaceToResult(linkElement, itemWhitespace);
          }
          case "externalDocument": {
            if (linkResource.publicationDateTime != null) {
              return applyWhitespaceToResult(
                String.raw`<ExternalLink href="https:\/\/ochre.lib.uchicago.edu/ochre?uuid=${linkResource.uuid}&load" ${
                  linkContent !== null ? `content="${linkContent}"` : ""
                }>${itemString}</ExternalLink>`,
                itemWhitespace,
              );
            } else {
              return applyWhitespaceToResult(
                `<TooltipSpan${
                  linkContent !== null ? ` content="${linkContent}"` : ""
                }>${itemString}</TooltipSpan>`,
                itemWhitespace,
              );
            }
          }
          case "webpage": {
            return applyWhitespaceToResult(
              `<ExternalLink href="${linkResource.href}" ${
                linkContent !== null ? `content="${linkContent}"` : ""
              }>${itemString}</ExternalLink>`,
              itemWhitespace,
            );
          }
          default: {
            return "";
          }
        }
      } else if ("spatialUnit" in link) {
        const linkSpatialUnit =
          Array.isArray(link.spatialUnit) ?
            link.spatialUnit[0]!
          : link.spatialUnit;

        if (linkSpatialUnit.publicationDateTime != null) {
          return applyWhitespaceToResult(
            `<InternalLink uuid="${linkSpatialUnit.uuid}">${itemString}</InternalLink>`,
            itemWhitespace,
          );
        } else {
          return applyWhitespaceToResult(
            `<TooltipSpan>${itemString}</TooltipSpan>`,
            itemWhitespace,
          );
        }
      } else if ("concept" in link) {
        const linkConcept =
          Array.isArray(link.concept) ? link.concept[0]! : link.concept;

        if (linkConcept.publicationDateTime != null) {
          return applyWhitespaceToResult(
            `<InternalLink uuid="${linkConcept.uuid}">${itemString}</InternalLink>`,
            itemWhitespace,
          );
        } else {
          return applyWhitespaceToResult(
            `<TooltipSpan>${itemString}</TooltipSpan>`,
            itemWhitespace,
          );
        }
      } else if ("set" in link) {
        const linkSet = Array.isArray(link.set) ? link.set[0]! : link.set;

        if (linkSet.publicationDateTime != null) {
          return applyWhitespaceToResult(
            `<InternalLink uuid="${linkSet.uuid}">${itemString}</InternalLink>`,
            itemWhitespace,
          );
        } else {
          return applyWhitespaceToResult(
            `<TooltipSpan>${itemString}</TooltipSpan>`,
            itemWhitespace,
          );
        }
      } else if ("person" in link) {
        const linkPerson =
          Array.isArray(link.person) ? link.person[0]! : link.person;

        const linkContent =
          linkPerson.identification ?
            (
              ["string", "number", "boolean"].includes(
                typeof linkPerson.identification.label,
              )
            ) ?
              parseFakeString(linkPerson.identification.label as FakeString)
            : parseStringContent(
                linkPerson.identification.label as OchreStringContent,
              )
          : null;

        if (linkPerson.publicationDateTime != null) {
          return applyWhitespaceToResult(
            `<InternalLink uuid="${linkPerson.uuid}">${itemString}</InternalLink>`,
            itemWhitespace,
          );
        } else {
          return applyWhitespaceToResult(
            `<TooltipSpan${
              linkContent !== null ? ` content="${linkContent}"` : ""
            }>${itemString}</TooltipSpan>`,
            itemWhitespace,
          );
        }
      } else if ("bibliography" in link) {
        const linkBibliography =
          Array.isArray(link.bibliography) ?
            link.bibliography[0]!
          : link.bibliography;

        if (linkBibliography.publicationDateTime != null) {
          return applyWhitespaceToResult(
            `<InternalLink uuid="${linkBibliography.uuid}">${itemString}</InternalLink>`,
            itemWhitespace,
          );
        } else {
          return applyWhitespaceToResult(
            `<TooltipSpan>${itemString}</TooltipSpan>`,
            itemWhitespace,
          );
        }
      }
    }
  }

  if ("properties" in item && item.properties != null) {
    const { content: itemString, whitespace: itemWhitespace } =
      parseRichTextItemString(item.string);

    const itemProperty =
      Array.isArray(item.properties.property) ?
        item.properties.property[0]
      : item.properties.property;
    if (itemProperty != null) {
      const itemPropertyLabelUuid = itemProperty.label.uuid;
      const itemPropertyValueUuid =
        (
          typeof itemProperty.value === "object" &&
          "uuid" in itemProperty.value &&
          itemProperty.value.uuid != null
        ) ?
          itemProperty.value.uuid
        : null;
      if (
        itemPropertyLabelUuid === PRESENTATION_ITEM_UUID &&
        itemPropertyValueUuid === TEXT_ANNOTATION_UUID
      ) {
        const textAnnotationProperty =
          itemProperty.property != null ?
            Array.isArray(itemProperty.property) ?
              itemProperty.property[0]
            : itemProperty.property
          : null;
        if (textAnnotationProperty != null) {
          const textAnnotationPropertyValueUuid =
            (
              typeof textAnnotationProperty.value === "object" &&
              "uuid" in textAnnotationProperty.value &&
              textAnnotationProperty.value.uuid != null
            ) ?
              textAnnotationProperty.value.uuid
            : null;

          if (
            textAnnotationPropertyValueUuid ===
              TEXT_ANNOTATION_TEXT_STYLING_UUID &&
            textAnnotationProperty.property != null
          ) {
            const textStylingType = "text-styling";
            let textStylingVariant = "block";
            let textStylingSize = "md";
            let textStylingHeadingLevel: string | null = null;
            let textStylingCss: Array<Style> = [];

            const textStylingProperties =
              Array.isArray(textAnnotationProperty.property) ?
                textAnnotationProperty.property
              : [textAnnotationProperty.property];

            if (textStylingProperties.length > 0) {
              const textStylingVariantProperty = textStylingProperties.find(
                (property) =>
                  property.label.uuid ===
                  TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID,
              );
              if (textStylingVariantProperty != null) {
                const textStylingPropertyVariant = parseFakeString(
                  (
                    textStylingVariantProperty.value as OchrePropertyValueContent
                  ).content as FakeString,
                );

                const textStylingSizeProperty =
                  textStylingVariantProperty.property != null ?
                    Array.isArray(textStylingVariantProperty.property) ?
                      textStylingVariantProperty.property[0]!
                    : textStylingVariantProperty.property
                  : null;

                if (textStylingSizeProperty != null) {
                  const textStylingSizePropertyValue = parseFakeString(
                    (textStylingSizeProperty.value as OchrePropertyValueContent)
                      .content as FakeString,
                  );
                  textStylingSize = textStylingSizePropertyValue;
                }

                textStylingVariant = textStylingPropertyVariant;
              }

              const textStylingHeadingLevelProperty =
                textStylingProperties.find(
                  (property) =>
                    property.label.uuid ===
                    TEXT_ANNOTATION_TEXT_STYLING_HEADING_LEVEL_UUID,
                );
              if (textStylingHeadingLevelProperty != null) {
                textStylingHeadingLevel = parseFakeString(
                  (
                    textStylingHeadingLevelProperty.value as OchrePropertyValueContent
                  ).content as FakeString,
                );
              }

              const textStylingCssProperties = textStylingProperties.filter(
                (property) =>
                  property.label.uuid !==
                    TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID &&
                  property.label.uuid !==
                    TEXT_ANNOTATION_TEXT_STYLING_HEADING_LEVEL_UUID,
              );
              if (textStylingCssProperties.length > 0) {
                textStylingCss = textStylingCssProperties.map((property) => ({
                  label: parseFakeString(property.label.content as FakeString),
                  value: parseFakeString(
                    (property.value as OchrePropertyValueContent)
                      .content as FakeString,
                  ),
                }));
              }
            }

            return applyWhitespaceToResult(
              `<Annotation type="${textStylingType}" variant="${textStylingVariant}" size="${textStylingSize}"${
                textStylingHeadingLevel != null ?
                  ` headingLevel="${textStylingHeadingLevel}"`
                : ""
              }${
                textStylingCss.length > 0 ?
                  ` cssStyles={{default: ${JSON.stringify(textStylingCss)}, tablet: [], mobile: []}}`
                : ""
              }>${itemString}</Annotation>`,
              itemWhitespace,
            );
          }
        }
      }
    }
  }

  let returnString = "";

  if ("string" in item) {
    const stringItems =
      Array.isArray(item.string) ? item.string : [item.string];

    for (const stringItem of stringItems) {
      returnString += parseStringDocumentItem(stringItem);
    }

    if ("whitespace" in item && item.whitespace != null) {
      returnString = parseWhitespace(parseEmail(returnString), item.whitespace);
    }

    return returnString.replaceAll("&#39;", "'");
  } else {
    returnString = parseFakeString(item.content);

    if (item.rend != null) {
      returnString = parseRenderOptions(parseEmail(returnString), item.rend);
    }

    if (item.whitespace != null) {
      returnString = parseWhitespace(parseEmail(returnString), item.whitespace);
    }
  }

  return returnString;
}

/**
 * Parses raw string content into a formatted string
 *
 * @param content - Raw string content to parse
 * @param language - Optional language code for content selection (defaults to "eng")
 * @returns Parsed and formatted string
 */
export function parseStringContent(
  content: OchreStringContent,
  language = "eng",
): string {
  switch (typeof content.content) {
    case "string":
    case "number":
    case "boolean": {
      if (content.rend != null) {
        return parseRenderOptions(
          parseFakeString(content.content),
          content.rend,
        );
      }

      return parseFakeString(content.content);
    }
    case "object": {
      if (Array.isArray(content.content)) {
        const stringItem = getStringItemByLanguage(content.content, language);

        if (stringItem) {
          return parseStringItem(stringItem);
        } else {
          const returnStringItem = content.content[0];
          if (!returnStringItem) {
            throw new Error(
              `No string item found for language “${language}” in the following content:\n${JSON.stringify(
                content.content,
              )}.`,
            );
          }

          return parseStringItem(returnStringItem);
        }
      } else {
        return parseStringItem(content.content);
      }
    }
    default: {
      return String(content.content);
    }
  }
}

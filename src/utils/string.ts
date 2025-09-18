import type {
  FakeString,
  OchrePropertyValueContent,
  OchreStringContent,
  OchreStringItem,
  OchreStringRichTextItem,
} from "../types/internal.raw.js";
import type { Style } from "../types/main.js";
import {
  emailSchema,
  renderOptionsSchema,
  whitespaceSchema,
} from "../schemas.js";

const PRESENTATION_ITEM_UUID = "f1c131b6-1498-48a4-95bf-a9edae9fd518";
const TEXT_ANNOTATION_UUID = "b9ca2732-78f4-416e-b77f-dae7647e68a9";
const TEXT_ANNOTATION_TEXT_STYLING_UUID =
  "3e6f86ab-df81-45ae-8257-e2867357df56";
const TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID =
  "e1647bef-d801-4100-bdde-d081c422f763";

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
      .replace(/[!),.:;?\]]$/, "");

    const index = string.indexOf(cleanString);

    const before = string.slice(0, index);
    const after = string.slice(index + cleanString.length);

    const isEmail = emailSchema.safeParse(cleanString).success;
    if (isEmail) {
      returnSplitString.push(
        before,
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
        returnString = `<br />\n${returnString}`;
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

            // if (stringItem.whitespace === "leading trailing") {
            //   console.log(whitespacedText);
            // }
            console.log(stringItem.whitespace);

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
    let itemString = "";
    if (typeof item.string === "object") {
      itemString = parseStringContent(item.string);
    } else {
      itemString = parseFakeString(item.string)
        .replaceAll("<", String.raw`\<`)
        .replaceAll("{", String.raw`\{`);
    }

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
          case "image": {
            if (linkResource.rend === "inline") {
              return `<InlineImage uuid="${linkResource.uuid}" ${
                linkContent !== null ? `content="${linkContent}"` : ""
              } height={${linkResource.height?.toString() ?? "null"}} width={${linkResource.width?.toString() ?? "null"}} />`;
            } else if (linkResource.publicationDateTime != null) {
              return `<InternalLink uuid="${linkResource.uuid}">${itemString}</InternalLink>`;
            } else {
              return `<TooltipSpan${
                linkContent !== null ? ` content="${linkContent}"` : ""
              }>${itemString}</TooltipSpan>`;
            }
          }
          case "internalDocument": {
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
                    return `<Annotation type="hover-card" uuid="${linkResource.uuid}">${itemString}</Annotation>`;
                  }
                }

                return `<InternalLink uuid="${linkResource.uuid}" properties="${itemPropertyLabelUuid}"${
                  itemPropertyValueUuid !== null ?
                    ` value="${itemPropertyValueUuid}"`
                  : ""
                }>${itemString}</InternalLink>`;
              } else {
                return `<InternalLink uuid="${linkResource.uuid}">${itemString}</InternalLink>`;
              }
            } else {
              return `<InternalLink uuid="${linkResource.uuid}">${itemString}</InternalLink>`;
            }
          }
          case "externalDocument": {
            if (linkResource.publicationDateTime != null) {
              return `<ExternalLink href="https:\\/\\/ochre.lib.uchicago.edu/ochre?uuid=${linkResource.uuid}&load" ${
                linkContent !== null ? `content="${linkContent}"` : ""
              }>${itemString}</ExternalLink>`;
            } else {
              return `<TooltipSpan${
                linkContent !== null ? ` content="${linkContent}"` : ""
              }>${itemString}</TooltipSpan>`;
            }
          }
          case "webpage": {
            return `<ExternalLink href="${linkResource.href}" ${
              linkContent !== null ? `content="${linkContent}"` : ""
            }>${itemString}</ExternalLink>`;
          }
          default: {
            return "";
          }
        }
      } else if ("concept" in link) {
        const linkConcept =
          Array.isArray(link.concept) ? link.concept[0]! : link.concept;

        if (linkConcept.publicationDateTime != null) {
          return `<InternalLink uuid="${linkConcept.uuid}">${itemString}</InternalLink>`;
        } else {
          return `<TooltipSpan>${itemString}</TooltipSpan>`;
        }
      } else if ("set" in link) {
        const linkSet = Array.isArray(link.set) ? link.set[0]! : link.set;

        if (linkSet.publicationDateTime != null) {
          return `<InternalLink uuid="${linkSet.uuid}">${itemString}</InternalLink>`;
        } else {
          return `<TooltipSpan>${itemString}</TooltipSpan>`;
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
          return `<InternalLink uuid="${linkPerson.uuid}">${itemString}</InternalLink>`;
        } else {
          return `<TooltipSpan${
            linkContent !== null ? ` content="${linkContent}"` : ""
          }>${itemString}</TooltipSpan>`;
        }
      } else if ("bibliography" in link) {
        const linkBibliography =
          Array.isArray(link.bibliography) ?
            link.bibliography[0]!
          : link.bibliography;

        if (linkBibliography.publicationDateTime != null) {
          return `<InternalLink uuid="${linkBibliography.uuid}">${itemString}</InternalLink>`;
        } else {
          return `<TooltipSpan>${itemString}</TooltipSpan>`;
        }
      } else {
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
                  let textStylingVariant = "default";
                  let textStylingSize = "md";
                  let textStylingCss: Array<Style> = [];

                  const textStylingProperties =
                    Array.isArray(textAnnotationProperty.property) ?
                      textAnnotationProperty.property
                    : [textAnnotationProperty.property];

                  if (textStylingProperties.length > 0) {
                    const textStylingVariantProperty =
                      textStylingProperties.find(
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
                          (
                            textStylingSizeProperty.value as OchrePropertyValueContent
                          ).content as FakeString,
                        );
                        textStylingSize = textStylingSizePropertyValue;
                      }

                      textStylingVariant = textStylingPropertyVariant;
                    }

                    const textStylingCssProperties =
                      textStylingProperties.filter(
                        (property) =>
                          property.label.uuid !==
                          TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID,
                      );
                    if (textStylingCssProperties.length > 0) {
                      textStylingCss = textStylingCssProperties.map(
                        (property) => ({
                          label: parseFakeString(
                            property.label.content as FakeString,
                          ),
                          value: parseFakeString(
                            (property.value as OchrePropertyValueContent)
                              .content as FakeString,
                          ),
                        }),
                      );
                    }
                  }

                  return `<Annotation type="${textStylingType}" variant="${textStylingVariant}" size="${textStylingSize}"${
                    textStylingCss.length > 0 ?
                      ` cssStyles={${JSON.stringify(textStylingCss)}}`
                    : ""
                  }>${itemString}</Annotation>`;
                }
              }
            }
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

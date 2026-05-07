import * as v from "valibot";
import type {
  XMLContent,
  XMLLink,
  XMLProperty,
  XMLString,
} from "#/types/xml/types.js";
import {
  PRESENTATION_ITEM_UUID,
  TEXT_ANNOTATION_ENTRY_PAGE_VARIANT_UUID,
  TEXT_ANNOTATION_HOVER_CARD_UUID,
  TEXT_ANNOTATION_ITEM_PAGE_VARIANT_UUID,
  TEXT_ANNOTATION_TEXT_STYLING_HEADING_LEVEL_UUID,
  TEXT_ANNOTATION_TEXT_STYLING_UUID,
  TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID,
  TEXT_ANNOTATION_UUID,
} from "#/constants.js";
import {
  emailSchema,
  renderOptionsSchema,
  whitespaceSchema,
} from "#/schemas.js";
import { MultilingualString } from "#/types/multilingual.js";

type XMLRichTextLink =
  | NonNullable<XMLLink["tree"]>[number]
  | NonNullable<XMLLink["bibliography"]>[number]
  | NonNullable<XMLLink["concept"]>[number]
  | NonNullable<XMLLink["spatialUnit"]>[number]
  | NonNullable<XMLLink["period"]>[number]
  | NonNullable<XMLLink["person"]>[number]
  | NonNullable<XMLLink["propertyVariable"]>[number]
  | NonNullable<XMLLink["propertyValue"]>[number]
  | NonNullable<XMLLink["resource"]>[number]
  | NonNullable<XMLLink["text"]>[number]
  | NonNullable<XMLLink["set"]>[number];

type XMLRichTextItem = NonNullable<XMLString["string"]>[number];

type CssStyle = { label: string; value: string };

type AnnotationMetadata = {
  linkVariant: "hover-card" | "item-page" | "entry-page" | null;
  textStyling: {
    variant: string;
    size: string;
    headingLevel: string | null;
    cssStyles: Array<CssStyle>;
  } | null;
};

type PropertyMetadata = { labelUuid: string; valueUuid: string | null };

const EMAIL_BRACKET_CLEANUP_REGEX = /(?<=\s|^)[([{]+|[)\]}]+(?=\s|$)/g;
const EMAIL_PUNCTUATION_CLEANUP_REGEX = /[!),:;?\]]/g;
const EMAIL_TRAILING_PERIOD_REGEX = /\.$/;

function isXMLRichTextLink(value: unknown): value is XMLRichTextLink {
  return typeof value === "object" && value != null;
}

function getLinkStringProperty(
  link: XMLRichTextLink,
  property: "uuid" | "href" | "height" | "width",
): string | null {
  switch (property) {
    case "uuid": {
      return "uuid" in link && typeof link.uuid === "string" ? link.uuid : null;
    }
    case "href": {
      return "href" in link && typeof link.href === "string" ? link.href : null;
    }
    case "height": {
      return "height" in link && typeof link.height === "string" ?
          link.height
        : null;
    }
    case "width": {
      return "width" in link && typeof link.width === "string" ?
          link.width
        : null;
    }
  }
}

export function transformPermanentIdentificationUrl(url: string): string {
  return url.replace(
    "https://pi.lib.uchicago.edu/1001/org/ochre/",
    "https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?uuid=",
  );
}

/**
 * Parses email addresses in a string into HTML links
 *
 * @param string - Input string to parse
 * @returns String with emails converted to HTML links
 *
 * @internal
 */
function parseEmail(string: string): string {
  const splitString = string.split(" ");
  const returnSplitString: Array<string> = [];

  for (const string of splitString) {
    const cleanString = transformPermanentIdentificationUrl(string)
      .replaceAll(EMAIL_BRACKET_CLEANUP_REGEX, "")
      .replaceAll(EMAIL_PUNCTUATION_CLEANUP_REGEX, "")
      .replace(EMAIL_TRAILING_PERIOD_REGEX, "");

    const index = string.indexOf(cleanString);

    const { success } = v.safeParse(emailSchema, cleanString);
    if (success) {
      const before = index === -1 ? "" : string.slice(0, index);
      const after =
        index === -1 ? "" : string.slice(index + cleanString.length);
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
 * @param options - Options for parsing
 * @param options.isRichText - Whether to parse as rich text
 * @returns String with markdown formatting applied
 * @internal
 */
function parseRenderOptions(
  contentString: string,
  renderString: string,
  options: { isRichText: boolean },
): string {
  let returnString = contentString;

  const { success, output } = v.safeParse(renderOptionsSchema, renderString);
  if (!success) {
    return contentString;
  }

  for (const option of output) {
    switch (option) {
      case "bold": {
        returnString =
          options.isRichText ? `**${returnString}**` : returnString;
        break;
      }
      case "italic": {
        returnString = options.isRichText ? `*${returnString}*` : returnString;
        break;
      }
      case "underline": {
        returnString = options.isRichText ? `_${returnString}_` : returnString;
        break;
      }
    }
  }

  return returnString.replaceAll("&#39;", "'");
}

/**
 * Applies whitespace options to a string (newline)
 *
 * @param contentString - The string content to modify
 * @param whitespace - Space-separated string of whitespace options
 * @param options - Options for parsing
 * @param options.isRichText - Whether to parse as rich text
 * @returns String with whitespace modifications applied
 *
 * @internal
 */
function parseWhitespace(
  contentString: string,
  whitespace: string,
  options: { isRichText: boolean },
): string {
  let returnString = contentString;

  const { success, output } = v.safeParse(whitespaceSchema, whitespace);
  if (!success) {
    return contentString;
  }

  for (const option of output) {
    switch (option) {
      case "newline": {
        if (options.isRichText) {
          returnString =
            returnString.trim() === "***" ?
              `${returnString}\n`
            : `<br />\n${returnString}`;
        } else {
          returnString = `\n${returnString}`;
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
 * Parses XML string into a formatted string with whitespace and rendering options
 *
 * @param string - XML string to parse
 * @param options - Options for parsing
 * @param options.isRichText - Whether to parse as rich text
 * @param options.parseEmail - Whether to parse email addresses
 * @returns Formatted string with whitespace and rendering options
 *
 * @internal
 */
export function parseXMLString(
  string: XMLString,
  options: { isRichText: boolean; parseEmail: boolean },
): string {
  let returnString = (string.payload ?? "")
    .replaceAll("<", options.isRichText ? String.raw`\<` : "<")
    .replaceAll("{", String.raw`\{`)
    .replaceAll("}", String.raw`\}`);

  if (string.whitespace != null) {
    returnString = parseWhitespace(returnString, string.whitespace, {
      isRichText: options.isRichText,
    });
  }

  if (string.rend != null) {
    returnString = parseRenderOptions(returnString, string.rend, {
      isRichText: options.isRichText,
    });
  }

  return options.parseEmail ? parseEmail(returnString) : returnString;
}

/**
 * Creates an MDX component based on the variant
 *
 * @param variant - The variant of the component
 * @param properties - The properties of the component
 * @param properties.uuid - The UUID of the component
 * @param properties.href - The href of the component
 * @param properties.height - The height of the component
 * @param properties.width - The width of the component
 * @param properties.content - The content of the component
 * @param properties.text - The text of the component
 * @returns The MDX component as a string
 *
 * @internal
 */
function createMDXComponent(
  variant:
    | "inlineImage"
    | "internalLink"
    | "externalLink"
    | "documentLink"
    | "tooltipSpan",
  properties: {
    uuid: string | null;
    text: string;
    content?: string;
    href?: string;
    height?: string;
    width?: string;
  },
): string {
  const { uuid, href, height, width, content, text } = properties;
  let returnString = "";

  switch (variant) {
    case "inlineImage": {
      returnString = `<InlineImage uuid="${uuid}" ${
        content != null && content !== "" ? `content="${content}"` : ""
      } height={${height ?? "null"}} width={${width ?? "null"}} />`;
      break;
    }
    case "internalLink": {
      returnString = `<InternalLink uuid="${uuid}"${
        content != null && content !== "" ? ` content="${content}"` : ""
      }>${text}</InternalLink>`;
      break;
    }
    case "externalLink": {
      returnString = `<ExternalLink href="${href == null ? "#" : transformPermanentIdentificationUrl(href)}"${
        content != null && content !== "" ? ` content="${content}"` : ""
      }>${text}</ExternalLink>`;
      break;
    }
    case "documentLink": {
      returnString = String.raw`<ExternalLink href="https:\/\/ochre.lib.uchicago.edu/ochre/v2/ochre.php?uuid=${uuid}&load"${
        content != null && content !== "" ? ` content="${content}"` : ""
      }>${text}</ExternalLink>`;
      break;
    }
    case "tooltipSpan": {
      returnString = `<TooltipSpan${
        content != null && content !== "" ? ` content="${content}"` : ""
      }>${text}</TooltipSpan>`;
      break;
    }
  }

  return returnString;
}

function applyWhitespaceToResult(
  result: string,
  whitespace: string | undefined,
  options: { isRichText: boolean },
): string {
  return whitespace == null ? result : (
      parseWhitespace(result, whitespace, options)
    );
}

function getPropertyValueUuid(
  property: XMLProperty | undefined,
): string | null {
  const value = property?.value?.[0];
  return value?.uuid == null || value.uuid === "" ? null : value.uuid;
}

function getFirstPropertyMetadata(
  item: XMLRichTextItem,
): PropertyMetadata | null {
  const itemProperty = item.properties?.property[0];
  if (itemProperty == null) {
    return null;
  }

  return {
    labelUuid: itemProperty.label.uuid,
    valueUuid: getPropertyValueUuid(itemProperty),
  };
}

function parseContentLikeForLanguage(
  value: XMLContent | XMLString | undefined,
  options: { language: string; isRichText: boolean },
): string {
  if (value == null) {
    return "";
  }

  if (!("content" in value)) {
    return parseXMLString(value, {
      isRichText: options.isRichText,
      parseEmail: false,
    });
  }

  const contentItem =
    value.content.find((item) => item.lang === options.language) ??
    value.content[0];
  if (contentItem == null) {
    return "";
  }

  const languages = [contentItem.lang] as const;
  return parseXMLContent(
    { content: [contentItem] },
    { languages, isRichText: options.isRichText },
  ).getText(contentItem.lang);
}

function parsePropertyValueText(
  property: XMLProperty | undefined,
  options: { language: string; isRichText: boolean },
): string {
  const value = property?.value?.[0];
  if (value == null) {
    return "";
  }

  if (value.rawValue != null) {
    return value.rawValue;
  }

  if (value.payload != null) {
    return value.payload;
  }

  if (value.slug != null) {
    return value.slug;
  }

  if (value.content != null) {
    return parseContentLikeForLanguage(value as XMLContent, options);
  }

  return "";
}

function extractAnnotationMetadata(
  item: XMLRichTextItem,
  options: { language: string; isRichText: boolean },
): AnnotationMetadata {
  const result: AnnotationMetadata = { linkVariant: null, textStyling: null };
  const itemProperty = item.properties?.property[0];
  if (itemProperty == null) {
    return result;
  }

  if (
    itemProperty.label.uuid !== PRESENTATION_ITEM_UUID ||
    getPropertyValueUuid(itemProperty) !== TEXT_ANNOTATION_UUID
  ) {
    return result;
  }

  for (const textAnnotationProperty of itemProperty.property ?? []) {
    const textAnnotationPropertyValueUuid = getPropertyValueUuid(
      textAnnotationProperty,
    );
    if (textAnnotationPropertyValueUuid == null) {
      continue;
    }

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
      case TEXT_ANNOTATION_TEXT_STYLING_UUID: {
        let variant = "block";
        let size = "md";
        let headingLevel: string | null = null;
        const cssStyles: Array<CssStyle> = [];
        const textStylingProperties = textAnnotationProperty.property ?? [];

        for (const textStylingProperty of textStylingProperties) {
          if (
            textStylingProperty.label.uuid ===
            TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID
          ) {
            variant = parsePropertyValueText(textStylingProperty, options);

            for (const nestedProperty of textStylingProperty.property ?? []) {
              const label = parseContentLikeForLanguage(
                nestedProperty.label,
                options,
              );
              if (label === "size") {
                size = parsePropertyValueText(nestedProperty, options);
              }
            }
            continue;
          }

          if (
            textStylingProperty.label.uuid ===
            TEXT_ANNOTATION_TEXT_STYLING_HEADING_LEVEL_UUID
          ) {
            headingLevel = parsePropertyValueText(textStylingProperty, options);
            continue;
          }

          cssStyles.push({
            label: parseContentLikeForLanguage(
              textStylingProperty.label,
              options,
            ),
            value: parsePropertyValueText(textStylingProperty, options),
          });
        }

        result.textStyling = { variant, size, headingLevel, cssStyles };
        break;
      }
    }
  }

  return result;
}

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

function createInternalLinkComponent(properties: {
  uuid: string | null;
  text: string;
  content?: string;
  annotationMetadata: AnnotationMetadata;
  propertyMetadata?: PropertyMetadata | null;
}): string {
  const innerContent = wrapWithTextStyling(
    properties.text,
    properties.annotationMetadata.textStyling,
  );

  switch (properties.annotationMetadata.linkVariant) {
    case "hover-card": {
      return `<Annotation type="hover-card" uuid="${properties.uuid}">${innerContent}</Annotation>`;
    }
    case "item-page": {
      return `<InternalLink type="item" uuid="${properties.uuid}">${innerContent}</InternalLink>`;
    }
    case "entry-page": {
      return `<InternalLink type="entry" uuid="${properties.uuid}">${innerContent}</InternalLink>`;
    }
    default: {
      return `<InternalLink uuid="${properties.uuid}"${
        properties.propertyMetadata != null ?
          ` properties="${properties.propertyMetadata.labelUuid}"${
            properties.propertyMetadata.valueUuid != null ?
              ` value="${properties.propertyMetadata.valueUuid}"`
            : ""
          }`
        : ""
      }${
        properties.content != null && properties.content !== "" ?
          ` content="${properties.content}"`
        : ""
      }>${innerContent}</InternalLink>`;
    }
  }
}

/**
 * Parses rich text content into a formatted string with links and annotations
 *
 * @param item - XML-based rich text item to parse
 * @param options - Options for parsing
 * @param options.languages - Languages of the content
 * @param options.isRichText - Whether to parse as rich text
 * @returns Formatted string with HTML/markdown elements
 *
 * @internal
 */
export function parseXMLContent<V extends ReadonlyArray<string>>(
  item: XMLContent,
  options: { languages: V; isRichText: boolean },
): MultilingualString<V> {
  const { languages, isRichText } = options;

  let returnString = MultilingualString.empty(languages, { isRichText });

  const languageStringItems = item.content.filter((content) =>
    languages.includes(content.lang),
  );
  if (languageStringItems.length === 0) {
    const fallbackContent = item.content[0];
    if (fallbackContent == null) {
      return returnString;
    }

    const fallbackLanguages = [fallbackContent.lang] as const;
    const fallbackText = parseXMLContent(
      { content: [fallbackContent] },
      { languages: fallbackLanguages, isRichText },
    ).getText(fallbackContent.lang);

    for (const language of languages) {
      returnString = returnString.withText(language, fallbackText);
    }

    return returnString;
  }

  for (const stringItems of languageStringItems) {
    for (const stringItem of stringItems.string) {
      if (stringItem.payload != null) {
        const currentText = returnString.getExactText(stringItems.lang) ?? "";
        const newText =
          currentText +
          parseXMLString(stringItem, { isRichText, parseEmail: true });
        returnString = returnString.withText(stringItems.lang, newText);
      } else if ("whitespace" in stringItem && stringItem.whitespace != null) {
        const currentText = returnString.getExactText(stringItems.lang) ?? "";
        const newText =
          currentText +
          parseWhitespace("", stringItem.whitespace, { isRichText });
        returnString = returnString.withText(stringItems.lang, newText);
      } else if ("string" in stringItem && stringItem.string != null) {
        for (const innerStringItem of stringItem.string) {
          if (innerStringItem.string != null) {
            let linkString = "";
            for (const innerInnerStringItem of innerStringItem.string) {
              if (innerInnerStringItem.payload != null) {
                linkString += parseXMLString(innerInnerStringItem, {
                  isRichText,
                  parseEmail: false,
                });
              }
            }
            if (innerStringItem.rend != null) {
              linkString = parseRenderOptions(
                linkString,
                innerStringItem.rend,
                { isRichText },
              );
            }

            const annotationMetadata = extractAnnotationMetadata(
              innerStringItem,
              { language: stringItems.lang, isRichText },
            );

            const links: Array<XMLRichTextLink> = [];
            for (const rawLinks of Object.values(innerStringItem.links ?? {})) {
              if (!Array.isArray(rawLinks)) {
                continue;
              }

              for (const rawLink of rawLinks) {
                if (isXMLRichTextLink(rawLink)) {
                  links.push(rawLink);
                }
              }
            }
            if (links.length === 0) {
              const currentText =
                returnString.getExactText(stringItems.lang) ?? "";
              const text = applyWhitespaceToResult(
                wrapWithTextStyling(linkString, annotationMetadata.textStyling),
                innerStringItem.whitespace,
                { isRichText },
              );
              returnString = returnString.withText(
                stringItems.lang,
                currentText + text,
              );
              continue;
            }

            for (const link of links) {
              const linkContent =
                link.identification != null ?
                  "content" in link.identification.label ?
                    parseXMLContent(link.identification.label, {
                      languages,
                      isRichText,
                    })
                  : MultilingualString.create(
                      stringItems.lang,
                      parseXMLString(link.identification.label, {
                        isRichText,
                        parseEmail: false,
                      }),
                      languages,
                      { isRichText },
                    )
                : MultilingualString.create(stringItems.lang, "", languages, {
                    isRichText,
                  });

              if ("type" in link && link.type != null) {
                switch (link.type) {
                  case "IIIF":
                  case "image": {
                    if ("rend" in link && link.rend === "inline") {
                      const currentText =
                        returnString.getExactText(stringItems.lang) ?? "";
                      const component = createMDXComponent("inlineImage", {
                        uuid: getLinkStringProperty(link, "uuid"),
                        href: getLinkStringProperty(link, "href") ?? undefined,
                        height:
                          getLinkStringProperty(link, "height") ?? undefined,
                        width:
                          getLinkStringProperty(link, "width") ?? undefined,
                        content:
                          linkContent.getExactText(stringItems.lang) ?? "",
                        text: linkString,
                      });
                      const newText =
                        currentText +
                        applyWhitespaceToResult(
                          component,
                          innerStringItem.whitespace,
                          { isRichText },
                        );
                      returnString = returnString.withText(
                        stringItems.lang,
                        newText,
                      );
                    } else if (link.publicationDateTime != null) {
                      const currentText =
                        returnString.getExactText(stringItems.lang) ?? "";
                      const component = createInternalLinkComponent({
                        uuid: getLinkStringProperty(link, "uuid"),
                        text: linkString,
                        content:
                          linkContent.getExactText(stringItems.lang) ?? "",
                        annotationMetadata,
                      });
                      const newText =
                        currentText +
                        applyWhitespaceToResult(
                          component,
                          innerStringItem.whitespace,
                          { isRichText },
                        );
                      returnString = returnString.withText(
                        stringItems.lang,
                        newText,
                      );
                    } else {
                      const currentText =
                        returnString.getExactText(stringItems.lang) ?? "";
                      const component = createMDXComponent("tooltipSpan", {
                        uuid: getLinkStringProperty(link, "uuid"),
                        text: linkString,
                        content:
                          linkContent.getExactText(stringItems.lang) ?? "",
                      });
                      const newText =
                        currentText +
                        applyWhitespaceToResult(
                          component,
                          innerStringItem.whitespace,
                          { isRichText },
                        );
                      returnString = returnString.withText(
                        stringItems.lang,
                        newText,
                      );
                    }
                    break;
                  }
                  case "internalDocument": {
                    const currentText =
                      returnString.getExactText(stringItems.lang) ?? "";
                    const component = createInternalLinkComponent({
                      uuid: getLinkStringProperty(link, "uuid"),
                      text: linkString,
                      content: linkContent.getExactText(stringItems.lang) ?? "",
                      annotationMetadata,
                      propertyMetadata:
                        getFirstPropertyMetadata(innerStringItem),
                    });
                    const newText =
                      currentText +
                      applyWhitespaceToResult(
                        component,
                        innerStringItem.whitespace,
                        { isRichText },
                      );
                    returnString = returnString.withText(
                      stringItems.lang,
                      newText,
                    );
                    break;
                  }
                  case "externalDocument": {
                    const currentText =
                      returnString.getExactText(stringItems.lang) ?? "";
                    const component =
                      link.publicationDateTime != null ?
                        createMDXComponent("documentLink", {
                          uuid: getLinkStringProperty(link, "uuid"),
                          text: linkString,
                          content:
                            linkContent.getExactText(stringItems.lang) ?? "",
                        })
                      : createMDXComponent("tooltipSpan", {
                          uuid: getLinkStringProperty(link, "uuid"),
                          text: linkString,
                          content:
                            linkContent.getExactText(stringItems.lang) ?? "",
                        });
                    const newText =
                      currentText +
                      applyWhitespaceToResult(
                        component,
                        innerStringItem.whitespace,
                        { isRichText },
                      );
                    returnString = returnString.withText(
                      stringItems.lang,
                      newText,
                    );
                    break;
                  }
                  case "webpage": {
                    const currentText =
                      returnString.getExactText(stringItems.lang) ?? "";
                    const component = createMDXComponent("externalLink", {
                      uuid: getLinkStringProperty(link, "uuid"),
                      href: getLinkStringProperty(link, "href") ?? "#",
                      text: linkString,
                      content: linkContent.getExactText(stringItems.lang) ?? "",
                    });
                    const newText =
                      currentText +
                      applyWhitespaceToResult(
                        component,
                        innerStringItem.whitespace,
                        { isRichText },
                      );
                    returnString = returnString.withText(
                      stringItems.lang,
                      newText,
                    );
                    break;
                  }
                }
              } else {
                if (link.publicationDateTime != null) {
                  const currentText =
                    returnString.getExactText(stringItems.lang) ?? "";
                  const component = createInternalLinkComponent({
                    uuid: getLinkStringProperty(link, "uuid"),
                    text: linkString,
                    content: linkContent.getExactText(stringItems.lang) ?? "",
                    annotationMetadata,
                  });
                  const newText =
                    currentText +
                    applyWhitespaceToResult(
                      component,
                      innerStringItem.whitespace,
                      { isRichText },
                    );
                  returnString = returnString.withText(
                    stringItems.lang,
                    newText,
                  );
                } else {
                  const currentText =
                    returnString.getExactText(stringItems.lang) ?? "";
                  const component = createMDXComponent("tooltipSpan", {
                    uuid: getLinkStringProperty(link, "uuid"),
                    text: linkString,
                    content: linkContent.getExactText(stringItems.lang) ?? "",
                  });
                  const newText =
                    currentText +
                    applyWhitespaceToResult(
                      component,
                      innerStringItem.whitespace,
                      { isRichText },
                    );
                  returnString = returnString.withText(
                    stringItems.lang,
                    newText,
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  return returnString;
}

/**
 * Extracts alias strings from XMLContent where lang="zxx"
 * @param content - The XMLContent to extract aliases from
 * @returns Array of alias strings, or null if none found
 *
 * @internal
 */
export function extractAliases(
  content: XMLContent | undefined,
  options: { isRichText: boolean },
): Array<string> | null {
  if (content == null) {
    return null;
  }

  const aliasItems = content.content.find((item) => item.lang === "zxx");
  if (aliasItems == null) {
    return null;
  }

  const aliases = parseXMLContent(
    { content: [aliasItems] },
    { languages: ["zxx"], isRichText: options.isRichText },
  );

  return aliases.getExactText("zxx") != null ?
      [aliases.getExactText("zxx")!]
    : null;
}

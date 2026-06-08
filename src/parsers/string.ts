import * as v from "valibot";
import type { MultilingualStringText } from "#/parsers/multilingual.js";
import type {
  XMLContent,
  XMLLink,
  XMLProperty,
  XMLString,
} from "#/xml/types.js";
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
import { serializeMDXContent, serializeMDXText } from "#/parsers/mdx.js";
import { MultilingualString } from "#/parsers/multilingual.js";
import { renderOptionsSchema } from "#/schemas.js";
import { getXMLSourceIndex } from "#/xml/metadata.js";

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

type TextRendering = "plain" | "rich" | "rawMDX";

type RenderOption = "bold" | "italic" | "underline";

const TEXT_ANNOTATION_TOKEN = "text-annotation";
const TEXT_STYLING_TOKEN = "text-styling";
const HOVER_CARD_TOKEN = "hover-card";
const ITEM_PAGE_TOKEN = "item-page";
const ENTRY_PAGE_TOKEN = "entry-page";
const VARIANT_TOKEN = "variant";
const HEADING_LEVEL_TOKEN = "heading-level";

const RAW_MDX_BLOCK_DELIMITER = "``md``";
const RAW_MDX_BLOCK_PLACEHOLDER_PREFIX = "\0raw-mdx-block:";
const RAW_MDX_BLOCK_PLACEHOLDER_SUFFIX = "\0";

const MDX_QUOTED_ATTRIBUTE_ESCAPE_REGEX = /[\n\r"]/;
const MDX_RENDER_ELEMENTS = {
  bold: "strong",
  italic: "em",
  underline: "u",
} as const satisfies Record<RenderOption, string>;

function hasNewlineWhitespace(value: string | undefined): boolean {
  return value?.split(" ").includes("newline") === true;
}

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
      return "height" in link && link.height != null
        ? link.height.toString()
        : null;
    }
    case "width": {
      return "width" in link && link.width != null
        ? link.width.toString()
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
 * Applies text rendering options (bold, italic, underline) to a string
 *
 * @param contentString - The string content to render
 * @param renderString - Space-separated string of render options
 * @param rendering - Which text rendering to produce
 * @returns String with rich-text formatting applied
 * @internal
 */
function parseRenderOptions(
  contentString: string,
  renderString: string,
  rendering: TextRendering,
): string {
  const { success, output } = v.safeParse(renderOptionsSchema, renderString);
  if (!success) {
    return contentString;
  }

  if (rendering === "plain") {
    return contentString.replaceAll("&#39;", "'");
  }

  return applyRichRenderOptions(contentString, output).replaceAll("&#39;", "'");
}

function applyRichRenderOptions(
  contentString: string,
  options: ReadonlyArray<RenderOption>,
): string {
  const withoutLeadingWhitespace = contentString.trimStart();
  const leadingWhitespace = contentString.slice(
    0,
    contentString.length - withoutLeadingWhitespace.length,
  );
  const renderableContent = withoutLeadingWhitespace.trimEnd();
  const trailingWhitespace = withoutLeadingWhitespace.slice(
    renderableContent.length,
  );

  if (renderableContent === "") {
    return contentString;
  }

  return `${leadingWhitespace}${applyMDXRenderElements(
    renderableContent,
    options,
  )}${trailingWhitespace}`;
}

function applyMDXRenderElements(
  contentString: string,
  options: ReadonlyArray<RenderOption>,
): string {
  let result = contentString;
  for (const option of options) {
    const element = MDX_RENDER_ELEMENTS[option];
    result = `<${element}>${result}</${element}>`;
  }

  return result;
}

function applyNewlineWhitespace(
  contentString: string,
  whitespace: string | undefined,
  rendering: TextRendering,
): string {
  if (whitespace == null) {
    return contentString;
  }

  if (!hasNewlineWhitespace(whitespace)) {
    return contentString;
  }

  if (rendering === "rich") {
    return contentString.trim() === "***"
      ? `${contentString}\n`
      : `<br />\n${contentString}`;
  }

  return `\n${contentString}`;
}

/**
 * Parses XML string into a formatted string with rendering options
 *
 * @param string - XML string to parse
 * @param options - Options for parsing
 * @param options.rendering - Which text rendering to produce
 * @returns Formatted string with rendering options
 *
 * @internal
 */
function parseXMLStringVariant(
  string: XMLString,
  options: { rendering: TextRendering },
): string {
  let returnString = parseXMLStringPayload(string, options);

  if (string.rend != null) {
    returnString = parseRenderOptions(
      returnString,
      string.rend,
      options.rendering,
    );
  }

  return applyNewlineWhitespace(
    returnString,
    string.whitespace,
    options.rendering,
  );
}

function parseXMLStringPayload(
  string: XMLString,
  options: { rendering: TextRendering },
): string {
  const payload = string.payload ?? "";
  return options.rendering === "rich" ? serializeMDXText(payload) : payload;
}

export function parseXMLString(string: XMLString): MultilingualStringText {
  return {
    text: parseXMLStringVariant(string, { rendering: "plain" }),
    richText: parseXMLStringVariant(string, { rendering: "rich" }),
  };
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
  const tooltipContent = getDistinctTooltipContent(content, text);
  let returnString = "";

  switch (variant) {
    case "inlineImage": {
      returnString = `<InlineImage${createMDXStringAttribute(
        "uuid",
        uuid ?? "null",
      )}${createMDXStringAttribute(
        "content",
        content,
      )} height={${height ?? "null"}} width={${width ?? "null"}} />`;
      break;
    }
    case "internalLink": {
      returnString = `<InternalLink${createMDXStringAttribute(
        "uuid",
        uuid ?? "null",
      )}${createMDXStringAttribute(
        "content",
        tooltipContent,
      )}>${text}</InternalLink>`;
      break;
    }
    case "externalLink": {
      returnString = `<ExternalLink${createMDXStringAttribute(
        "href",
        href == null ? "#" : transformPermanentIdentificationUrl(href),
      )}${createMDXStringAttribute(
        "content",
        tooltipContent,
      )}>${text}</ExternalLink>`;
      break;
    }
    case "documentLink": {
      returnString = `<ExternalLink${createMDXStringAttribute(
        "href",
        `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?uuid=${uuid}&load`,
      )}${createMDXStringAttribute(
        "content",
        tooltipContent,
      )}>${text}</ExternalLink>`;
      break;
    }
    case "tooltipSpan": {
      returnString = `<TooltipSpan${createMDXStringAttribute(
        "content",
        content,
      )}>${text}</TooltipSpan>`;
      break;
    }
  }

  return returnString;
}

function getDistinctTooltipContent(
  content: string | undefined,
  textContent: string,
): string | undefined {
  return content === textContent ? undefined : content;
}

function createMDXStringAttribute(
  name: string,
  value: string | undefined,
): string {
  if (value == null || value === "") {
    return "";
  }

  const serializedValue = MDX_QUOTED_ATTRIBUTE_ESCAPE_REGEX.test(value)
    ? `{${JSON.stringify(value)}}`
    : `"${value}"`;

  return ` ${name}=${serializedValue}`;
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
  options: { language: string },
): string {
  if (value == null) {
    return "";
  }

  if (!("content" in value)) {
    return parseXMLString(value).text;
  }

  const contentItem =
    value.content.find((item) => item.lang === options.language) ??
    value.content[0];
  if (contentItem == null) {
    return "";
  }

  const languages = [contentItem.lang] as const;
  return parseXMLContent({ content: [contentItem] }, { languages }).getText(
    contentItem.lang,
  );
}

function parsePropertyValueText(
  property: XMLProperty | undefined,
  options: { language: string },
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

function normalizePropertyToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[\s_]+/g, "-");
}

function propertyLabelMatches(
  property: XMLProperty,
  uuid: string,
  tokens: ReadonlyArray<string>,
  options: { language: string },
): boolean {
  if (uuid !== "" && property.label.uuid === uuid) {
    return true;
  }

  const label = normalizePropertyToken(
    parseContentLikeForLanguage(property.label, options),
  );
  return tokens.includes(label);
}

function propertyValueMatches(
  property: XMLProperty,
  uuid: string,
  tokens: ReadonlyArray<string>,
  options: { language: string },
): boolean {
  if (uuid !== "" && getPropertyValueUuid(property) === uuid) {
    return true;
  }

  const value = normalizePropertyToken(
    parsePropertyValueText(property, options),
  );
  return tokens.includes(value);
}

function extractAnnotationMetadata(
  item: XMLRichTextItem,
  options: { language: string },
): AnnotationMetadata {
  const result: AnnotationMetadata = { linkVariant: null, textStyling: null };
  const itemProperty = item.properties?.property[0];
  if (itemProperty == null) {
    return result;
  }

  if (
    !propertyLabelMatches(
      itemProperty,
      PRESENTATION_ITEM_UUID,
      ["presentation"],
      options,
    ) ||
    !propertyValueMatches(
      itemProperty,
      TEXT_ANNOTATION_UUID,
      [TEXT_ANNOTATION_TOKEN],
      options,
    )
  ) {
    return result;
  }

  for (const textAnnotationProperty of itemProperty.property ?? []) {
    if (
      propertyValueMatches(
        textAnnotationProperty,
        TEXT_ANNOTATION_HOVER_CARD_UUID,
        [HOVER_CARD_TOKEN],
        options,
      )
    ) {
      result.linkVariant = "hover-card";
      continue;
    }

    if (
      propertyValueMatches(
        textAnnotationProperty,
        TEXT_ANNOTATION_ITEM_PAGE_VARIANT_UUID,
        [ITEM_PAGE_TOKEN],
        options,
      )
    ) {
      result.linkVariant = "item-page";
      continue;
    }

    if (
      propertyValueMatches(
        textAnnotationProperty,
        TEXT_ANNOTATION_ENTRY_PAGE_VARIANT_UUID,
        [ENTRY_PAGE_TOKEN],
        options,
      )
    ) {
      result.linkVariant = "entry-page";
      continue;
    }

    if (
      propertyValueMatches(
        textAnnotationProperty,
        TEXT_ANNOTATION_TEXT_STYLING_UUID,
        [TEXT_STYLING_TOKEN],
        options,
      )
    ) {
      let variant = "block";
      let size = "md";
      let headingLevel: string | null = null;
      const cssStyles: Array<CssStyle> = [];
      const textStylingProperties = textAnnotationProperty.property ?? [];

      for (const textStylingProperty of textStylingProperties) {
        if (
          propertyLabelMatches(
            textStylingProperty,
            TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID,
            [VARIANT_TOKEN],
            options,
          )
        ) {
          variant = parsePropertyValueText(textStylingProperty, options);

          for (const nestedProperty of textStylingProperty.property ?? []) {
            if (propertyLabelMatches(nestedProperty, "", ["size"], options)) {
              size = parsePropertyValueText(nestedProperty, options);
            }
          }
          continue;
        }

        if (
          propertyLabelMatches(
            textStylingProperty,
            TEXT_ANNOTATION_TEXT_STYLING_HEADING_LEVEL_UUID,
            [HEADING_LEVEL_TOKEN],
            options,
          )
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
      continue;
    }
  }

  return result;
}

function hasRichTextEnvelope(item: XMLRichTextItem): boolean {
  return (
    item.properties?.property[0] != null || getXMLRichTextLinks(item).length > 0
  );
}

function parseXMLStringItem<V extends ReadonlyArray<string>>(
  item: XMLRichTextItem,
  contentItem: XMLContent["content"][number],
  options: {
    languages: V;
    rendering: TextRendering;
    rawMDXBlocks?: Array<string>;
  },
): string {
  const hasTextContent = item.payload != null || item.string != null;
  if (!hasTextContent && getXMLRichTextLinks(item).length === 0) {
    return applyNewlineWhitespace("", item.whitespace, options.rendering);
  }

  if (hasRichTextEnvelope(item)) {
    let linkString =
      item.payload != null
        ? parseXMLStringPayload(item, { rendering: options.rendering })
        : parseNestedStringItems(item.string ?? [], contentItem, {
            ...options,
          });

    if (item.rend != null) {
      linkString = parseRenderOptions(linkString, item.rend, options.rendering);
    }

    if (options.rendering === "plain") {
      return applyNewlineWhitespace(
        linkString,
        item.whitespace,
        options.rendering,
      );
    }

    return renderRichTextItem(item, linkString, contentItem, options);
  }

  if (item.payload != null) {
    return parseXMLStringVariant(item, { rendering: options.rendering });
  }

  let result = parseNestedStringItems(item.string ?? [], contentItem, options);

  if (item.rend != null) {
    result = parseRenderOptions(result, item.rend, options.rendering);
  }

  return applyNewlineWhitespace(result, item.whitespace, options.rendering);
}

function parseNestedStringItems<V extends ReadonlyArray<string>>(
  items: ReadonlyArray<XMLRichTextItem>,
  contentItem: XMLContent["content"][number],
  options: {
    languages: V;
    rendering: TextRendering;
    rawMDXBlocks?: Array<string>;
  },
): string {
  let result = "";
  let rawMDXBlockStartIndex: number | null = null;
  for (const [index, item] of items.entries()) {
    if (
      item.payload === RAW_MDX_BLOCK_DELIMITER &&
      (index === 0 || hasNewlineWhitespace(item.whitespace)) &&
      item.rend == null &&
      item.links == null &&
      item.properties == null &&
      item.annotation == null &&
      item.string == null
    ) {
      if (rawMDXBlockStartIndex == null) {
        rawMDXBlockStartIndex = index;
        continue;
      }

      let rawMDXBlock = "";
      const rawMDXBlockRendering =
        options.rendering === "plain" ? "plain" : "rawMDX";
      for (
        let rawIndex = rawMDXBlockStartIndex + 1;
        rawIndex < index;
        rawIndex += 1
      ) {
        const rawItem = items[rawIndex];
        if (rawItem != null) {
          rawMDXBlock += parseXMLStringItem(rawItem, contentItem, {
            languages: options.languages,
            rendering: rawMDXBlockRendering,
            rawMDXBlocks: options.rawMDXBlocks,
          });
        }
      }

      if (
        rawMDXBlock !== "" &&
        !rawMDXBlock.endsWith("\n") &&
        hasNewlineWhitespace(item.whitespace)
      ) {
        rawMDXBlock += "\n";
      }

      if (options.rendering === "rich" && options.rawMDXBlocks != null) {
        const placeholder = `${RAW_MDX_BLOCK_PLACEHOLDER_PREFIX}${options.rawMDXBlocks.length}${RAW_MDX_BLOCK_PLACEHOLDER_SUFFIX}`;
        options.rawMDXBlocks.push(rawMDXBlock);
        result += placeholder;
      } else {
        result += rawMDXBlock;
      }

      rawMDXBlockStartIndex = null;
      continue;
    }

    if (rawMDXBlockStartIndex != null) {
      continue;
    }

    result += parseXMLStringItem(item, contentItem, options);
  }

  if (rawMDXBlockStartIndex != null) {
    for (let index = rawMDXBlockStartIndex; index < items.length; index += 1) {
      const item = items[index];
      if (item != null) {
        result += parseXMLStringItem(item, contentItem, options);
      }
    }
  }

  return result;
}

function isTextAnnotationMarkerLink(link: XMLRichTextLink): boolean {
  return getLinkStringProperty(link, "uuid") === TEXT_ANNOTATION_UUID;
}

function wrapWithTextStyling(
  content: string,
  textStyling: AnnotationMetadata["textStyling"],
): string {
  if (textStyling == null) {
    return content;
  }

  return `<Annotation type="text-styling"${createMDXStringAttribute(
    "variant",
    textStyling.variant,
  )}${createMDXStringAttribute("size", textStyling.size)}${createMDXStringAttribute(
    "headingLevel",
    textStyling.headingLevel ?? undefined,
  )}${
    textStyling.cssStyles.length > 0
      ? ` cssStyles={{default: ${JSON.stringify(textStyling.cssStyles)}, tablet: [], mobile: []}}`
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
      return `<Annotation type="hover-card"${createMDXStringAttribute(
        "uuid",
        properties.uuid ?? "null",
      )}>${innerContent}</Annotation>`;
    }
    case "item-page": {
      return `<InternalLink type="item"${createMDXStringAttribute(
        "uuid",
        properties.uuid ?? "null",
      )}>${innerContent}</InternalLink>`;
    }
    case "entry-page": {
      return `<InternalLink type="entry"${createMDXStringAttribute(
        "uuid",
        properties.uuid ?? "null",
      )}>${innerContent}</InternalLink>`;
    }
    default: {
      return `<InternalLink${createMDXStringAttribute(
        "uuid",
        properties.uuid ?? "null",
      )}${
        properties.propertyMetadata != null
          ? `${createMDXStringAttribute(
              "properties",
              properties.propertyMetadata.labelUuid,
            )}${createMDXStringAttribute(
              "value",
              properties.propertyMetadata.valueUuid ?? undefined,
            )}`
          : ""
      }${createMDXStringAttribute(
        "content",
        getDistinctTooltipContent(properties.content, properties.text),
      )}>${innerContent}</InternalLink>`;
    }
  }
}

function getXMLRichTextLinks(item: XMLRichTextItem): Array<XMLRichTextLink> {
  const links: Array<{ link: XMLRichTextLink; fallbackIndex: number }> = [];
  let fallbackIndex = 0;
  for (const rawLinks of Object.values(item.links ?? {})) {
    if (!Array.isArray(rawLinks)) {
      continue;
    }

    for (const rawLink of rawLinks) {
      if (isXMLRichTextLink(rawLink) && !isTextAnnotationMarkerLink(rawLink)) {
        links.push({ link: rawLink, fallbackIndex });
        fallbackIndex += 1;
      }
    }
  }

  links.sort((left, right) => {
    const leftIndex = getXMLSourceIndex(left.link);
    const rightIndex = getXMLSourceIndex(right.link);
    if (leftIndex != null && rightIndex != null && leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.fallbackIndex - right.fallbackIndex;
  });

  const sortedLinks: Array<XMLRichTextLink> = [];
  for (const { link } of links) {
    sortedLinks.push(link);
  }

  return sortedLinks;
}

function renderRichTextItem<V extends ReadonlyArray<string>>(
  item: XMLRichTextItem,
  linkString: string,
  contentItem: XMLContent["content"][number],
  options: { languages: V; rendering: TextRendering },
): string {
  const { languages, rendering } = options;
  const annotationMetadata = extractAnnotationMetadata(item, {
    language: contentItem.lang,
  });

  const links = getXMLRichTextLinks(item);
  if (links.length === 0) {
    return applyNewlineWhitespace(
      wrapWithTextStyling(linkString, annotationMetadata.textStyling),
      item.whitespace,
      rendering,
    );
  }

  let result = "";
  for (const link of links) {
    const linkContent =
      link.identification != null
        ? "content" in link.identification.label
          ? parseXMLContent(link.identification.label, { languages })
          : MultilingualString.create(
              contentItem.lang,
              parseXMLString(link.identification.label),
              languages,
            )
        : MultilingualString.create(contentItem.lang, "", languages);
    const content =
      rendering === "plain"
        ? linkContent.getExactText(contentItem.lang)
        : linkContent.getExactRichText(contentItem.lang);
    const contentText = content ?? "";

    if ("type" in link && link.type != null) {
      switch (link.type) {
        case "IIIF":
        case "image": {
          if ("rend" in link && link.rend === "inline") {
            const component = createMDXComponent("inlineImage", {
              uuid: getLinkStringProperty(link, "uuid"),
              href: getLinkStringProperty(link, "href") ?? undefined,
              height: getLinkStringProperty(link, "height") ?? undefined,
              width: getLinkStringProperty(link, "width") ?? undefined,
              content: contentText,
              text: linkString,
            });
            result += component;
          } else if (link.publicationDateTime != null) {
            const component = createInternalLinkComponent({
              uuid: getLinkStringProperty(link, "uuid"),
              text: linkString,
              content: contentText,
              annotationMetadata,
            });
            result += component;
          } else {
            const component = createMDXComponent("tooltipSpan", {
              uuid: getLinkStringProperty(link, "uuid"),
              text: linkString,
              content: contentText,
            });
            result += component;
          }
          break;
        }
        case "internalDocument": {
          const component = createInternalLinkComponent({
            uuid: getLinkStringProperty(link, "uuid"),
            text: linkString,
            content: contentText,
            annotationMetadata,
            propertyMetadata: getFirstPropertyMetadata(item),
          });
          result += component;
          break;
        }
        case "externalDocument": {
          const component =
            link.publicationDateTime != null
              ? createMDXComponent("documentLink", {
                  uuid: getLinkStringProperty(link, "uuid"),
                  text: linkString,
                  content: contentText,
                })
              : createMDXComponent("tooltipSpan", {
                  uuid: getLinkStringProperty(link, "uuid"),
                  text: linkString,
                  content: contentText,
                });
          result += component;
          break;
        }
        case "webpage": {
          const component = createMDXComponent("externalLink", {
            uuid: getLinkStringProperty(link, "uuid"),
            href: getLinkStringProperty(link, "href") ?? "#",
            text: linkString,
            content: contentText,
          });
          result += component;
          break;
        }
      }
    } else if (link.publicationDateTime != null) {
      const component = createInternalLinkComponent({
        uuid: getLinkStringProperty(link, "uuid"),
        text: linkString,
        content: contentText,
        annotationMetadata,
      });
      result += component;
    } else {
      const component = createMDXComponent("tooltipSpan", {
        uuid: getLinkStringProperty(link, "uuid"),
        text: linkString,
        content: contentText,
      });
      result += component;
    }
  }

  return applyNewlineWhitespace(result, item.whitespace, rendering);
}

/**
 * Parses rich text content into a formatted string with links and annotations
 *
 * @param item - XML-based rich text item to parse
 * @param options - Options for parsing
 * @param options.languages - Languages of the content
 * @returns Plain and rich formatted strings
 *
 * @internal
 */
export function parseXMLContent<V extends ReadonlyArray<string>>(
  item: XMLContent,
  options: { languages: V },
): MultilingualString<V> {
  const { languages } = options;
  const aliases = extractAliases(item) ?? [];
  const content: Partial<Record<V[number], Array<MultilingualStringText>>> = {};

  for (const contentItem of item.content) {
    if (contentItem.lang === "zxx" || !languages.includes(contentItem.lang)) {
      continue;
    }

    const language = contentItem.lang as V[number];
    const entries = content[language] ?? [];
    entries.push(parseXMLContentItem(contentItem, { languages }));
    content[language] = entries;
  }

  if (Object.keys(content).length > 0) {
    return MultilingualString.fromEntries(content, languages, { aliases });
  }

  for (const contentItem of item.content) {
    if (contentItem.lang === "zxx") {
      continue;
    }

    const fallbackLanguages = [contentItem.lang] as const;
    const fallbackText = parseXMLContentItem(contentItem, {
      languages: fallbackLanguages,
    });
    const fallbackContent: Partial<
      Record<V[number], Array<MultilingualStringText>>
    > = {};
    for (const language of languages) {
      fallbackContent[language as V[number]] = [fallbackText];
    }

    return MultilingualString.fromEntries(fallbackContent, languages, {
      aliases,
    });
  }

  return MultilingualString.empty(languages, { aliases });
}

function parseXMLContentItem<V extends ReadonlyArray<string>>(
  contentItem: XMLContent["content"][number],
  options: { languages: V },
): MultilingualStringText {
  const rawMDXBlocks: Array<string> = [];
  const richText = parseNestedStringItems(contentItem.string, contentItem, {
    ...options,
    rendering: "rich",
    rawMDXBlocks,
  });
  let serializedRichText = serializeMDXContent(richText);
  for (const [index, rawMDXBlock] of rawMDXBlocks.entries()) {
    serializedRichText = serializedRichText.replaceAll(
      `${RAW_MDX_BLOCK_PLACEHOLDER_PREFIX}${index}${RAW_MDX_BLOCK_PLACEHOLDER_SUFFIX}`,
      rawMDXBlock,
    );
  }

  return {
    text: parseNestedStringItems(contentItem.string, contentItem, {
      ...options,
      rendering: "plain",
    }),
    richText: serializedRichText,
  };
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
): Array<string> | null {
  if (content == null) {
    return null;
  }

  const aliases: Array<string> = [];
  for (const contentItem of content.content) {
    if (contentItem.lang !== "zxx") {
      continue;
    }

    const alias = parseXMLContentItem(contentItem, {
      languages: ["zxx"] as const,
    }).text;
    if (alias !== "") {
      aliases.push(alias);
    }
  }

  return aliases.length > 0 ? aliases : null;
}

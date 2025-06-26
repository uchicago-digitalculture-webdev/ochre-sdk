import type { XMLContent, XMLText } from "../types/xml/types.js";
import * as v from "valibot";
import {
  emailSchema,
  renderOptionsSchema,
  whitespaceSchema,
} from "../schemas.js";
import { MultilingualString } from "../types/multilingual.js";

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
    const cleanString = string
      .replaceAll(/(?<=\s|^)[([{]+|[)\]}]+(?=\s|$)/g, "")
      .replace(/[!),.:;?\]]$/, "");

    const index = string.indexOf(cleanString);

    const before = string.slice(0, index);
    const after = string.slice(index + cleanString.length);

    const { success } = v.safeParse(emailSchema, cleanString);
    if (success) {
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
    throw new Error(
      `Invalid render options string provided: “${renderString}”`,
    );
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
    throw new Error(`Invalid whitespace string provided: “${whitespace}”`);
  }

  for (const option of output) {
    switch (option) {
      case "newline": {
        returnString =
          options.isRichText ? `<br />\n${returnString}` : `\n${returnString}`;
        break;
      }
      default: {
        break;
      }
    }
  }

  return returnString.replaceAll("&#39;", "'");
}

/**
 * Parses XML text into a formatted string with whitespace and rendering options
 *
 * @param item - XML text item to parse
 * @param options - Options for parsing
 * @param options.isRichText - Whether to parse as rich text
 * @param options.parseEmail - Whether to parse email addresses
 * @returns Formatted string with whitespace and rendering options
 *
 * @internal
 */
export function parseXMLText(
  item: XMLText,
  options: { isRichText: boolean; parseEmail: boolean },
): string {
  let returnString = (item.text ?? "")
    .replaceAll("{", String.raw`\{`)
    .replaceAll("}", String.raw`\}`);

  if (item.whitespace != null) {
    returnString = parseWhitespace(returnString, item.whitespace, {
      isRichText: options.isRichText,
    });
  }

  if (item.rend != null) {
    returnString = parseRenderOptions(returnString, item.rend, {
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
        content !== "" ? `content="${content}"` : ""
      } height={${height ?? "null"}} width={${width ?? "null"}} />`;
      break;
    }
    case "internalLink": {
      returnString = `<InternalLink uuid="${uuid}"${
        content !== "" ? ` content="${content}"` : ""
      }>${text}</InternalLink>`;
      break;
    }
    case "externalLink": {
      returnString = `<ExternalLink href="${href}"${
        content !== "" ? ` content="${content}"` : ""
      }>${text}</ExternalLink>`;
      break;
    }
    case "documentLink": {
      returnString = `<ExternalLink href="https:\\/\\/ochre.lib.uchicago.edu/ochre?uuid=${uuid}&load"${
        content !== "" ? ` content="${content}"` : ""
      }>${text}</ExternalLink>`;
      break;
    }
    case "tooltipSpan": {
      returnString = `<TooltipSpan${
        content !== "" ? ` content="${content}"` : ""
      }>${text}</TooltipSpan>`;
      break;
    }
  }

  return returnString;
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
    throw new Error(`Language content not found for languages: "${languages}"`);
  }

  for (const stringItems of languageStringItems) {
    for (const stringItem of stringItems.string) {
      if ("text" in stringItem && stringItem.text != null) {
        const currentText = returnString.getExactText(stringItems.lang) ?? "";
        const newText =
          currentText +
          parseXMLText(stringItem, { isRichText, parseEmail: true });
        returnString = returnString.withText(stringItems.lang, newText);
      } else if ("whitespace" in stringItem && stringItem.whitespace != null) {
        const currentText = returnString.getExactText(stringItems.lang) ?? "";
        const newText =
          currentText +
          parseWhitespace(currentText, stringItem.whitespace, { isRichText });
        returnString = returnString.withText(stringItems.lang, newText);
      } else if ("string" in stringItem) {
        for (const innerStringItem of stringItem.string) {
          if ("text" in innerStringItem && innerStringItem.text != null) {
            const currentText =
              returnString.getExactText(stringItems.lang) ?? "";
            const newText =
              currentText +
              parseXMLText(innerStringItem, { isRichText, parseEmail: true });
            returnString = returnString.withText(stringItems.lang, newText);
          } else if (
            "string" in innerStringItem &&
            innerStringItem.string != null
          ) {
            let linkString = "";
            for (const innerInnerStringItem of innerStringItem.string) {
              if (innerInnerStringItem.text != null) {
                linkString += parseXMLText(innerInnerStringItem, {
                  isRichText,
                  parseEmail: false,
                });
              }
            }

            const links = Object.values(innerStringItem.links).flat();

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
                      parseXMLText(link.identification.label, {
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
                  case "image": {
                    if ("rend" in link && link.rend != null) {
                      const currentText =
                        returnString.getExactText(stringItems.lang) ?? "";
                      const newText =
                        currentText +
                        createMDXComponent("inlineImage", {
                          uuid: link.uuid,
                          href: link.href,
                          height: link.height,
                          width: link.width,
                          content:
                            linkContent.getExactText(stringItems.lang) ?? "",
                          text: linkString,
                        });
                      returnString = returnString.withText(
                        stringItems.lang,
                        newText,
                      );
                    } else {
                      const currentText =
                        returnString.getExactText(stringItems.lang) ?? "";
                      const newText =
                        currentText +
                        createMDXComponent("internalLink", {
                          uuid: link.uuid ?? null,
                          text: linkString,
                          content:
                            linkContent.getExactText(stringItems.lang) ?? "",
                        });
                      returnString = returnString.withText(
                        stringItems.lang,
                        newText,
                      );
                    }
                    break;
                  }
                  case "externalDocument": {
                    const currentText =
                      returnString.getExactText(stringItems.lang) ?? "";
                    const newText =
                      currentText +
                      createMDXComponent("documentLink", {
                        uuid: link.uuid ?? null,
                        text: linkString,
                        content:
                          linkContent.getExactText(stringItems.lang) ?? "",
                      });
                    returnString = returnString.withText(
                      stringItems.lang,
                      newText,
                    );
                    break;
                  }
                  case "webpage": {
                    const currentText =
                      returnString.getExactText(stringItems.lang) ?? "";
                    const newText =
                      currentText +
                      createMDXComponent("externalLink", {
                        uuid: link.uuid ?? null,
                        href:
                          "href" in link && link.href != null ? link.href : "#",
                        text: linkString,
                        content:
                          linkContent.getExactText(stringItems.lang) ?? "",
                      });
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
                  const newText =
                    currentText +
                    createMDXComponent("internalLink", {
                      uuid: link.uuid ?? null,
                      text: linkString,
                      content: linkContent.getExactText(stringItems.lang) ?? "",
                    });
                  returnString = returnString.withText(
                    stringItems.lang,
                    newText,
                  );
                } else {
                  const currentText =
                    returnString.getExactText(stringItems.lang) ?? "";
                  const newText =
                    currentText +
                    createMDXComponent("tooltipSpan", {
                      uuid: link.uuid ?? null,
                      text: linkString,
                      content: linkContent.getExactText(stringItems.lang) ?? "",
                    });
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

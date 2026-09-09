import type { WebElementComponent } from "#/types/website.js";
import type { XMLWebsiteResource } from "#/xml/types.js";
import { parseStringContent } from "#/parsers/helpers.js";

/**
 * Name a resource well enough to find it in OCHRE from an error message
 *
 * Every throw in the website parser goes through here, because a UUID on its
 * own is not something anyone can look up quickly and a label on its own is
 * not unique.
 * @param resource - The resource the error is about
 * @returns A comma-separated description of the resource
 * @internal
 */
export function formatXMLWebsiteResourceMetadata(
  resource: XMLWebsiteResource,
): string {
  const metadata: Array<string> = [
    `label “${parseStringContent(resource.identification.label)}”`,
    `uuid “${resource.uuid}”`,
  ];

  if (resource.slug != null) {
    metadata.push(`slug “${resource.slug}”`);
  }

  if (resource.identification.abbreviation != null) {
    metadata.push(
      `abbreviation “${parseStringContent(
        resource.identification.abbreviation,
      )}”`,
    );
  }

  return metadata.join(", ");
}

/**
 * Describe a component parser failure
 * @param message - What went wrong
 * @param componentName - The component being parsed
 * @param elementResource - The element the component belongs to
 * @returns The error message
 * @internal
 */
export function formatComponentError(
  message: string,
  componentName: WebElementComponent["component"] | undefined,
  elementResource: XMLWebsiteResource,
): string {
  return `${message} for component “${componentName ?? "(unknown)"}” (${formatXMLWebsiteResourceMetadata(
    elementResource,
  )})`;
}

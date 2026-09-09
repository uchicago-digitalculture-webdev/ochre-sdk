import type { ParserOptions } from "#/parsers/helpers.js";
import type { WebsitePresentationReader } from "#/parsers/website/reader.js";
import type { WebsitePageNode } from "#/parsers/website/walk.js";
import type { PropertyValueContent } from "#/types/index.js";
import type {
  WebAccordionItem,
  WebBlock,
  WebBlockItem,
  Webpage,
  WebSidebar,
  Website,
  WebsiteSegment,
} from "#/types/website.js";
import type {
  XMLWebsiteData,
  XMLWebsiteResource,
  XMLWebsiteTree,
} from "#/xml/types.js";
import { cleanObject, parseLicense } from "#/parsers/helpers.js";
import {
  parseIdentification,
  parseLinks,
  parseMetadata,
  parsePersonList,
  parseSimplifiedProperties,
} from "#/parsers/index.js";
import {
  parseMetadataLanguages,
  resolveDefaultLanguage,
  resolveLanguages,
} from "#/parsers/languages.js";
import {
  parseWebElement,
  parseWebTitle,
} from "#/parsers/website/components.js";
import {
  findWebsiteLink,
  parseWebsiteLinkTarget,
  webImageFromLink,
} from "#/parsers/website/links.js";
import { parseWebsiteProperties } from "#/parsers/website/properties.js";
import { websitePresentationReader } from "#/parsers/website/reader.js";
import {
  emptyResponsiveStyles,
  parseResponsiveCssStyles,
} from "#/parsers/website/styles.js";
import {
  collectWebsitePageSlugs,
  normalizeWebsiteResources,
  readWebsitePages,
} from "#/parsers/website/walk.js";

/**
 * What a website's pages inherit from the tree holding them
 */
type WebsiteParseContext<T extends ReadonlyArray<string>> = Pick<
  Website<T>,
  "belongsTo" | "metadata"
> & {
  pageSlugsByUuid?: ReadonlyMap<string, string>;
  /**
   * The resolved properties and license of the nearest enclosing Website or
   * WebsiteSegment. Segments inherit these so that anything they do not
   * explicitly define cascades down from their parent, while anything they do
   * define overrides it. This keeps inheritance a parsing-time concern so
   * consumers can read a segment's properties naively.
   */
  parentProperties?: Website<T>["properties"];
  parentLicense?: Website<T>["license"];
};

function isSidebarResource<T extends ReadonlyArray<string>>(
  resource: XMLWebsiteResource,
  options: ParserOptions<T>,
): boolean {
  const resourceProperties = parseSimplifiedProperties(
    resource.properties,
    options,
  );
  const resourceReader = websitePresentationReader(resourceProperties);

  return (
    resourceReader.value("presentation") === "element" &&
    resourceReader
      .nestedByValue("presentation", "element")
      .value("component") === "sidebar"
  );
}

function parseWebBlockItems<T extends ReadonlyArray<string>>(
  resources: Array<XMLWebsiteResource>,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
): Array<WebBlockItem<T>> {
  const items: Array<WebBlockItem<T>> = [];
  for (const resource of resources) {
    const resourceProperties = parseSimplifiedProperties(
      resource.properties,
      options,
    );

    const resourceType = websitePresentationReader(resourceProperties).value<
      "element" | "block"
    >("presentation");
    if (resourceType === null) {
      continue;
    }

    switch (resourceType) {
      case "element": {
        items.push(parseWebElement(resource, options, context.pageSlugsByUuid));
        break;
      }
      case "block": {
        const block = parseWebBlock(resource, options, context);
        if (block) {
          items.push(block);
        }
        break;
      }
    }
  }

  return items;
}

function parseWebpageRedirect<T extends ReadonlyArray<string>>(
  redirectValue: PropertyValueContent<T> | null,
  context: WebsiteParseContext<T>,
): Webpage<T>["properties"]["redirect"] {
  const redirectTarget = parseWebsiteLinkTarget(
    redirectValue,
    context.pageSlugsByUuid,
  );
  if (redirectTarget != null) {
    if (redirectValue?.href == null && redirectValue?.uuid != null) {
      return { type: "page", slug: redirectTarget, uuid: redirectValue.uuid };
    }

    return {
      type: "url",
      href: redirectTarget,
      isExternal: redirectTarget.startsWith("http"),
    };
  }

  if (redirectValue?.uuid != null) {
    return { type: "item", uuid: redirectValue.uuid, pageType: "item" };
  }

  return null;
}

/**
 * Parses a walked page node into a standardized Webpage structure
 *
 * @param page - The page node, with its slug and nesting already resolved
 * @returns Parsed Webpage object
 */
function parseWebpage<T extends ReadonlyArray<string>>(
  page: WebsitePageNode,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
): Webpage<T> {
  const webpageResource = page.resource;

  const webpageProperties = parseSimplifiedProperties(
    webpageResource.properties,
    options,
  );
  const webpageReader = websitePresentationReader(webpageProperties);

  const identification = parseIdentification(
    webpageResource.identification,
    options,
  );

  const returnWebpage: Webpage<T> = {
    uuid: webpageResource.uuid,
    type: "page",
    title: identification.label,
    slug: page.slug,
    publicationDateTime: webpageResource.publicationDateTime ?? null,
    items: [],
    segments: [],
    properties: {
      width: "default",
      variant: "default",
      isBreadcrumbsDisplayed: false,
      isSidebarDisplayed: true,
      isDisplayedInNavbar: true,
      isNavbarSearchBarDisplayed: true,
      redirect: null,
      backgroundImage: null,
      sidebar: null,
      cssStyles: emptyResponsiveStyles(),
    },
    webpages: [],
  };

  const websiteLinks = parseLinks(webpageResource.links, options);
  const imageLink = findWebsiteLink(
    websiteLinks,
    "resource",
    (link) => link.type === "image" || link.type === "IIIF",
  );

  const webpageResources = normalizeWebsiteResources(webpageResource.resource);

  returnWebpage.items = parseWebBlockItems(
    webpageResources.filter(
      (resource) => !isSidebarResource(resource, options),
    ),
    options,
    context,
  );

  returnWebpage.webpages = parseWebpages(page.children, options, context);
  returnWebpage.segments = parseWebsiteSegments(
    page.segments,
    options,
    context,
  );

  returnWebpage.properties.sidebar = parseSidebar(
    webpageResources,
    options,
    context,
  );

  const pageReader = webpageReader.nestedByValue("presentation", "page");
  if (pageReader.size > 0) {
    pageReader.readAll(returnWebpage.properties, {
      isDisplayedInNavbar: "displayed-in-navbar",
      width: "width",
      variant: "variant",
      isSidebarDisplayed: "sidebar-displayed",
      isBreadcrumbsDisplayed: "breadcrumbs-displayed",
      isNavbarSearchBarDisplayed: "navbar-search-bar-displayed",
    });

    returnWebpage.properties.redirect = parseWebpageRedirect(
      pageReader.valueNode("redirect-to"),
      context,
    );
  }

  if (imageLink != null) {
    returnWebpage.properties.backgroundImage = webImageFromLink(
      imageLink,
      "high",
    );
  }

  returnWebpage.properties.cssStyles =
    parseResponsiveCssStyles(webpageProperties);

  return returnWebpage;
}

/**
 * Parses walked page nodes into an array of Webpage objects
 *
 * @param pages - The page nodes to parse
 * @returns Array of parsed Webpage objects
 */
function parseWebpages<T extends ReadonlyArray<string>>(
  pages: ReadonlyArray<WebsitePageNode>,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
): Array<Webpage<T>> {
  return Array.from(pages, (page) => parseWebpage(page, options, context));
}

export function parseWebpageView<T extends ReadonlyArray<string>>(
  view: { resource?: Array<XMLWebsiteResource> } | undefined,
  options: ParserOptions<T>,
  context: Pick<Website<T>, "belongsTo" | "metadata">,
): Webpage<T> | null {
  const pages = readWebsitePages(view?.resource, options);

  return (
    parseWebpages(pages, options, {
      ...context,
      pageSlugsByUuid: collectWebsitePageSlugs(pages, options),
    })[0] ?? null
  );
}

function parseWebsiteSegments<T extends ReadonlyArray<string>>(
  segments: WebsitePageNode["segments"],
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
): Array<WebsiteSegment<T>> {
  return Array.from(segments, (segment) =>
    parseWebsiteTree(
      segment.tree,
      options,
      context,
      "segment",
      segment.slugPrefix,
    ),
  );
}

/**
 * Parses raw sidebar data into a standardized Sidebar structure
 *
 * @param resources - Array of raw sidebar resources in OCHRE format
 * @returns Parsed Sidebar object
 */
function parseSidebar<T extends ReadonlyArray<string>>(
  resources: Array<XMLWebsiteResource>,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
): WebSidebar<T> | null {
  const sidebarResource = resources.find((resource) =>
    isSidebarResource(resource, options),
  );
  if (sidebarResource == null) {
    return null;
  }

  const sidebarBaseProperties = parseSimplifiedProperties(
    sidebarResource.properties,
    options,
  );
  const sidebarResources = normalizeWebsiteResources(sidebarResource.resource);
  const items = parseWebBlockItems(sidebarResources, options, context);
  if (items.length === 0) {
    return null;
  }

  const sidebarReader = websitePresentationReader(sidebarBaseProperties)
    .nestedByValue("presentation", "element")
    .nestedByValue("component", "sidebar");

  const sidebar: WebSidebar<T> = {
    isDisplayed: true,
    items,
    title: parseWebTitle(
      sidebarBaseProperties,
      parseIdentification(sidebarResource.identification, options),
    ),
    layout: "start",
    mobileLayout: "default",
    cssStyles: parseResponsiveCssStyles(sidebarBaseProperties),
  };

  sidebarReader.readAll(sidebar, {
    layout: "layout",
    mobileLayout: "layout-mobile",
  });

  return sidebar;
}

function parseWebAccordionItem<T extends ReadonlyArray<string>>(
  elementResource: XMLWebsiteResource,
  childResources: Array<XMLWebsiteResource>,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
): WebAccordionItem<T> {
  const trigger = parseWebElement(
    elementResource,
    options,
    context.pageSlugsByUuid,
  ) as WebAccordionItem<T>["trigger"];

  const items = parseWebBlockItems(childResources, options, context);

  return { uuid: trigger.uuid, type: "accordion-item", trigger, items };
}

function parseBlockOverwrite<T extends ReadonlyArray<string>>(
  overwriteReader: WebsitePresentationReader<T>,
  isDefaultLayoutAccordion: boolean,
): WebBlock<T>["properties"]["tablet"] {
  if (overwriteReader.size === 0) {
    return null;
  }

  type BlockOverwrite = NonNullable<WebBlock<T>["properties"]["tablet"]>;
  const properties: BlockOverwrite = {
    layout: undefined,
    wrap: undefined,
    spacing: undefined,
    gap: undefined,
    isAccordionEnabled: undefined,
    isAccordionExpandedByDefault: undefined,
    isAccordionSidebarDisplayed: undefined,
  };

  overwriteReader.readAll(properties, {
    layout: "layout",
    wrap: "wrap",
    spacing: "spacing",
    gap: "gap",
  });

  if (isDefaultLayoutAccordion || properties.layout === "accordion") {
    overwriteReader.readAll(properties, {
      isAccordionEnabled: "accordion-enabled",
      isAccordionExpandedByDefault: "accordion-expanded",
      isAccordionSidebarDisplayed: "accordion-sidebar-displayed",
    });
  }

  const cleanedProperties = cleanObject(properties);

  return Object.keys(cleanedProperties).length > 0 ? cleanedProperties : null;
}

function parseAccordionAwareBlockItems<T extends ReadonlyArray<string>>(
  blockResources: Array<XMLWebsiteResource>,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
  isSupportingAccordionItems: boolean,
): Array<WebAccordionItem<T> | WebBlockItem<T>> {
  const blockItems: Array<WebAccordionItem<T> | WebBlockItem<T>> = [];
  for (const resource of blockResources) {
    const resourceProperties = parseSimplifiedProperties(
      resource.properties,
      options,
    );
    const resourceReader = websitePresentationReader(resourceProperties);

    const resourceType = resourceReader.value<"element" | "block">(
      "presentation",
    );
    if (resourceType === null) {
      continue;
    }

    switch (resourceType) {
      case "element": {
        const childResources = normalizeWebsiteResources(resource.resource);
        const componentType = resourceReader
          .nestedByValue("presentation", "element")
          .value<string>("component");

        blockItems.push(
          isSupportingAccordionItems &&
            componentType === "text" &&
            childResources.length > 0
            ? parseWebAccordionItem(resource, childResources, options, context)
            : parseWebElement(resource, options, context.pageSlugsByUuid),
        );
        break;
      }
      case "block": {
        const block = parseWebBlock(resource, options, context);
        if (block) {
          blockItems.push(block);
        }
        break;
      }
    }
  }

  return blockItems;
}

/**
 * Parses raw block data into a standardized WebBlock structure
 *
 * @param blockResource - Raw block resource data in OCHRE format
 * @returns Parsed WebBlock object
 */
function parseWebBlock<T extends ReadonlyArray<string>>(
  blockResource: XMLWebsiteResource,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
): WebBlock<T> | null {
  const blockProperties = parseSimplifiedProperties(
    blockResource.properties,
    options,
  );

  const returnBlock: WebBlock<T> = {
    uuid: blockResource.uuid,
    language: blockResource.lang ?? null,
    type: "block",
    title: parseWebTitle(
      blockProperties,
      parseIdentification(blockResource.identification, options),
    ),
    items: [],
    properties: {
      default: { layout: "vertical", wrap: "nowrap", spacing: null, gap: null },
      mobile: null,
      tablet: null,
    } as WebBlock<T>["properties"],
    cssStyles: emptyResponsiveStyles(),
  };

  const blockReader = websitePresentationReader(blockProperties).nestedByValue(
    "presentation",
    "block",
  );
  if (blockReader.size > 0) {
    blockReader.readAll(returnBlock.properties.default, {
      layout: "layout",
      wrap: "wrap",
      spacing: "spacing",
      gap: "gap",
    });

    if (returnBlock.properties.default.layout === "accordion") {
      returnBlock.properties.default.isAccordionEnabled = true;
      returnBlock.properties.default.isAccordionExpandedByDefault = true;
      returnBlock.properties.default.isAccordionSidebarDisplayed = false;
      blockReader.readAll(returnBlock.properties.default, {
        isAccordionEnabled: "accordion-enabled",
        isAccordionExpandedByDefault: "accordion-expanded",
        isAccordionSidebarDisplayed: "accordion-sidebar-displayed",
      });
    }

    const isDefaultLayoutAccordion =
      returnBlock.properties.default.layout === "accordion";
    returnBlock.properties.tablet = parseBlockOverwrite(
      blockReader.nested("overwrite-tablet"),
      isDefaultLayoutAccordion,
    );
    returnBlock.properties.mobile = parseBlockOverwrite(
      blockReader.nested("overwrite-mobile"),
      isDefaultLayoutAccordion,
    );
  }

  const blockResources = normalizeWebsiteResources(blockResource.resource);

  const isSupportingAccordionItems =
    returnBlock.properties.default.layout === "accordion" ||
    returnBlock.properties.tablet?.layout === "accordion" ||
    returnBlock.properties.mobile?.layout === "accordion";

  returnBlock.items = parseAccordionAwareBlockItems(
    blockResources,
    options,
    context,
    isSupportingAccordionItems,
  );

  returnBlock.cssStyles = parseResponsiveCssStyles(blockProperties);

  return returnBlock;
}

function parseWebsiteTree<
  const T extends ReadonlyArray<string>,
  TType extends Website<T>["type"],
>(
  websiteTree: XMLWebsiteTree,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
  type: TType,
  slugPrefix?: string,
): Website<T> & { type: TType } {
  if (!websiteTree.properties) {
    throw new Error(
      `Website properties not found (website uuid “${websiteTree.uuid}”)`,
      { cause: websiteTree },
    );
  }

  if (type === "website" && websiteTree.items?.resource == null) {
    throw new Error(
      `Website pages not found (website uuid “${websiteTree.uuid}”)`,
      { cause: websiteTree },
    );
  }

  const resources = normalizeWebsiteResources(websiteTree.items?.resource);
  const pages = readWebsitePages(
    websiteTree.items?.resource,
    options,
    slugPrefix,
  );
  const pageSlugsByUuid =
    context.pageSlugsByUuid ?? collectWebsitePageSlugs(pages, options);
  const treeContext: WebsiteParseContext<T> = { ...context, pageSlugsByUuid };
  const sidebar = parseSidebar(resources, options, treeContext);

  const properties = parseWebsiteProperties(
    websiteTree.properties.property,
    websiteTree,
    sidebar,
    options,
    context.parentProperties ?? null,
  );

  const license =
    parseLicense(websiteTree.availability) ?? context.parentLicense ?? null;

  return {
    uuid: websiteTree.uuid,
    type,
    belongsTo: context.belongsTo,
    metadata: context.metadata,
    publicationDateTime: websiteTree.publicationDateTime ?? null,
    identification: parseIdentification(websiteTree.identification, options),
    creators: websiteTree.creators
      ? parsePersonList(websiteTree.creators.creator, options)
      : [],
    license,
    items: parseWebpages(pages, options, {
      ...treeContext,
      parentProperties: properties,
      parentLicense: license,
    }),
    properties,
  };
}

export function parseWebsite<
  const T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(data: XMLWebsiteData, options?: { languages?: T }): Website<T> {
  const rawOchre = data.result.ochre;
  const metadataLanguages = parseMetadataLanguages(rawOchre);
  const languages = resolveLanguages(options?.languages, metadataLanguages);
  const defaultLanguage = resolveDefaultLanguage(rawOchre, languages);
  const parserOptions: ParserOptions<T> = { languages, defaultLanguage };
  const websiteTree = rawOchre.tree[0];
  if (websiteTree == null) {
    throw new Error("Website tree not found", { cause: data });
  }

  return parseWebsiteTree(
    websiteTree,
    parserOptions,
    {
      belongsTo: {
        uuid: rawOchre.uuidBelongsTo,
        abbreviation: rawOchre.belongsTo,
      },
      metadata: parseMetadata(rawOchre, parserOptions, defaultLanguage),
    },
    "website",
  );
}

import type { ParserOptions } from "#/parsers/helpers.js";
import type { WebsitePresentationReader } from "#/parsers/website/reader.js";
import type { Webpage, WebSidebar, Website } from "#/types/website.js";
import type { XMLWebsiteTree } from "#/xml/types.js";
import { parseWebsiteOptions } from "#/parsers/website/options.js";
import { parseStylesheets } from "#/parsers/website/styles.js";

export function resolveWebpageSettings(
  page: Website["properties"]["page"] | undefined,
): Pick<Webpage["properties"], keyof Website["properties"]["page"]> {
  return {
    width: page?.width ?? "default",
    variant: page?.variant ?? "default",
    isBreadcrumbsDisplayed: page?.isBreadcrumbsDisplayed ?? false,
    isSidebarDisplayed: page?.isSidebarDisplayed ?? true,
    isNavbarSearchBarDisplayed: page?.isNavbarSearchBarDisplayed ?? true,
  };
}

export const WEBPAGE_PROPERTY_LABELS = {
  width: "width",
  variant: "variant",
  isBreadcrumbsDisplayed: "breadcrumbs-displayed",
  isSidebarDisplayed: "sidebar-displayed",
  isNavbarSearchBarDisplayed: "navbar-search-bar-displayed",
} as const satisfies Record<keyof Website["properties"]["page"], string>;

/**
A hex color as lowercase `#rrggbb`, from `#rgb` or `#rrggbb` with or without
the `#`

@param value - The raw OCHRE value
@returns The normalized hex color, or null when the value is not one
*/
function parseHexColor(value: string | null): string | null {
  const hex = /^#?([\da-f]{3}|[\da-f]{6})$/i
    .exec(value?.trim() ?? "")?.[1]
    ?.toLowerCase();
  if (hex == null) {
    return null;
  }

  return `#${hex.length === 3 ? [...hex].map((digit) => digit.repeat(2)).join("") : hex}`;
}

/**
Parses raw website properties into a standardized Website properties structure

@param websiteReader - Reader over the website's "presentation" properties
@returns Parsed WebsiteProperties object
*/
export function parseWebsiteProperties<T extends ReadonlyArray<string>>(
  websiteReader: WebsitePresentationReader<T>,
  websiteTree: XMLWebsiteTree,
  sidebar: WebSidebar<T> | null,
  options: ParserOptions<T>,
  parent: Website<T>["properties"] | null,
  componentDefaults: Website<T>["properties"]["componentDefaults"],
): Website<T>["properties"] {
  const returnProperties: Website<T>["properties"] = {
    type: parent?.type ?? "traditional",
    status: parent?.status ?? "development",
    versionLabel: parent?.versionLabel ?? "release",
    privacy: parent?.privacy ?? "public",
    contact: parent?.contact ?? null,
    loadingVariant: "spinner",
    theme: { isThemeToggleDisplayed: true, defaultTheme: "system" },
    colors: { primary: parent?.colors.primary ?? null },
    icon: { logoUuid: null, faviconUuid: null, appleTouchIconUuid: null },
    navbar: {
      isDisplayed: true,
      variant: "default",
      alignment: "start",
      isProjectDisplayed: true,
      searchBarBoundElementUuid: null,
      items: parent?.navbar.items ?? null,
    },
    footer: {
      isDisplayed: true,
      logoUuid: null,
      items: parent?.footer.items ?? null,
    },
    sidebar: sidebar ?? parent?.sidebar ?? null,
    page: {
      width: parent?.page.width ?? null,
      variant: parent?.page.variant ?? null,
      isBreadcrumbsDisplayed: parent?.page.isBreadcrumbsDisplayed ?? null,
      isSidebarDisplayed: parent?.page.isSidebarDisplayed ?? null,
      isNavbarSearchBarDisplayed:
        parent?.page.isNavbarSearchBarDisplayed ?? null,
    },
    componentDefaults,
    itemPage: {
      isMainContentDisplayed: parent?.itemPage.isMainContentDisplayed ?? true,
      description: {
        isDisplayed: parent?.itemPage.description.isDisplayed ?? true,
        isHeaderDisplayed:
          parent?.itemPage.description.isHeaderDisplayed ?? true,
      },
      document: {
        isDisplayed: parent?.itemPage.document.isDisplayed ?? true,
        isHeaderDisplayed: parent?.itemPage.document.isHeaderDisplayed ?? true,
      },
      notes: {
        isDisplayed: parent?.itemPage.notes.isDisplayed ?? true,
        isHeaderDisplayed: parent?.itemPage.notes.isHeaderDisplayed ?? true,
        variant: parent?.itemPage.notes.variant ?? "discrete",
      },
      events: {
        isDisplayed: parent?.itemPage.events.isDisplayed ?? true,
        isHeaderDisplayed: parent?.itemPage.events.isHeaderDisplayed ?? true,
        variant: parent?.itemPage.events.variant ?? "tabular",
        isFilterInputDisplayed:
          parent?.itemPage.events.isFilterInputDisplayed ?? false,
      },
      periods: {
        isDisplayed: parent?.itemPage.periods.isDisplayed ?? true,
        isHeaderDisplayed: parent?.itemPage.periods.isHeaderDisplayed ?? true,
      },
      isPropertiesDisplayed: parent?.itemPage.isPropertiesDisplayed ?? true,
      bibliography: {
        isDisplayed: parent?.itemPage.bibliography.isDisplayed ?? true,
        isHeaderDisplayed:
          parent?.itemPage.bibliography.isHeaderDisplayed ?? true,
      },
      isPropertyValuesGrouped: parent?.itemPage.isPropertyValuesGrouped ?? true,
      isPublicationDateTimeDisplayed:
        parent?.itemPage.isPublicationDateTimeDisplayed ?? true,
      isPersistentIdentifierDisplayed:
        parent?.itemPage.isPersistentIdentifierDisplayed ?? true,
      iiifViewer: parent?.itemPage.iiifViewer ?? "universal-viewer",
    },
    relations: { variant: parent?.relations.variant ?? "list" },
    options: {
      contextTree: parent?.options.contextTree ?? null,
      scopes: parent?.options.scopes ?? null,
      labels: { title: parent?.options.labels.title ?? null },
      stylesheets: { properties: parent?.options.stylesheets.properties ?? [] },
    },
  };

  const contactProperty = websiteReader.property("contact");
  if (contactProperty !== null) {
    const contactContent =
      contactProperty.values[0]?.content.toString().split(";") ?? [];
    if (contactContent.length === 2) {
      returnProperties.contact = {
        name: contactContent[0]!,
        email: contactContent[1] ?? null,
      };
    } else {
      throw new Error(
        `Contact property must use “name;email”, got “${contactProperty.values[0]?.content}” (website uuid “${websiteTree.uuid}”)`,
        { cause: websiteTree },
      );
    }
  }

  returnProperties.colors.primary =
    parseHexColor(websiteReader.stringValue("primary-color")) ??
    returnProperties.colors.primary;

  websiteReader.readAll(returnProperties, {
    type: "webUI",
    status: "status",
    versionLabel: "version-label",
    privacy: "privacy",
    loadingVariant: "loading-variant",
  });
  websiteReader.readAll(returnProperties.theme, {
    isThemeToggleDisplayed: "supports-theme-toggle",
    defaultTheme: "default-theme",
  });
  websiteReader.readAllUuids(returnProperties.icon, {
    logoUuid: "navbar-logo",
    faviconUuid: "favicon-ico",
    appleTouchIconUuid: "favicon-img",
  });
  websiteReader.readAll(returnProperties.navbar, {
    isDisplayed: "navbar-displayed",
    variant: "navbar-variant",
    alignment: "navbar-alignment",
    isProjectDisplayed: "navbar-project-displayed",
  });
  websiteReader.readAllUuids(returnProperties.navbar, {
    searchBarBoundElementUuid: "bound-element-navbar-search-bar",
  });
  websiteReader.readAll(returnProperties.footer, {
    isDisplayed: "footer-displayed",
  });
  websiteReader.readAllUuids(returnProperties.footer, {
    logoUuid: "footer-logo",
  });

  websiteReader
    .nestedByValue("customize-special", "page")
    .readAll(returnProperties.page, WEBPAGE_PROPERTY_LABELS);

  const itemPageReader = websiteReader.nestedByValue(
    "customize-special",
    "item-page",
  );
  if (itemPageReader.size > 0) {
    const itemPageSections = [
      ["description", "description"],
      ["document", "document"],
      ["notes", "notes"],
      ["events", "events"],
      ["periods", "periods"],
      ["bibliography", "bibliography"],
    ] as const;

    for (const [key, slug] of itemPageSections) {
      const section: { isDisplayed: boolean; isHeaderDisplayed: boolean } =
        returnProperties.itemPage[key];

      itemPageReader.readAll(section, {
        isDisplayed: `item-page-${slug}-displayed`,
        isHeaderDisplayed: `item-page-${slug}-header-displayed`,
      });
    }

    itemPageReader.readAll(returnProperties.itemPage.notes, {
      variant: "item-page-notes-display-variant",
    });
    itemPageReader.readAll(returnProperties.itemPage.events, {
      variant: "item-page-events-display-variant",
    });
    itemPageReader
      .nestedByValue("item-page-events-display-variant", "tabular")
      .readAll(returnProperties.itemPage.events, {
        isFilterInputDisplayed: "filter-input-displayed",
      });
    itemPageReader.readAll(returnProperties.itemPage, {
      isPropertyValuesGrouped: "item-page-property-values-grouped",
      isPublicationDateTimeDisplayed:
        "item-page-publication-date-time-displayed",
      isPersistentIdentifierDisplayed:
        "item-page-persistent-identifier-displayed",
      iiifViewer: "item-page-iiif-viewer",
    });
  }

  websiteReader
    .nestedByValue("customize-special", "relations")
    .readAll(returnProperties.relations, { variant: "variant" });

  if (websiteTree.options != null) {
    const parsedOptions = parseWebsiteOptions(websiteTree.options, options);
    returnProperties.options.scopes = (
      parsedOptions.scopes != null && parsedOptions.scopes.length > 0
        ? parsedOptions
        : returnProperties.options
    ).scopes;
    returnProperties.options.contextTree =
      parsedOptions.contextTree ?? returnProperties.options.contextTree;
    returnProperties.options.labels = {
      title:
        parsedOptions.labels.title ?? returnProperties.options.labels.title,
    };
  }

  if ("styleOptions" in websiteTree && websiteTree.styleOptions != null) {
    const stylesheetProperties = parseStylesheets(
      websiteTree.styleOptions.style,
    );
    if (stylesheetProperties.length > 0) {
      returnProperties.options.stylesheets.properties = stylesheetProperties;
    }
  }

  return returnProperties;
}

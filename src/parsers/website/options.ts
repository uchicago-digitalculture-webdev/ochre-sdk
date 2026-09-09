import type { ParserOptions } from "#/parsers/helpers.js";
import type {
  ContextTree,
  ContextTreeLevel,
  ContextTreeLevelItem,
  WebOptions,
} from "#/types/website.js";
import type {
  XMLWebsiteContext,
  XMLWebsiteContextItem,
  XMLWebsiteFilterContext,
  XMLWebsiteFilterContextItem,
  XMLWebsiteOptions,
} from "#/xml/types.js";
import { parseContentLike } from "#/parsers/helpers.js";
import { parseIdentification, parseNotes } from "#/parsers/index.js";

function parseContextTreeLevel<T extends ReadonlyArray<string>>(
  contextItemToParse: XMLWebsiteContextItem | XMLWebsiteFilterContextItem,
  options: ParserOptions<T>,
): ContextTreeLevel<T> {
  let type = "";
  const levels: Array<ContextTreeLevelItem> = [];
  const levelsToParse = contextItemToParse.levels?.level ?? [];
  for (const level of levelsToParse) {
    const [rawVariableUuid = "", rawValueUuid] = level.payload.split(",", 2);
    const valueUuid =
      rawValueUuid == null || rawValueUuid.trim() === "null"
        ? null
        : rawValueUuid.trim();
    type = level.dataType ?? type;

    levels.push({ variableUuid: rawVariableUuid.trim(), valueUuid });
  }

  return {
    context: levels,
    type,
    identification: parseIdentification(
      contextItemToParse.identification,
      options,
    ),
    description: parseContentLike(contextItemToParse.description, options),
  };
}

function parseFilterContextDisplay<T extends ReadonlyArray<string>>(
  filterOption:
    | "inline-displayed"
    | "inline-sidebar-displayed-closed"
    | "inline-sidebar-displayed-open"
    | "sidebar-displayed-closed"
    | "sidebar-displayed-open"
    | "inline-sidebar-hidden"
    | undefined,
): Pick<
  ContextTree<T>["filter"][number],
  "isInlineDisplayed" | "isSidebarDisplayed" | "isSidebarOpen"
> {
  switch (filterOption) {
    case "inline-displayed": {
      return {
        isInlineDisplayed: true,
        isSidebarDisplayed: false,
        isSidebarOpen: false,
      };
    }
    case "inline-sidebar-displayed-closed": {
      return {
        isInlineDisplayed: true,
        isSidebarDisplayed: true,
        isSidebarOpen: false,
      };
    }
    case "inline-sidebar-displayed-open": {
      return {
        isInlineDisplayed: true,
        isSidebarDisplayed: true,
        isSidebarOpen: true,
      };
    }
    case "sidebar-displayed-closed": {
      return {
        isInlineDisplayed: false,
        isSidebarDisplayed: true,
        isSidebarOpen: false,
      };
    }
    case "sidebar-displayed-open": {
      return {
        isInlineDisplayed: false,
        isSidebarDisplayed: true,
        isSidebarOpen: true,
      };
    }
    default: {
      return {
        isInlineDisplayed: false,
        isSidebarDisplayed: false,
        isSidebarOpen: false,
      };
    }
  }
}

function parseContexts<T extends ReadonlyArray<string>>(
  contextLevels: Array<XMLWebsiteContext>,
  options: ParserOptions<T>,
): Array<ContextTreeLevel<T>> {
  const contextTreeLevels: Array<ContextTreeLevel<T>> = [];

  for (const contextLevel of contextLevels) {
    for (const contextItemToParse of contextLevel.context) {
      contextTreeLevels.push(
        parseContextTreeLevel(contextItemToParse, options),
      );
    }
  }

  return contextTreeLevels;
}

function parseFilterContexts<T extends ReadonlyArray<string>>(
  filterContextLevels: Array<XMLWebsiteFilterContext>,
  options: ParserOptions<T>,
): ContextTree<T>["filter"] {
  const filterContextTreeLevels: ContextTree<T>["filter"] = [];

  for (const filterContextLevel of filterContextLevels) {
    for (const contextItemToParse of filterContextLevel.context) {
      filterContextTreeLevels.push({
        ...parseContextTreeLevel(contextItemToParse, options),
        filterType: contextItemToParse.filterType ?? "property",
        filterVariant: contextItemToParse.filterVariant ?? null,
        ...parseFilterContextDisplay(contextItemToParse.filterOption),
      });
    }
  }

  return filterContextTreeLevels;
}

function parseAllOptionContexts<T extends ReadonlyArray<string>>(
  options: {
    flattenContexts?: Array<XMLWebsiteContext> | null;
    suppressContexts?: Array<XMLWebsiteContext> | null;
    filterContexts?: Array<XMLWebsiteFilterContext> | null;
    sortContexts?: Array<XMLWebsiteContext> | null;
    detailContexts?: Array<XMLWebsiteContext> | null;
    downloadContexts?: Array<XMLWebsiteContext> | null;
    labelContexts?: Array<XMLWebsiteContext> | null;
    prominentContexts?: Array<XMLWebsiteContext> | null;
  },
  parserOptions: ParserOptions<T>,
): ContextTree<T> {
  function handleContexts(
    contexts: Array<XMLWebsiteContext> | null | undefined,
  ): Array<ContextTreeLevel<T>> {
    return parseContexts(contexts ?? [], parserOptions);
  }

  function handleFilterContexts(
    contexts: Array<XMLWebsiteFilterContext> | null | undefined,
  ): ContextTree<T>["filter"] {
    return parseFilterContexts(contexts ?? [], parserOptions);
  }

  return {
    flatten: handleContexts(options.flattenContexts),
    suppress: handleContexts(options.suppressContexts),
    filter: handleFilterContexts(options.filterContexts),
    sort: handleContexts(options.sortContexts),
    detail: handleContexts(options.detailContexts),
    download: handleContexts(options.downloadContexts),
    label: handleContexts(options.labelContexts),
    prominent: handleContexts(options.prominentContexts),
  };
}

function parseWebsiteScopes<T extends ReadonlyArray<string>>(
  scopes: XMLWebsiteOptions["scopes"] | undefined,
  options: ParserOptions<T>,
): WebOptions<T>["scopes"] {
  if (scopes == null) {
    return null;
  }

  const parsedScopes: NonNullable<WebOptions<T>["scopes"]> = Array.from(
    scopes.scope,
    (scope) => ({
      uuid: scope.uuid.payload,
      type: scope.uuid.type,
      identification: parseIdentification(scope.identification, options),
    }),
  );

  return parsedScopes;
}

export function parseWebsiteOptions<T extends ReadonlyArray<string>>(
  rawOptions: XMLWebsiteOptions | undefined,
  options: ParserOptions<T>,
): WebOptions<T> {
  const parsedOptions: WebOptions<T> = {
    scopes: parseWebsiteScopes(rawOptions?.scopes, options),
    contextTree:
      rawOptions == null ? null : parseAllOptionContexts(rawOptions, options),
    labels: { title: null },
  };

  const notes = parseNotes(rawOptions?.notes, options);
  for (const note of notes) {
    if (note.title?.getText() !== "Title label") {
      continue;
    }

    parsedOptions.labels.title = note.content;
    break;
  }

  return parsedOptions;
}

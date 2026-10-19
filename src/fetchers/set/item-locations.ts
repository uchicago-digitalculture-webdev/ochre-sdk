import * as v from "valibot";
import type {
  FetchBaseOptions,
  FetchLanguages,
  FetchRuntimeOptions,
} from "#/parsers/helpers.js";
import type { Query, SetItemLocation } from "#/types/index.js";
import { normalizeItemCategory } from "#/categories.js";
import { getErrorOutput } from "#/errors.js";
import { requestOchre } from "#/fetchers/request.js";
import { parseRequiredContentLike } from "#/parsers/helpers.js";
import {
  parseCoordinates,
  parseIdentification,
  parseSpatialUnitMapData,
} from "#/parsers/index.js";
import {
  parseRequestedLanguages,
  resolveContentLanguages,
} from "#/parsers/languages.js";
import { compileContainerItemsQuery } from "#/query.js";
import { setItemLocationsParametersSchema } from "#/schemas.js";
import { XMLSetItemLocationsData as XMLSetItemLocationsDataSchema } from "#/xml/schemas.js";
import { getContentLanguage, stringLiteral } from "#/xquery.js";

/**
 * Fetches the location of every Set item that matches a query, without paging
 *
 * Each item carries only its identification, the scope Sets it belongs to, its
 * publication date, its coordinates, optionally its map polygons, and the
 * values of the requested property variables (inherited values included), which
 * is what a map needs to draw, color and group every match into layers while a
 * list pages through the same query with {@link fetchSetItems}.
 *
 * @param parameters - The parameters for the fetch
 * @param parameters.setScopeUuids - The Set scope UUIDs to filter by
 * @param parameters.queries - Recursive query tree used to filter matching items
 * @param parameters.propertyVariableUuids - The property variables whose values each item should carry
 * @param parameters.isMapDataIncluded - Whether each item should carry its map polygons
 * @param options - Options for the fetch
 * @param options.fetch - The fetch function to use
 * @returns The item locations, or an error if the fetch/parse fails
 */
export async function fetchSetItemLocations<
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  parameters: {
    setScopeUuids: Array<string>;
    queries?: Query | null;
    propertyVariableUuids?: Array<string>;
    isMapDataIncluded?: boolean;
  },
  options?: FetchBaseOptions<TLanguages>,
): Promise<
  | {
      totalCount: number;
      items: Array<SetItemLocation<FetchLanguages<TLanguages>>>;
      error: null;
      detailedError: null;
    }
  | { totalCount: null; items: null; error: string; detailedError: string }
>;
export async function fetchSetItemLocations(
  parameters: {
    setScopeUuids: Array<string>;
    queries?: Query | null;
    propertyVariableUuids?: Array<string>;
    isMapDataIncluded?: boolean;
  },
  options?: FetchRuntimeOptions,
): Promise<
  | {
      totalCount: number;
      items: Array<SetItemLocation<ReadonlyArray<string>>>;
      error: null;
      detailedError: null;
    }
  | { totalCount: null; items: null; error: string; detailedError: string }
> {
  try {
    const {
      setScopeUuids,
      belongsToCollectionScopeUuids,
      queries,
      propertyVariableUuids,
      isMapDataIncluded,
    } = v.parse(setItemLocationsParametersSchema, parameters);

    const output = await requestOchre({
      xquery: compileContainerItemsQuery({
        container: "set",
        scopeUuids: setScopeUuids,
        belongsToCollectionScopeUuids,
        queries,
        contentLanguage: getContentLanguage(options),
        body: ({
          items,
        }) => `  let $propertyVariableUuids := (${Array.from(propertyVariableUuids, (uuid) => stringLiteral(uuid)).join(", ")})

  return <items totalCount="{count(${items})}">{
    for $item in ${items}
    return <itemLocation uuid="{$item/@uuid}" category="{local-name($item)}" setUuid="{$item/ancestor::set[1]/@uuid}">{
      $item/@publicationDateTime,
      $item/identification,
      $item/coordinates,${isMapDataIncluded ? "\n      $item/mapData," : ""}
      for $value in $item//properties//property[label/@uuid = $propertyVariableUuids]/value[@uuid]
      return <value variable="{$value/../label/@uuid}" uuid="{$value/@uuid}">{$value/content}</value>
    }</itemLocation>
  }</items>`,
      }),
      schema: XMLSetItemLocationsDataSchema,
      label: "OCHRE Set item locations",
      options,
    });

    const languages = resolveContentLanguages(
      output.result.ochre.items,
      parseRequestedLanguages(options?.languages),
    );

    const itemsByUuid = new Map<
      string,
      SetItemLocation<ReadonlyArray<string>>
    >();
    const itemLocations = output.result.ochre.items.itemLocation ?? [];
    for (const itemLocation of itemLocations) {
      const category = normalizeItemCategory(itemLocation.category);
      const existing = itemsByUuid.get(itemLocation.uuid);
      if (existing != null) {
        if (!existing.setUuids.includes(itemLocation.setUuid)) {
          existing.setUuids.push(itemLocation.setUuid);
        }
        continue;
      }
      if (category == null) {
        continue;
      }

      const propertyValues: SetItemLocation["propertyValues"] = [];
      const seenPropertyValues = new Set<string>();
      const values = itemLocation.value ?? [];
      for (const value of values) {
        const key = `${value.variable}:${value.uuid}`;
        if (seenPropertyValues.has(key)) {
          continue;
        }

        seenPropertyValues.add(key);
        propertyValues.push({
          variableUuid: value.variable,
          valueUuid: value.uuid,
          label: parseRequiredContentLike(value, { languages }),
        });
      }

      itemsByUuid.set(itemLocation.uuid, {
        uuid: itemLocation.uuid,
        category,
        setUuids: [itemLocation.setUuid],
        publicationDateTime: itemLocation.publicationDateTime ?? null,
        identification: parseIdentification(itemLocation.identification, {
          languages,
        }),
        coordinates: parseCoordinates(itemLocation.coordinates, { languages }),
        mapData: parseSpatialUnitMapData(itemLocation.mapData),
        propertyValues,
      });
    }

    return {
      totalCount: output.result.ochre.items.totalCount,
      items: itemsByUuid.values().toArray(),
      error: null,
      detailedError: null,
    };
  } catch (error) {
    return {
      totalCount: null,
      items: null,
      ...getErrorOutput(error, "Failed to fetch Set item locations"),
    };
  }
}

/* eslint-disable unicorn/no-incorrect-template-string-interpolation */
import * as v from "valibot";
import type {
  FetchBaseOptions,
  FetchLanguages,
  FetchRuntimeOptions,
} from "#/parsers/helpers.js";
import type { MapLayer } from "#/types/index.js";
import type { XMLMapLayer, XMLMapSource } from "#/xml/types.js";
import { getErrorOutput } from "#/errors.js";
import { requestOchre } from "#/fetchers/request.js";
import { parseIdentification } from "#/parsers/index.js";
import {
  parseRequestedLanguages,
  resolveContentLanguages,
} from "#/parsers/languages.js";
import { uuidSchema } from "#/schemas.js";
import { XMLMapSourcesData as XMLMapSourcesDataSchema } from "#/xml/schemas.js";
import {
  compileOchreQuery,
  getContentLanguage,
  OCHRE_RESPONSE_PADDING,
  stringLiteral,
} from "#/xquery.js";

const REGEX_TILE_TEMPLATE_LEVEL = /\{(?:level|z)\}/i;
const REGEX_TILE_TEMPLATE_ROW = /\{(?:row|y)\}/i;
const REGEX_TILE_TEMPLATE_COLUMN = /\{(?:col|x)\}/i;
const REGEX_UNSUPPORTED_HOST = /(?:^|\.)google\.[a-z.]+$/i;
const REGEX_PORTAL_ITEM_PATH = /\/home\/(?:item|webmap\/viewer)\.html$/i;
const REGEX_PORTAL_ITEM_ID = /^[\da-f]{32}$/i;
const REGEX_WMTS_CAPABILITIES = /\/WMTSCapabilities\.xml$/i;
const REGEX_WMS_PATH = /\/wms(?:\/|$)/i;
const REGEX_FEATURE_SERVER = /\/FeatureServer(?:\/\d+)?\/?$/i;
const REGEX_MAP_SERVER = /\/MapServer(?:\/\d+)?\/?$/i;
const REGEX_IMAGE_SERVER = /\/ImageServer\/?$/i;
const REGEX_TRAILING_SLASH = /\/$/;
const REGEX_ARCGIS_SOAP_SERVICES = /\/arcgis\/services\//i;

/**
 * Classify the href of a webpage Resource as a geospatial web service
 * @param href - The Resource href
 * @returns The service layer, or null when the href names no supported service
 */
function parseServiceLayer(
  href: string,
):
  | {
      type:
        | "wmts"
        | "wms"
        | "web-tile"
        | `arcgis-${"feature" | "map" | "image"}`;
      url: string;
    }
  | { type: "arcgis-item"; itemId: string; portalUrl: string }
  | null {
  const trimmedHref = href.trim();
  const url = URL.parse(trimmedHref);
  if (url == null || REGEX_UNSUPPORTED_HOST.test(url.hostname)) {
    return null;
  }

  if (
    REGEX_TILE_TEMPLATE_LEVEL.test(trimmedHref) &&
    REGEX_TILE_TEMPLATE_ROW.test(trimmedHref) &&
    REGEX_TILE_TEMPLATE_COLUMN.test(trimmedHref)
  ) {
    return { type: "web-tile", url: trimmedHref };
  }

  let service: string | null = null;
  for (const [key, value] of url.searchParams) {
    if (key.toLowerCase() === "service") {
      service = value.toLowerCase();
    }
  }

  const itemId =
    url.searchParams.get("webmap") ??
    (REGEX_PORTAL_ITEM_PATH.test(url.pathname)
      ? url.searchParams.get("id")
      : null);
  if (itemId != null && REGEX_PORTAL_ITEM_ID.test(itemId)) {
    return { type: "arcgis-item", itemId, portalUrl: url.origin };
  }

  const baseUrl = `${url.origin}${url.pathname.replace(REGEX_TRAILING_SLASH, "")}`;
  const restUrl = baseUrl.replace(
    REGEX_ARCGIS_SOAP_SERVICES,
    "/arcgis/rest/services/",
  );
  if (service === "wmts") {
    return { type: "wmts", url: baseUrl };
  }
  if (REGEX_WMTS_CAPABILITIES.test(url.pathname)) {
    return { type: "wmts", url: trimmedHref };
  }
  if (service === "wms" || REGEX_WMS_PATH.test(url.pathname)) {
    return { type: "wms", url: baseUrl };
  }
  if (REGEX_FEATURE_SERVER.test(url.pathname)) {
    return { type: "arcgis-feature", url: restUrl };
  }
  if (REGEX_MAP_SERVER.test(url.pathname)) {
    return { type: "arcgis-map", url: restUrl };
  }
  if (REGEX_IMAGE_SERVER.test(url.pathname)) {
    return { type: "arcgis-image", url: restUrl };
  }

  return null;
}

/**
 * Build the layer a Set, Tree or Resource of a map's layer list stands for
 * @param member - The linked Set, Tree or Resource
 * @param languages - The languages to parse
 * @returns The layer, or null when a Resource names no supported service
 */
function parseMapLayer(
  member: XMLMapSource | XMLMapLayer,
  languages: ReadonlyArray<string>,
): MapLayer<ReadonlyArray<string>> | null {
  const { label } = parseIdentification(member.identification, { languages });

  if (member.category === "set" || member.category === "tree") {
    return {
      type: member.category === "set" ? "ochre-set" : "ochre-tree",
      uuid: member.uuid,
      label,
      wkid: member.WKID ?? null,
    };
  }

  const service =
    "href" in member && member.href != null
      ? parseServiceLayer(member.href)
      : null;

  return service == null ? null : { ...service, uuid: member.uuid, label };
}

/**
 * Fetches the layers a map draws from the Sets and Trees it links to
 *
 * A linked Set holding only Sets, Trees and Resources is a layer list: each
 * linked Set or Tree becomes an OCHRE layer and each webpage Resource whose
 * href points at a geospatial web service becomes a service layer. Any other
 * linked Set or Tree is drawn as one OCHRE layer itself. The variant is
 * `"arcgis"` when any service layer is present, else `"maplibre-gl"`.
 *
 * @param uuids - The UUIDs of the Sets and Trees the map links to, in order
 * @param options - Options for the fetch
 * @param options.languages - Language codes to parse
 * @param options.fetch - The fetch function to use
 * @returns The map variant and layers, or an error if the fetch/parse fails
 */
export async function fetchMapLayers<
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  uuids: Array<string>,
  options?: FetchBaseOptions<TLanguages>,
): Promise<
  | {
      variant: "maplibre-gl" | "arcgis";
      layers: Array<MapLayer<FetchLanguages<TLanguages>>>;
      error: null;
      detailedError: null;
    }
  | { variant: null; layers: null; error: string; detailedError: string }
>;
export async function fetchMapLayers(
  uuids: Array<string>,
  options?: FetchRuntimeOptions,
): Promise<
  | {
      variant: "maplibre-gl" | "arcgis";
      layers: Array<MapLayer<ReadonlyArray<string>>>;
      error: null;
      detailedError: null;
    }
  | { variant: null; layers: null; error: string; detailedError: string }
> {
  try {
    const parsedUuids = v.parse(
      v.pipe(
        v.array(uuidSchema),
        v.minLength(1, "At least one map link UUID is required"),
      ),
      uuids,
    );

    const output = await requestOchre({
      xquery: compileOchreQuery({
        contentLanguage: getContentLanguage(options),
        body: () => `<ochre>${OCHRE_RESPONSE_PADDING}<mapSources>{
  for $uuid in (${parsedUuids.map((uuid) => stringLiteral(uuid)).join(", ")})
  let $set := fn:collection("ochre/set")/ochre[@uuid = $uuid]/set
  let $source := if (exists($set)) then $set else fn:collection("ochre/tree")/ochre[@uuid = $uuid]/tree
  let $members := $set/items/*
  let $layers := $members[self::set or self::tree or self::resource]
  where exists($source)
  return <mapSource uuid="{$uuid}" category="{local-name($source[1])}">{
    $source[1]/@WKID,
    $source[1]/identification,
    if (exists($members) and count($layers) = count($members))
    then
      for $layer in $layers
      let $layerUuid := $layer/@uuid/string()
      return <mapLayer uuid="{$layerUuid}" category="{local-name($layer)}">{
        $layer/@type,
        $layer/@href,
        if (local-name($layer) = "set")
        then fn:collection("ochre/set")/ochre[@uuid = $layerUuid]/set[1]/@WKID
        else (),
        $layer/identification
      }</mapLayer>
    else ()
  }</mapSource>
}</mapSources></ochre>`,
      }),
      schema: XMLMapSourcesDataSchema,
      label: "OCHRE map layers",
      options,
    });

    const languages = resolveContentLanguages(
      output.result.ochre.mapSources,
      parseRequestedLanguages(options?.languages),
    );

    const layers: Array<MapLayer<ReadonlyArray<string>>> = [];
    const layerUuids = new Set<string>();
    const sources = output.result.ochre.mapSources.mapSource ?? [];
    for (const source of sources) {
      const sourceLayers: Array<MapLayer<ReadonlyArray<string>>> = [];
      const members = source.mapLayer ?? [source];
      for (const member of members) {
        const layer = parseMapLayer(member, languages);
        if (layer != null) {
          sourceLayers.push(layer);
        }
      }

      const mapServerUrls = sourceLayers.flatMap((layer) =>
        layer.type === "arcgis-map" ? [`${layer.url}/`] : [],
      );
      for (const layer of sourceLayers) {
        const isMapServerDuplicate =
          layer.type === "wmts" &&
          mapServerUrls.some((url) => layer.url.startsWith(url));
        if (!isMapServerDuplicate && !layerUuids.has(layer.uuid)) {
          layerUuids.add(layer.uuid);
          layers.push(layer);
        }
      }
    }

    return {
      variant: layers.some(
        (layer) => layer.type !== "ochre-set" && layer.type !== "ochre-tree",
      )
        ? "arcgis"
        : "maplibre-gl",
      layers,
      error: null,
      detailedError: null,
    };
  } catch (error) {
    return {
      variant: null,
      layers: null,
      ...getErrorOutput(error, "Failed to fetch map layers"),
    };
  }
}

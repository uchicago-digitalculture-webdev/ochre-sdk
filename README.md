# OCHRE SDK

`ochre-sdk` is a TypeScript package for reading data from
[OCHRE](https://ochre.uchicago.edu/) (Online Cultural and Historical Research
Environment). It fetches OCHRE XML/XQuery responses, validates the payloads, and
parses them into typed objects that are easier to use in web applications,
digital collections, and research tools.

The package focuses on the public OCHRE v2 API and exposes higher-level helpers
for items, linked items, galleries, Set search results, Set facets, website
presentation records, multilingual text, and property access.

## Installation

```sh
npm install ochre-sdk
```

Use the equivalent command for your package manager if you do not use npm.

`ochre-sdk` is published as an ESM package. The runtime must provide `fetch`, or
you can pass a custom fetch implementation through each fetcher's `options.fetch`
field.

## Quick Start

```ts
import { fetchItem } from "ochre-sdk";

const result = await fetchItem("<item-uuid>", {
  category: "resource",
  languages: ["eng"],
});

if (result.error != null) {
  throw new Error("Failed to fetch item", { cause: result.error });
}

console.log(result.item.identification.label.getText("eng"));
```

Every fetcher returns a success/error object. On success, the parsed value is
present and `error` is `null`; on failure, the parsed value is `null` and
`error` contains the message.

## Core API

- `fetchItem(uuid, options)` fetches and parses a single OCHRE item. Passing
  `category` as a single category narrows the returned TypeScript type to that
  category; passing an array narrows it to any category in that list and lets the
  parser resolve the actual category from the payload. `containedItemCategory`
  controls how nested Tree or Set contents are parsed. For large recursive item
  categories, pass `shouldOmitEmbeddedItems: true` to fetch the top-level item
  without its embedded item hierarchy.
- `fetchItemChildren(uuid, options)` fetches only the direct child items for an
  OCHRE item UUID. Passing
  `category` lets the XQuery search only the matching OCHRE collection.
- `fetchItemLinks(uuid, options)` fetches items linked from a source item and
  parses them as embedded OCHRE items.
- `fetchItemOcrData(uuid, value, options)` fetches the positioned OCR strings of
  an item that match a search value, for drawing hit boxes over a scanned page.
- `fetchGallery(params, options)` fetches paginated resource galleries with an
  optional label filter.
- `fetchWebsite(abbreviation, options)` fetches an OCHRE website presentation
  record, including pages, segments, components, navigation, footer, sidebar,
  style, collection, and item-page configuration.
- `fetchSetItems(params, containedItemCategories, options)` fetches paginated
  Set search results with typed query and sort support.
- `fetchSetPropertyValues(params, options)` fetches Set property-value facets
  and optional bibliography/period attribute facets for the same query model.

## Multilingual Text

OCHRE text fields are represented with `MultilingualString`. It preserves plain
text and rich text renderings, supports language fallback, and exposes helpers
for exact-language access when consumers need stricter behavior.

```ts
const title = result.item.identification.label;

title.getText("eng");
title.getRichText("eng");
title.getExactText("tur");
title.getAvailableLanguages();
```

For reusable language tuples, use `defineLanguages` to keep runtime validation
and literal TypeScript inference together.

```ts
import { defineLanguages, fetchWebsite } from "ochre-sdk";

const languages = defineLanguages("eng", "tur");
const result = await fetchWebsite("uchicago-node", { languages });
```

## Set Queries

Set fetchers accept a recursive `Query` tree. Leaf queries can target full text,
specific fields, property values, bibliographies, periods, notes, images, and
other supported OCHRE search surfaces.

```ts
import { fetchSetItems, type Query } from "ochre-sdk";

const queries: Query = {
  target: "string",
  value: "Chicago",
  matchMode: "includes",
  isCaseSensitive: false,
  language: "eng",
};

const result = await fetchSetItems(
  { setScopeUuids: ["<set-uuid>"], queries, page: 1, pageSize: 48 },
  ["resource", "bibliography"],
  { languages: ["eng"] },
);
```

Use `fetchSetPropertyValues` with the same query shape when you need facet data
for a filtered result set.

### OCR Text Queries

The `ocr` target searches the OCR text layer of the Resource items in a Set. It takes no `language`, because OCR text carries none.

```ts
const queries: Query = {
  and: [
    {
      target: "ocr",
      value: "Cappaert",
      matchMode: "includes",
      isCaseSensitive: false,
    },
    {
      target: "title",
      value: "Convocation",
      matchMode: "includes",
      isCaseSensitive: false,
      language: "eng",
    },
  ],
};
```

Every word node in that layer holds a single OCR word in its `CONTENT` attribute, so `includes` matches each search term as its own word anywhere in the layer, in any order, with `*` and `?` wildcards supported. `exact` instead matches the terms as a run of adjacent whole words, so `"THE COLLEGE"` matches a page carrying that phrase but not one where the two words merely appear apart. An item matches when the OCR layer of the item itself or of any of its child Resources matches.

Set item projections do not carry the OCR layer, so an `ocr` leaf is resolved by an extra index-only search over the Resource documents whose matching UUIDs are then joined back onto the Set items. It still composes with `and`, `or`, and `isNegated` like any other leaf, and repeating the same OCR search inside one tree only costs one search.

## OCR Data

A Resource may carry an `<ocr>` layer holding the positioned output of an OCR run. The node hierarchy inside that layer is irregular and is not parsed, but any word node within it, at any depth, is read as one positioned OCR string. A word node is any element named `string` in any casing and any namespace, and its text comes from the `CONTENT` attribute rather than from the element's text content.

```ts
import { fetchItemOcrData } from "ochre-sdk";

const result = await fetchItemOcrData("<item-uuid>", "Artifact", {
  matchMode: "exact",
});

for (const ocrString of result.ocrStrings ?? []) {
  console.log(ocrString.content, ocrString.x, ocrString.y, ocrString.vertices);
}
```

`x` and `y` come from `HPOS` and `VPOS` and give the top-left corner of the box, `width` and `height` its size, and `vertices` comes from `VERTICES` and is its full bounding polygon, which is not always rectangular. Each geometry field is null when the source attribute is absent or unparseable, and `vertices` is then empty. `resourceUuid` names the Resource that owns the OCR layer, which differs from the requested item when the OCR lives on a child Resource.

Matching defaults to case-insensitive `includes` and runs against each string's `CONTENT`. Because a `<string>` holds a single OCR word, a multi-word search value is split on whitespace and a string is returned when it matches any one term. Requesting an item that does not exist is an error; an item with no OCR layer, or no matches, returns an empty array.

## Helpers And Types

The root export includes the SDK's public TypeScript model, website component
types, query types, property getters, and small data helpers:

- `Item`, `SetItem`, `ItemLink`, `Website`, `WebElementOf`,
  `WebElementComponentOf`, `WebBlockByLayout`, `Query`, and related types.
- `getPropertyByVariableUuid`, `getPropertyValueContentByVariableUuid`,
  `getPropertyByVariableLabel`, `getUniqueProperties`, `filterProperties`, and
  related property helpers.
- `flattenItemProperties` and `DEFAULT_PAGE_SIZE` for common collection UI
  workflows.

## Development

The package source lives in `src/`, and `src/index.ts` is the public entrypoint.
Published files are generated into `dist/`. See `package.json` for the
available repository scripts.

## License

[MIT](LICENSE)

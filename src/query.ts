import type {
  PropertyRelation,
  Query,
  QueryGroup,
  QueryLeaf,
} from "#/types/index.js";
import { BELONGS_TO_COLLECTION_UUID } from "#/constants.js";
import {
  buildOcrWordPath,
  OCR_LAYER_ELEMENT_NAME,
  OCR_WORD_CONTENT_ATTRIBUTE,
  OCR_WORD_QNAMES,
} from "#/ocr.js";
import { stringLiteral, SUPPLEMENTAL_XQUERY_PROLOG } from "#/utilities.js";

const CTS_INCLUDES_STOP_WORDS = new Set<string>([
  "and",
  "at",
  "in",
  "it",
  "of",
  "the",
  "to",
]);
const CTS_INCLUDES_TOKEN_WORD_REGEX = /^\p{L}+$/u;
const CTS_INCLUDES_TOKEN_REGEX = /[\p{L}\p{N}*?]+/gu;
const CTS_EXACT_TEXT_TOKEN_REGEX = /[\p{L}\p{N}]+/gu;

type QueryMatchMode = "includes" | "exact";
type CtsQueryFamily = "text" | "raw";
type TextTargetQuery = Extract<
  QueryLeaf,
  {
    target:
      | "title"
      | "description"
      | "image"
      | "periods"
      | "bibliography"
      | "notes";
  }
>;
type ContentTextTarget = Exclude<TextTargetQuery["target"], "notes">;
type PropertyQuery = Extract<QueryLeaf, { target: "property" }>;
type AllPropertyQuery = Extract<PropertyQuery, { dataType: "all" }>;
type OcrQuery = Extract<QueryLeaf, { target: "ocr" }>;
type CtsQueryLeaf = Exclude<QueryLeaf, OcrQuery>;

type OcrBinding = { name: string; expression: string };

/**
 * A search over the Set items, optionally narrowed by item path predicates.
 * Predicates carry the OCR joins, which only ever AND, so anything a predicate
 * cannot express becomes a `union`/`intersect` of plans instead.
 */
type ItemsSearchPlan = {
  kind: "search";
  itemPredicates: Array<string>;
  queryExpressions: Array<string>;
};

type ItemsPlan =
  | ItemsSearchPlan
  | { kind: "union" | "intersect"; children: Array<ItemsPlan> };

type QueryCompilerContext = {
  nextHelperSerial: number;
  helperNamesByKey: Map<string, string>;
  helperDeclarations: Array<string>;
  ocrBindingNamesByKey: Map<string, string>;
  ocrBindings: Array<OcrBinding>;
  baseItemsExpression: string;
};

type QueryHelperRegistration = { name: string; callExpression: string };

type ParameterizedQueryHelperRegistration = {
  name: string;
  call: (valueExpression: string) => string;
};

const CONTENT_TARGET_CONTENT_ELEMENT_PATHS: Record<
  ContentTextTarget,
  Array<string>
> = {
  title: ["identification", "label", "content"],
  description: ["description", "content"],
  image: ["image", "identification", "label", "content"],
  periods: ["periods", "period", "identification", "label", "content"],
  bibliography: [
    "bibliographies",
    "bibliography",
    "identification",
    "label",
    "content",
  ],
};

/**
 * A search value as it travels through the query builders
 *
 * `text` drives tokenization and the wildcard/stemming classification, while
 * `expression` is what the emitted XQuery carries. They come apart inside a
 * parameterized helper, whose body has to reference the helper's `$value`
 * parameter while still being classified from the sample term it was built for.
 */
type QuerySearchValue = { text: string; expression: string };

const HELPER_SEARCH_VALUE_REFERENCE = "$value";

function searchValue(text: string): QuerySearchValue {
  return { text, expression: stringLiteral(text) };
}

function referencedSearchValue(text: string): QuerySearchValue {
  return { text, expression: HELPER_SEARCH_VALUE_REFERENCE };
}

function tokenizeIncludesSearchValue(parameters: {
  value: string;
  isCaseSensitive: boolean;
}): Array<string> {
  const { value, isCaseSensitive } = parameters;
  const tokenSource = isCaseSensitive ? value : value.toLowerCase();
  const rawTerms = tokenSource.match(CTS_INCLUDES_TOKEN_REGEX) ?? [];
  const terms: Array<string> = [];

  for (const term of rawTerms) {
    const hasWildcard = term.includes("*") || term.includes("?");

    if (hasWildcard) {
      const wildcardStrippedTerm = term.replaceAll(/[*?]/g, "");

      if (wildcardStrippedTerm !== "") {
        terms.push(term);
      }

      continue;
    }

    const normalizedTerm = term.toLowerCase();

    if (normalizedTerm !== "" && !CTS_INCLUDES_STOP_WORDS.has(normalizedTerm)) {
      terms.push(term);
    }
  }

  return terms;
}

function tokenizeExactTextSearchValue(parameters: {
  value: string;
  isCaseSensitive: boolean;
}): Array<string> {
  const { value, isCaseSensitive } = parameters;
  const tokenSource = isCaseSensitive ? value : value.toLowerCase();
  const rawTerms = tokenSource.match(CTS_EXACT_TEXT_TOKEN_REGEX) ?? [];
  const terms: Array<string> = [];

  for (const term of rawTerms) {
    if (term !== "") {
      terms.push(term);
    }
  }

  return terms;
}

function hasWildcardCharacters(value: string): boolean {
  return value.includes("*") || value.includes("?");
}

function getWildcardStrippedValue(value: string): string {
  return value.replaceAll(/[*?]/g, "");
}

function shouldUseStemmedTextSearch(value: string): boolean {
  const wildcardStrippedValue = getWildcardStrippedValue(value);

  return (
    wildcardStrippedValue.length >= 3 &&
    CTS_INCLUDES_TOKEN_WORD_REGEX.test(wildcardStrippedValue)
  );
}

function shouldUseFullValueFallbackForIncludes(parameters: {
  value: string;
  isCaseSensitive: boolean;
  terms: Array<string>;
}): boolean {
  const { value, isCaseSensitive, terms } = parameters;

  if (terms.length <= 1) {
    return false;
  }

  const tokenSource = isCaseSensitive ? value : value.toLowerCase();

  if (/[^\p{L}\p{N}\s*?]/u.test(tokenSource)) {
    return true;
  }

  const rawSpaceTerms = tokenSource.trim().split(/\s+/u).filter(Boolean);

  if (rawSpaceTerms.length !== terms.length) {
    return true;
  }

  for (const rawTerm of rawSpaceTerms) {
    const wildcardStrippedTerm = getWildcardStrippedValue(rawTerm);

    if (hasWildcardCharacters(rawTerm)) {
      return true;
    }

    if (!CTS_INCLUDES_TOKEN_WORD_REGEX.test(wildcardStrippedTerm)) {
      return true;
    }

    if (CTS_INCLUDES_STOP_WORDS.has(rawTerm.toLowerCase())) {
      return true;
    }
  }

  for (const [index, rawTerm] of rawSpaceTerms.entries()) {
    if (rawTerm !== (terms[index] ?? "")) {
      return true;
    }
  }

  return false;
}

function buildWordQueryOptionsExpression(parameters: {
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  queryFamily?: CtsQueryFamily;
  language?: string;
  isWildcarded?: boolean;
  isStemmed?: boolean;
}): string {
  const { matchMode, isCaseSensitive, queryFamily, language, isWildcarded } =
    parameters;
  const { isStemmed } = parameters;
  const options: Array<string> = [
    isCaseSensitive ? "case-sensitive" : "case-insensitive",
    matchMode === "exact" ? "diacritic-sensitive" : "diacritic-insensitive",
    matchMode === "exact" ? "punctuation-sensitive" : "punctuation-insensitive",
    matchMode === "exact" ? "whitespace-sensitive" : "whitespace-insensitive",
  ];

  if (matchMode === "exact") {
    options.push("unstemmed", "unwildcarded");
  } else if (queryFamily === "text") {
    options.push(
      isStemmed ? "stemmed" : "unstemmed",
      isWildcarded ? "wildcarded" : "unwildcarded",
    );

    if (isStemmed && language !== "" && language != null) {
      options.push(`lang=${language}`);
    }
  }

  return `(${options.map((option) => stringLiteral(option)).join(", ")})`;
}

function buildRichTextPhraseOptionsExpression(parameters: {
  isCaseSensitive: boolean;
}): string {
  const { isCaseSensitive } = parameters;
  const options: Array<string> = [
    isCaseSensitive ? "case-sensitive" : "case-insensitive",
    "diacritic-sensitive",
    "punctuation-insensitive",
    "whitespace-insensitive",
    "unstemmed",
    "unwildcarded",
  ];

  return `(${options.map((option) => stringLiteral(option)).join(", ")})`;
}

function buildCtsWordQueryExpression(parameters: {
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  queryFamily?: CtsQueryFamily;
  language?: string;
}): string {
  const { value, matchMode, isCaseSensitive, queryFamily, language } =
    parameters;
  const isWildcarded =
    matchMode === "includes" && hasWildcardCharacters(value.text);
  const isStemmed =
    matchMode === "includes" &&
    queryFamily === "text" &&
    !isWildcarded &&
    shouldUseStemmedTextSearch(value.text);

  return `cts:word-query(${value.expression}, ${buildWordQueryOptionsExpression({ matchMode, isCaseSensitive, queryFamily, language, isWildcarded, isStemmed })})`;
}

function buildRichTextPhraseQueryExpression(parameters: {
  value: QuerySearchValue;
  isCaseSensitive: boolean;
}): string {
  const { value, isCaseSensitive } = parameters;

  return `cts:word-query(${value.expression}, ${buildRichTextPhraseOptionsExpression({ isCaseSensitive })})`;
}

function buildRichTextExactQueryExpression(parameters: {
  value: QuerySearchValue;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { value, isCaseSensitive } = parameters;
  const phraseQuery = buildRichTextPhraseQueryExpression({
    value,
    isCaseSensitive,
  });
  const terms = tokenizeExactTextSearchValue({
    value: value.text,
    isCaseSensitive,
  });

  if (terms.length <= 1) {
    return phraseQuery;
  }

  const tokenAndQuery = buildAndCtsQueryExpressionInternal(
    terms.map((term) =>
      buildRichTextPhraseQueryExpression({
        value: searchValue(term),
        isCaseSensitive,
      }),
    ),
  );

  return buildOrCtsQueryExpressionInternal([phraseQuery, tokenAndQuery]);
}

function buildCtsElementWordQueryExpression(parameters: {
  elementName: string;
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  queryFamily?: CtsQueryFamily;
  language?: string;
}): string {
  const {
    elementName,
    value,
    matchMode,
    isCaseSensitive,
    queryFamily,
    language,
  } = parameters;
  const isWildcarded =
    matchMode === "includes" && hasWildcardCharacters(value.text);
  const isStemmed =
    matchMode === "includes" &&
    queryFamily === "text" &&
    !isWildcarded &&
    shouldUseStemmedTextSearch(value.text);

  return `cts:element-word-query(xs:QName("${elementName}"), ${value.expression}, ${buildWordQueryOptionsExpression({ matchMode, isCaseSensitive, queryFamily, language, isWildcarded, isStemmed })})`;
}

function buildCtsElementAttributeWordQueryExpression(parameters: {
  elementName: string;
  attributeName: string;
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  queryFamily?: CtsQueryFamily;
  language?: string;
}): string {
  const {
    elementName,
    attributeName,
    value,
    matchMode,
    isCaseSensitive,
    queryFamily,
    language,
  } = parameters;
  const isWildcarded =
    matchMode === "includes" && hasWildcardCharacters(value.text);
  const isStemmed =
    matchMode === "includes" &&
    queryFamily === "text" &&
    !isWildcarded &&
    shouldUseStemmedTextSearch(value.text);

  return `cts:element-attribute-word-query(xs:QName("${elementName}"), xs:QName("${attributeName}"), ${value.expression}, ${buildWordQueryOptionsExpression({ matchMode, isCaseSensitive, queryFamily, language, isWildcarded, isStemmed })})`;
}

function buildCtsElementValueQueryExpression(parameters: {
  elementName: string;
  value: QuerySearchValue;
  isCaseSensitive: boolean;
}): string {
  const { elementName, value, isCaseSensitive } = parameters;

  return `cts:element-value-query(xs:QName("${elementName}"), ${value.expression}, ${buildWordQueryOptionsExpression({ matchMode: "exact", isCaseSensitive })})`;
}

function buildCtsElementAttributeValueQueryExpression(parameters: {
  elementName: string;
  attributeName: string;
  value: QuerySearchValue;
  isCaseSensitive: boolean;
}): string {
  const { elementName, attributeName, value, isCaseSensitive } = parameters;

  return `cts:element-attribute-value-query(xs:QName("${elementName}"), xs:QName("${attributeName}"), ${value.expression}, ${buildWordQueryOptionsExpression({ matchMode: "exact", isCaseSensitive })})`;
}

function buildPlainElementAttributeValueQueryExpression(parameters: {
  elementName: string;
  attributeName: string;
  value: QuerySearchValue;
}): string {
  const { elementName, attributeName, value } = parameters;

  return `cts:element-attribute-value-query(xs:QName("${elementName}"), xs:QName("${attributeName}"), ${value.expression})`;
}

function buildNestedElementQuery(
  elementNames: Array<string>,
  queryExpression: string,
): string {
  let wrappedQueryExpression = queryExpression;

  for (const elementName of elementNames.toReversed()) {
    wrappedQueryExpression = `cts:element-query(xs:QName("${elementName}"), ${wrappedQueryExpression})`;
  }

  return wrappedQueryExpression;
}

function buildNotCtsQueryExpression(queryExpression: string): string {
  return `cts:not-query(${queryExpression})`;
}

function buildAndCtsQueryExpressionInternal(
  queryExpressions: Array<string>,
): string {
  if (queryExpressions.length === 0) {
    return "cts:true-query()";
  }

  if (queryExpressions.length === 1) {
    return queryExpressions[0] ?? "cts:true-query()";
  }

  return `cts:and-query((${queryExpressions.join(", ")}))`;
}

function buildOrCtsQueryExpressionInternal(
  queryExpressions: Array<string>,
): string {
  if (queryExpressions.length === 0) {
    return "cts:false-query()";
  }

  if (queryExpressions.length === 1) {
    return queryExpressions[0] ?? "cts:false-query()";
  }

  return `cts:or-query((${queryExpressions.join(", ")}))`;
}

function buildAndCtsQueryExpression(
  queryExpressions: Array<string>,
): string | null {
  if (queryExpressions.length === 0) {
    return null;
  }

  return buildAndCtsQueryExpressionInternal(queryExpressions);
}

function buildContentLanguageQuery(language: string): string {
  return buildPlainElementAttributeValueQueryExpression({
    elementName: "content",
    attributeName: "xml:lang",
    value: searchValue(language),
  });
}

function buildPropertyLabelQuery(propertyVariable: string): string {
  return buildPlainElementAttributeValueQueryExpression({
    elementName: "label",
    attributeName: "uuid",
    value: searchValue(propertyVariable),
  });
}

function buildValueNotIdReferenceQuery(): string {
  return buildNotCtsQueryExpression(
    buildPlainElementAttributeValueQueryExpression({
      elementName: "value",
      attributeName: "dataType",
      value: searchValue("IDREF"),
    }),
  );
}

function buildRichTextContentQueryExpression(parameters: {
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { value, matchMode, isCaseSensitive, language } = parameters;

  return buildAndCtsQueryExpressionInternal([
    buildContentLanguageQuery(language),
    matchMode === "exact"
      ? buildRichTextExactQueryExpression({ value, isCaseSensitive, language })
      : buildCtsWordQueryExpression({
          value,
          matchMode,
          isCaseSensitive,
          queryFamily: "text",
          language,
        }),
  ]);
}

function buildValueContentInnerQuery(parameters: {
  language: string;
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { language, value, matchMode, isCaseSensitive } = parameters;

  return buildNestedElementQuery(
    ["content"],
    buildRichTextContentQueryExpression({
      language,
      value,
      matchMode,
      isCaseSensitive,
    }),
  );
}

function buildValueContentExactInnerQuery(parameters: {
  language: string;
  value: QuerySearchValue;
  isCaseSensitive: boolean;
}): string {
  const { language, value, isCaseSensitive } = parameters;

  return buildNestedElementQuery(
    ["content"],
    buildAndCtsQueryExpressionInternal([
      buildContentLanguageQuery(language),
      buildCtsElementValueQueryExpression({
        elementName: "string",
        value,
        isCaseSensitive,
      }),
    ]),
  );
}

function buildValueDirectTextInnerQuery(parameters: {
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { value, matchMode, isCaseSensitive } = parameters;
  const directTextQuery =
    matchMode === "exact"
      ? buildCtsElementValueQueryExpression({
          elementName: "value",
          value,
          isCaseSensitive,
        })
      : buildCtsElementWordQueryExpression({
          elementName: "value",
          value,
          matchMode,
          isCaseSensitive,
          queryFamily: "raw",
        });

  return buildAndCtsQueryExpressionInternal([
    buildNotCtsQueryExpression(
      buildNestedElementQuery(["content"], "cts:true-query()"),
    ),
    directTextQuery,
  ]);
}

function buildValueRawValueInnerQuery(parameters: {
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { value, matchMode, isCaseSensitive } = parameters;

  if (matchMode === "exact") {
    return buildCtsElementAttributeValueQueryExpression({
      elementName: "value",
      attributeName: "rawValue",
      value,
      isCaseSensitive,
    });
  }

  return buildCtsElementAttributeWordQueryExpression({
    elementName: "value",
    attributeName: "rawValue",
    value,
    matchMode,
    isCaseSensitive,
    queryFamily: "raw",
  });
}

function buildNotesQueryExpression(parameters: {
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { value, matchMode, isCaseSensitive, language } = parameters;

  return buildNestedElementQuery(
    ["notes", "note", "content"],
    buildRichTextContentQueryExpression({
      value,
      matchMode,
      isCaseSensitive,
      language,
    }),
  );
}

function buildContentTargetQueryExpression(parameters: {
  target: ContentTextTarget;
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { target, value, matchMode, isCaseSensitive, language } = parameters;
  const contentElementPath = CONTENT_TARGET_CONTENT_ELEMENT_PATHS[target];

  return buildNestedElementQuery(
    contentElementPath,
    buildRichTextContentQueryExpression({
      value,
      matchMode,
      isCaseSensitive,
      language,
    }),
  );
}

function buildPropertyQueryExpression(parameters: {
  propertyVariable?: string;
  propertyRelation?: PropertyRelation;
  queryExpression: string;
}): string {
  const { propertyVariable, propertyRelation, queryExpression } = parameters;
  const propertyQueryExpressions: Array<string> = [queryExpression];

  if (propertyVariable != null) {
    propertyQueryExpressions.unshift(buildPropertyLabelQuery(propertyVariable));
  }

  if (propertyRelation != null) {
    propertyQueryExpressions.unshift(
      buildPlainElementAttributeValueQueryExpression({
        elementName: "label",
        attributeName: "relation",
        value: searchValue(propertyRelation),
      }),
    );
  }

  return buildNestedElementQuery(
    ["properties", "property"],
    buildAndCtsQueryExpressionInternal(propertyQueryExpressions),
  );
}

function buildPropertyTextMatchQueryExpression(parameters: {
  propertyVariable?: string;
  propertyRelation?: PropertyRelation;
  valueFilters?: Array<string>;
  contentQueryExpression?: string;
  rawValueQueryExpression?: string;
  bareValueQueryExpression?: string;
}): string {
  const {
    propertyVariable,
    propertyRelation,
    valueFilters = [],
    contentQueryExpression,
    rawValueQueryExpression,
    bareValueQueryExpression,
  } = parameters;
  const letBindings: Array<string> = [];
  const valueMatchReferences: Array<string> = [];

  if (contentQueryExpression != null) {
    letBindings.push(`let $contentQuery := ${contentQueryExpression}`);
    valueMatchReferences.push("$contentQuery");
  }

  if (rawValueQueryExpression != null) {
    letBindings.push(`let $rawValueQuery := ${rawValueQueryExpression}`);
    valueMatchReferences.push("$rawValueQuery");
  }

  if (bareValueQueryExpression != null) {
    letBindings.push(`let $bareValueQuery := ${bareValueQueryExpression}`);
    valueMatchReferences.push("$bareValueQuery");
  }

  const valueQueryExpressions = [...valueFilters];

  if (valueMatchReferences.length > 0) {
    valueQueryExpressions.push(
      buildOrCtsQueryExpressionInternal(valueMatchReferences),
    );
  }

  const propertyQueryExpressions: Array<string> = [];

  if (propertyVariable != null) {
    propertyQueryExpressions.push(buildPropertyLabelQuery(propertyVariable));
  }

  if (propertyRelation != null) {
    propertyQueryExpressions.push(
      buildPlainElementAttributeValueQueryExpression({
        elementName: "label",
        attributeName: "relation",
        value: searchValue(propertyRelation),
      }),
    );
  }

  propertyQueryExpressions.push(
    buildNestedElementQuery(
      ["value"],
      buildAndCtsQueryExpressionInternal(valueQueryExpressions),
    ),
  );

  const propertyQueryExpression = buildNestedElementQuery(
    ["properties", "property"],
    buildAndCtsQueryExpressionInternal(propertyQueryExpressions),
  );

  if (letBindings.length === 0) {
    return propertyQueryExpression;
  }

  return `(${letBindings.join("\n  ")}\n  return ${propertyQueryExpression})`;
}

function buildPropertyPresenceQueryExpression(parameters: {
  propertyVariable?: string;
  propertyRelation?: PropertyRelation;
}): string {
  return buildPropertyQueryExpression({
    propertyVariable: parameters.propertyVariable,
    propertyRelation: parameters.propertyRelation,
    queryExpression: "cts:true-query()",
  });
}

function buildPropertyStringQueryExpression(parameters: {
  propertyVariable?: string;
  propertyRelation?: PropertyRelation;
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const {
    propertyVariable,
    propertyRelation,
    value,
    matchMode,
    isCaseSensitive,
    language,
  } = parameters;

  return buildPropertyTextMatchQueryExpression({
    propertyVariable,
    propertyRelation,
    contentQueryExpression:
      matchMode === "exact"
        ? buildValueContentExactInnerQuery({ language, value, isCaseSensitive })
        : buildValueContentInnerQuery({
            language,
            value,
            matchMode,
            isCaseSensitive,
          }),
    rawValueQueryExpression: buildValueRawValueInnerQuery({
      value,
      matchMode,
      isCaseSensitive,
    }),
    bareValueQueryExpression: buildValueDirectTextInnerQuery({
      value,
      matchMode,
      isCaseSensitive,
    }),
  });
}

function buildPropertyScalarQueryExpression(parameters: {
  propertyVariable?: string;
  propertyRelation?: PropertyRelation;
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const {
    propertyVariable,
    propertyRelation,
    value,
    matchMode,
    isCaseSensitive,
  } = parameters;

  return buildPropertyQueryExpression({
    propertyVariable,
    propertyRelation,
    queryExpression: buildNestedElementQuery(
      ["value"],
      buildOrCtsQueryExpressionInternal([
        buildValueRawValueInnerQuery({ value, matchMode, isCaseSensitive }),
        buildValueDirectTextInnerQuery({ value, matchMode, isCaseSensitive }),
      ]),
    ),
  });
}

function buildPropertyAllQueryExpression(parameters: {
  query: AllPropertyQuery;
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
}): string {
  const { query, value, matchMode } = parameters;

  return buildPropertyTextMatchQueryExpression({
    propertyVariable: query.propertyVariable,
    propertyRelation: query.propertyRelation,
    valueFilters: [buildValueNotIdReferenceQuery()],
    contentQueryExpression: buildValueContentInnerQuery({
      language: query.language,
      value,
      matchMode,
      isCaseSensitive: query.isCaseSensitive,
    }),
    rawValueQueryExpression: buildValueRawValueInnerQuery({
      value,
      matchMode,
      isCaseSensitive: query.isCaseSensitive,
    }),
    bareValueQueryExpression: buildValueDirectTextInnerQuery({
      value,
      matchMode,
      isCaseSensitive: query.isCaseSensitive,
    }),
  });
}

function buildPropertyIdReferenceQueryExpression(parameters: {
  propertyVariable?: string;
  propertyRelation?: PropertyRelation;
  value: QuerySearchValue;
}): string {
  const { propertyVariable, propertyRelation, value } = parameters;

  return buildPropertyQueryExpression({
    propertyVariable,
    propertyRelation,
    queryExpression: buildNestedElementQuery(
      ["value"],
      buildPlainElementAttributeValueQueryExpression({
        elementName: "value",
        attributeName: "uuid",
        value,
      }),
    ),
  });
}

function buildPropertyDateRangeQueryExpression(
  query: Extract<
    PropertyQuery,
    { dataType: "date" | "dateTime"; from?: string; to?: string }
  >,
): string {
  const rangeQueryExpressions: Array<string> = [];

  if (query.from != null) {
    rangeQueryExpressions.push(
      `cts:element-attribute-range-query(xs:QName("value"), xs:QName("rawValue"), ">=", ${stringLiteral(query.from)})`,
    );
  }

  if (query.to != null) {
    rangeQueryExpressions.push(
      `cts:element-attribute-range-query(xs:QName("value"), xs:QName("rawValue"), "<=", ${stringLiteral(query.to)})`,
    );
  }

  return buildPropertyQueryExpression({
    propertyVariable: query.propertyVariable,
    propertyRelation: query.propertyRelation,
    queryExpression: buildNestedElementQuery(
      ["value"],
      buildAndCtsQueryExpressionInternal(rangeQueryExpressions),
    ),
  });
}

function buildItemStringQueryExpression(parameters: {
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { value, matchMode, isCaseSensitive, language } = parameters;

  return buildOrCtsQueryExpressionInternal([
    buildContentTargetQueryExpression({
      target: "title",
      value,
      matchMode,
      isCaseSensitive,
      language,
    }),
    buildPropertyStringQueryExpression({
      value,
      matchMode,
      isCaseSensitive,
      language,
    }),
  ]);
}

function tokenizeOcrExactValue(value: string): Array<string> {
  const terms: Array<string> = [];

  for (const term of value.split(/\s+/u)) {
    if (term !== "") {
      terms.push(term);
    }
  }

  return terms;
}

/**
 * Word queries against the OCR layer cannot carry a stemming option: the OCHRE
 * database has unstemmed word searches turned off, and asking a word query for
 * `unstemmed` fails with `XDMP-WORDSEARCH`. Omitting the option altogether
 * resolves the term against the database default instead.
 */
function buildOcrWordQueryExpression(parameters: {
  value: QuerySearchValue;
  isCaseSensitive: boolean;
}): string {
  const { value, isCaseSensitive } = parameters;
  const options: Array<string> = [
    isCaseSensitive ? "case-sensitive" : "case-insensitive",
    "diacritic-insensitive",
    "punctuation-insensitive",
    "whitespace-insensitive",
  ];

  if (hasWildcardCharacters(value.text)) {
    options.push("wildcarded");
  }

  return `cts:element-attribute-word-query(${OCR_WORD_QNAMES}, xs:QName(${stringLiteral(OCR_WORD_CONTENT_ATTRIBUTE)}), ${value.expression}, (${options.map((option) => stringLiteral(option)).join(", ")}))`;
}

function buildOcrValueQueryExpression(parameters: {
  value: QuerySearchValue;
  isCaseSensitive: boolean;
}): string {
  const { value, isCaseSensitive } = parameters;

  return `cts:element-attribute-value-query(${OCR_WORD_QNAMES}, xs:QName(${stringLiteral(OCR_WORD_CONTENT_ATTRIBUTE)}), ${value.expression}, ${buildWordQueryOptionsExpression({ matchMode: "exact", isCaseSensitive })})`;
}

/**
 * Compile an OCR text search into a query over the `<ocr>` layer of a Resource
 * document
 *
 * Each word node in that layer holds a single OCR word in its `CONTENT`
 * attribute, so `includes` matches every search term as a word inside that
 * attribute anywhere in the layer, and `exact` requires every term to equal a
 * whole `CONTENT` value.
 *
 * The conjunction is only an index narrowing for `exact`. Attribute values
 * carry no word positions, so `cts:near-query` over them silently degenerates
 * into a conjunction and cannot express a phrase at all. Word order and
 * adjacency are instead enforced by {@link registerOcrPhraseHelper} over the
 * documents this narrowing returns.
 */
function buildOcrQueryExpression(query: OcrQuery): string {
  const { value, matchMode, isCaseSensitive } = query;

  if (matchMode === "exact") {
    const terms = tokenizeOcrExactValue(value);

    if (terms.length === 0) {
      return "cts:false-query()";
    }

    return buildNestedElementQuery(
      [OCR_LAYER_ELEMENT_NAME],
      buildAndCtsQueryExpressionInternal(
        Array.from(terms, (term) =>
          buildOcrValueQueryExpression({
            value: searchValue(term),
            isCaseSensitive,
          }),
        ),
      ),
    );
  }

  const terms = tokenizeIncludesSearchValue({ value, isCaseSensitive });

  if (terms.length === 0) {
    return "cts:false-query()";
  }

  return buildNestedElementQuery(
    [OCR_LAYER_ELEMENT_NAME],
    buildAndCtsQueryExpressionInternal(
      Array.from(terms, (term) =>
        buildOcrWordQueryExpression({
          value: searchValue(term),
          isCaseSensitive,
        }),
      ),
    ),
  );
}

/**
 * Declare the filter that holds an `exact` multi-term search to a run of
 * adjacent OCR words, which no CTS query over the layer can express
 */
function registerOcrPhraseHelper(context: QueryCompilerContext): string {
  const helperName = "local:ocrHasPhrase";

  if (context.helperNamesByKey.has(helperName)) {
    return helperName;
  }

  context.helperNamesByKey.set(helperName, helperName);
  context.helperDeclarations.push(
    `declare function ${helperName}($resource as node(), $terms as xs:string*, $isCaseSensitive as xs:boolean) as xs:boolean {
  let $contents :=
    for $word in ${buildOcrWordPath("$resource")}
    return if ($isCaseSensitive) then string($word/@${OCR_WORD_CONTENT_ATTRIBUTE}) else lower-case(string($word/@${OCR_WORD_CONTENT_ATTRIBUTE}))
  let $needles :=
    for $term in $terms
    return if ($isCaseSensitive) then $term else lower-case($term)
  let $length := count($needles)
  return
    some $start in (1 to (count($contents) - $length + 1))
    satisfies (
      every $offset in (1 to $length)
      satisfies $contents[$start + $offset - 1] = $needles[$offset]
    )
};`,
  );

  return helperName;
}

/**
 * Bind the UUIDs of the Resource documents whose OCR layer matches a query,
 * reusing the binding when the same search is requested more than once
 */
function registerOcrBinding(
  context: QueryCompilerContext,
  query: OcrQuery,
): string {
  const key = [
    query.value,
    query.matchMode,
    query.isCaseSensitive ? "case-sensitive" : "case-insensitive",
  ].join("|");
  const existingName = context.ocrBindingNamesByKey.get(key);

  if (existingName != null) {
    return existingName;
  }

  const name = `$ocrItemUuids${context.ocrBindings.length + 1}`;
  const queryExpression = buildOcrQueryExpression(query);
  const phraseTerms =
    query.matchMode === "exact" ? tokenizeOcrExactValue(query.value) : [];
  context.ocrBindingNamesByKey.set(key, name);
  // Scoping to the filtered items' documents keeps only what the UUID join
  // downstream would keep anyway, because the matched Resource is always the
  // top-level document. Unscoped, the phrase filter walks every word of every
  // matching document in the database.
  const scopedQueryExpression = buildAndCtsQueryExpressionInternal([
    queryExpression,
    `cts:document-query(${context.baseItemsExpression}/@uuid/string())`,
  ]);
  const searchExpression = `cts:search(/ochre/resource, ${scopedQueryExpression})`;
  const phraseHelperName =
    phraseTerms.length > 1 ? registerOcrPhraseHelper(context) : null;
  context.ocrBindings.push({
    name,
    expression:
      queryExpression === "cts:false-query()"
        ? "()"
        : phraseHelperName == null
          ? `${searchExpression}/@uuid/string()`
          : `for $ocrResource in ${searchExpression}
    where ${phraseHelperName}($ocrResource, (${phraseTerms.map((term) => stringLiteral(term)).join(", ")}), ${query.isCaseSensitive ? "true()" : "false()"})
    return string($ocrResource/@uuid)`,
  });

  return name;
}

function getLeafSearchValue(query: CtsQueryLeaf): string | null {
  switch (query.target) {
    case "string":
    case "title":
    case "description":
    case "image":
    case "periods":
    case "bibliography":
    case "notes": {
      return query.value;
    }
    case "property": {
      return "value" in query && query.value != null ? query.value : null;
    }
  }
}

function buildLeafValueQueryExpression(parameters: {
  query: CtsQueryLeaf;
  value: QuerySearchValue;
  matchMode: QueryMatchMode;
}): string {
  const { query, value, matchMode } = parameters;

  switch (query.target) {
    case "string": {
      return buildItemStringQueryExpression({
        value,
        matchMode,
        isCaseSensitive: query.isCaseSensitive,
        language: query.language,
      });
    }
    case "notes": {
      return buildNotesQueryExpression({
        value,
        matchMode,
        isCaseSensitive: query.isCaseSensitive,
        language: query.language,
      });
    }
    case "title":
    case "description":
    case "image":
    case "periods":
    case "bibliography": {
      return buildContentTargetQueryExpression({
        target: query.target,
        value,
        matchMode,
        isCaseSensitive: query.isCaseSensitive,
        language: query.language,
      });
    }
    case "property": {
      switch (query.dataType) {
        case "all": {
          return buildPropertyAllQueryExpression({ query, value, matchMode });
        }
        case "IDREF": {
          return buildPropertyIdReferenceQueryExpression({
            propertyVariable: query.propertyVariable,
            propertyRelation: query.propertyRelation,
            value,
          });
        }
        case "string": {
          return buildPropertyStringQueryExpression({
            propertyVariable: query.propertyVariable,
            propertyRelation: query.propertyRelation,
            value,
            matchMode,
            isCaseSensitive: query.isCaseSensitive,
            language: query.language,
          });
        }
        case "integer":
        case "decimal":
        case "time":
        case "boolean":
        case "date":
        case "dateTime": {
          return buildPropertyScalarQueryExpression({
            propertyVariable: query.propertyVariable,
            propertyRelation: query.propertyRelation,
            value,
            matchMode,
            isCaseSensitive: query.isCaseSensitive,
          });
        }
      }
    }
  }
}

function indentBlock(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces);

  return value
    .split("\n")
    .map((line) => (line === "" ? line : `${prefix}${line}`))
    .join("\n");
}

function createQueryCompilerContext(
  baseItemsExpression: string,
): QueryCompilerContext {
  return {
    nextHelperSerial: 1,
    helperNamesByKey: new Map(),
    helperDeclarations: [],
    ocrBindingNamesByKey: new Map(),
    ocrBindings: [],
    baseItemsExpression,
  };
}

function registerConstantHelper(parameters: {
  context: QueryCompilerContext;
  key: string;
  bodyExpression: string;
}): QueryHelperRegistration {
  const { context, key, bodyExpression } = parameters;
  const existingName = context.helperNamesByKey.get(key);

  if (existingName != null) {
    return { name: existingName, callExpression: `${existingName}()` };
  }

  const helperName = `local:queryHelper${context.nextHelperSerial}`;
  context.nextHelperSerial += 1;
  context.helperNamesByKey.set(key, helperName);
  context.helperDeclarations.push(
    `declare function ${helperName}() as cts:query {\n${indentBlock(bodyExpression, 2)}\n};`,
  );

  return { name: helperName, callExpression: `${helperName}()` };
}

function registerParameterizedHelper(parameters: {
  context: QueryCompilerContext;
  key: string;
  bodyExpression: string;
}): ParameterizedQueryHelperRegistration {
  const { context, key, bodyExpression } = parameters;
  const existingName = context.helperNamesByKey.get(key);

  if (existingName != null) {
    return {
      name: existingName,
      call: (valueExpression) => `${existingName}(${valueExpression})`,
    };
  }

  const helperName = `local:queryHelper${context.nextHelperSerial}`;
  context.nextHelperSerial += 1;
  context.helperNamesByKey.set(key, helperName);
  context.helperDeclarations.push(
    `declare function ${helperName}($value as xs:string) as cts:query {\n${indentBlock(bodyExpression, 2)}\n};`,
  );

  return {
    name: helperName,
    call: (valueExpression) => `${helperName}(${valueExpression})`,
  };
}

function getLeafHelperKey(parameters: {
  query: CtsQueryLeaf;
  matchMode: QueryMatchMode;
  value: string;
}): string {
  const { query, matchMode, value } = parameters;

  switch (query.target) {
    case "string":
    case "title":
    case "description":
    case "image":
    case "periods":
    case "bibliography":
    case "notes": {
      return [
        "leaf",
        matchMode,
        query.target,
        value,
        query.isCaseSensitive ? "case-sensitive" : "case-insensitive",
        query.language,
      ].join("|");
    }
    case "property": {
      return [
        "leaf",
        matchMode,
        query.target,
        query.dataType,
        query.propertyVariable ?? "",
        query.propertyRelation ?? "",
        value,
        query.isCaseSensitive ? "case-sensitive" : "case-insensitive",
        query.language,
      ].join("|");
    }
  }
}

function registerLeafHelper(parameters: {
  context: QueryCompilerContext;
  query: CtsQueryLeaf;
  matchMode: QueryMatchMode;
  value: string;
}): QueryHelperRegistration {
  const { context, query, matchMode, value } = parameters;

  return registerConstantHelper({
    context,
    key: getLeafHelperKey({ query, matchMode, value }),
    bodyExpression: buildLeafValueQueryExpression({
      query,
      value: searchValue(value),
      matchMode,
    }),
  });
}

function getIncludesLeafHelperKey(parameters: {
  query: CtsQueryLeaf;
  value: string;
}): string {
  const { query, value } = parameters;
  const isWildcarded = hasWildcardCharacters(value);
  const isStemmed = !isWildcarded && shouldUseStemmedTextSearch(value);

  switch (query.target) {
    case "string":
    case "title":
    case "description":
    case "image":
    case "periods":
    case "bibliography":
    case "notes": {
      return [
        "includes-helper",
        query.target,
        query.isCaseSensitive ? "case-sensitive" : "case-insensitive",
        query.language,
        isWildcarded ? "wildcarded" : "unwildcarded",
        isStemmed ? "stemmed" : "unstemmed",
      ].join("|");
    }
    case "property": {
      return [
        "includes-helper",
        query.target,
        query.dataType,
        query.propertyVariable ?? "",
        query.propertyRelation ?? "",
        query.isCaseSensitive ? "case-sensitive" : "case-insensitive",
        query.language,
        isWildcarded ? "wildcarded" : "unwildcarded",
        isStemmed ? "stemmed" : "unstemmed",
      ].join("|");
    }
  }
}

function registerIncludesLeafHelper(parameters: {
  context: QueryCompilerContext;
  query: CtsQueryLeaf;
  sampleValue: string;
}): ParameterizedQueryHelperRegistration {
  const { context, query, sampleValue } = parameters;

  return registerParameterizedHelper({
    context,
    key: getIncludesLeafHelperKey({ query, value: sampleValue }),
    bodyExpression: buildLeafValueQueryExpression({
      query,
      value: referencedSearchValue(sampleValue),
      matchMode: "includes",
    }),
  });
}

function buildLeafQueryExpression(
  context: QueryCompilerContext,
  query: CtsQueryLeaf,
): string {
  if (
    query.target === "property" &&
    query.dataType !== "date" &&
    query.dataType !== "dateTime" &&
    !("value" in query) &&
    (query.propertyVariable != null || query.propertyRelation != null)
  ) {
    return buildPropertyPresenceQueryExpression({
      propertyVariable: query.propertyVariable,
      propertyRelation: query.propertyRelation,
    });
  }

  if (
    query.target === "property" &&
    (query.dataType === "date" || query.dataType === "dateTime") &&
    query.value == null
  ) {
    return buildPropertyDateRangeQueryExpression(query);
  }

  const searchValue = getLeafSearchValue(query);

  if (searchValue == null) {
    throw new Error("Missing searchable value for query leaf", {
      cause: query,
    });
  }

  const exactHelper = registerLeafHelper({
    context,
    query,
    matchMode: "exact",
    value: searchValue,
  });

  if (query.matchMode === "exact") {
    return exactHelper.callExpression;
  }

  const terms = tokenizeIncludesSearchValue({
    value: searchValue,
    isCaseSensitive: query.isCaseSensitive,
  });

  if (terms.length === 0) {
    return "cts:false-query()";
  }

  const includesHelper = registerIncludesLeafHelper({
    context,
    query,
    sampleValue: terms[0] ?? "",
  });
  const tokenizedHelperCalls: Array<string> = [];

  for (const term of terms) {
    const termHelper =
      term === (terms[0] ?? "")
        ? includesHelper
        : registerIncludesLeafHelper({ context, query, sampleValue: term });

    tokenizedHelperCalls.push(termHelper.call(stringLiteral(term)));
  }

  const tokenizedQueryExpression =
    buildAndCtsQueryExpressionInternal(tokenizedHelperCalls);

  if (
    !shouldUseFullValueFallbackForIncludes({
      value: searchValue,
      isCaseSensitive: query.isCaseSensitive,
      terms,
    })
  ) {
    return tokenizedQueryExpression;
  }

  return buildOrCtsQueryExpressionInternal([
    exactHelper.callExpression,
    tokenizedQueryExpression,
  ]);
}

function getGroupableIncludesValue(query: CtsQueryLeaf): string | null {
  if (query.matchMode !== "includes" || query.isNegated === true) {
    return null;
  }

  switch (query.target) {
    case "string":
    case "title":
    case "description":
    case "image":
    case "periods":
    case "bibliography":
    case "notes": {
      return query.value;
    }
    case "property": {
      if (
        !("value" in query) ||
        query.value == null ||
        query.dataType === "IDREF"
      ) {
        return null;
      }

      return query.value;
    }
  }
}

function isQueryLeaf(query: Query): query is QueryLeaf {
  return "target" in query;
}

function getQueryGroupChildren(query: QueryGroup): Array<Query> {
  return "and" in query ? query.and : query.or;
}

function getQueryGroupOperator(query: QueryGroup): "and" | "or" {
  return "and" in query ? "and" : "or";
}

function getCompatibleIncludesGroupLeaves(
  query: QueryGroup,
): Array<CtsQueryLeaf> | null {
  if (!("or" in query) || query.or.length <= 1) {
    return null;
  }

  const leafQueries: Array<CtsQueryLeaf> = [];

  for (const childQuery of query.or) {
    if (!isQueryLeaf(childQuery) || childQuery.target === "ocr") {
      return null;
    }

    leafQueries.push(childQuery);
  }

  const firstQuery = leafQueries[0];

  if (firstQuery == null) {
    return null;
  }

  const groupValue = getGroupableIncludesValue(firstQuery);

  if (groupValue == null) {
    return null;
  }

  for (const leafQuery of leafQueries) {
    if (
      getGroupableIncludesValue(leafQuery) !== groupValue ||
      leafQuery.isCaseSensitive !== firstQuery.isCaseSensitive ||
      leafQuery.language !== firstQuery.language
    ) {
      return null;
    }
  }

  return leafQueries;
}

function buildIncludesGroupQueryExpression(
  context: QueryCompilerContext,
  queries: Array<CtsQueryLeaf>,
): string {
  const firstQuery = queries[0];

  if (firstQuery == null) {
    throw new Error("Cannot build an includes group without queries", {
      cause: queries,
    });
  }

  const groupValue = getGroupableIncludesValue(firstQuery);

  if (groupValue == null) {
    throw new Error("Cannot build an includes group without a search value", {
      cause: firstQuery,
    });
  }

  const terms = tokenizeIncludesSearchValue({
    value: groupValue,
    isCaseSensitive: firstQuery.isCaseSensitive,
  });

  if (terms.length === 0) {
    return "cts:false-query()";
  }

  const tokenizedHelperCalls: Array<string> = [];

  for (const term of terms) {
    const memberHelpers = queries.map((query) =>
      registerIncludesLeafHelper({ context, query, sampleValue: term }),
    );
    const termGroupHelper = registerParameterizedHelper({
      context,
      key: [
        "group",
        "includes",
        ...memberHelpers.map((helper) => helper.name),
      ].join("|"),
      bodyExpression: buildOrCtsQueryExpressionInternal(
        memberHelpers.map((helper) => helper.call("$value")),
      ),
    });

    tokenizedHelperCalls.push(termGroupHelper.call(stringLiteral(term)));
  }

  const tokenizedQueryExpression =
    buildAndCtsQueryExpressionInternal(tokenizedHelperCalls);

  if (
    !shouldUseFullValueFallbackForIncludes({
      value: groupValue,
      isCaseSensitive: firstQuery.isCaseSensitive,
      terms,
    })
  ) {
    return tokenizedQueryExpression;
  }

  const exactMemberHelpers = queries.map((query) =>
    registerLeafHelper({
      context,
      query,
      matchMode: "exact",
      value: groupValue,
    }),
  );
  const exactGroupHelper = registerConstantHelper({
    context,
    key: [
      "group",
      "exact",
      groupValue,
      ...exactMemberHelpers.map((helper) => helper.name),
    ].join("|"),
    bodyExpression: buildOrCtsQueryExpressionInternal(
      exactMemberHelpers.map((helper) => helper.callExpression),
    ),
  });

  return buildOrCtsQueryExpressionInternal([
    exactGroupHelper.callExpression,
    tokenizedQueryExpression,
  ]);
}

function buildCtsItemsPlan(queryExpression: string): ItemsSearchPlan {
  return {
    kind: "search",
    itemPredicates: [],
    queryExpressions: [queryExpression],
  };
}

/**
 * Plan a negated leaf as an item path predicate
 *
 * A Set holds every one of its items in one fragment, and CTS resolves
 * `cts:not-query` from the fragment indexes without filtering the match down to
 * the node it came from. Negating inside the search query would therefore drop
 * every item of a Set as soon as one of them matched, and keep every item of a
 * Set that held no match at all. `cts:contains` evaluates the leaf against one
 * item projection instead, which is the scope the negation is asking about.
 */
function buildNegatedItemsPlan(queryExpression: string): ItemsSearchPlan {
  return {
    kind: "search",
    itemPredicates: [`[not(cts:contains(., ${queryExpression}))]`],
    queryExpressions: [],
  };
}

/**
 * Splice the children of same-kind child plans into their parent, so that a
 * nested group of the same operator does not cost an extra search
 */
function flattenItemsPlans(
  childPlans: Array<ItemsPlan>,
  kind: "union" | "intersect",
): Array<ItemsPlan> {
  const flattenedPlans: Array<ItemsPlan> = [];

  for (const childPlan of childPlans) {
    if (childPlan.kind === kind) {
      flattenedPlans.push(...childPlan.children);
      continue;
    }

    flattenedPlans.push(childPlan);
  }

  return flattenedPlans;
}

/**
 * Fold the children of an `and` group into one plan
 *
 * Conjunction is the direction the item path predicates already run in, so
 * every child that is a plain search collapses into a single search, and only
 * the children that resolved to a union stay separate.
 */
function buildAndItemsPlan(childPlans: Array<ItemsPlan>): ItemsPlan {
  const mergedPlan: ItemsSearchPlan = {
    kind: "search",
    itemPredicates: [],
    queryExpressions: [],
  };
  const unfoldablePlans: Array<ItemsPlan> = [];

  for (const childPlan of flattenItemsPlans(childPlans, "intersect")) {
    if (childPlan.kind !== "search") {
      unfoldablePlans.push(childPlan);
      continue;
    }

    for (const itemPredicate of childPlan.itemPredicates) {
      if (!mergedPlan.itemPredicates.includes(itemPredicate)) {
        mergedPlan.itemPredicates.push(itemPredicate);
      }
    }

    mergedPlan.queryExpressions.push(...childPlan.queryExpressions);
  }

  if (unfoldablePlans.length === 0) {
    return mergedPlan;
  }

  const intersectedPlans =
    mergedPlan.itemPredicates.length === 0 &&
    mergedPlan.queryExpressions.length === 0
      ? unfoldablePlans
      : [mergedPlan, ...unfoldablePlans];

  return intersectedPlans.length === 1
    ? (intersectedPlans[0] ?? mergedPlan)
    : { kind: "intersect", children: intersectedPlans };
}

/**
 * Fold the children of an `or` group into one plan
 *
 * Item path predicates cannot be disjoined, so a child carrying one becomes its
 * own arm of a node union. Everything else is still a single CTS query.
 */
function buildOrItemsPlan(childPlans: Array<ItemsPlan>): ItemsPlan {
  const mergedQueryExpressions: Array<string> = [];
  const unionedPlans: Array<ItemsPlan> = [];

  for (const childPlan of flattenItemsPlans(childPlans, "union")) {
    if (childPlan.kind === "search" && childPlan.itemPredicates.length === 0) {
      mergedQueryExpressions.push(
        buildAndCtsQueryExpressionInternal(childPlan.queryExpressions),
      );
      continue;
    }

    unionedPlans.push(childPlan);
  }

  if (mergedQueryExpressions.length > 0) {
    unionedPlans.unshift({
      kind: "search",
      itemPredicates: [],
      queryExpressions: [
        buildOrCtsQueryExpressionInternal(mergedQueryExpressions),
      ],
    });
  }

  if (unionedPlans.length === 0) {
    return buildCtsItemsPlan("cts:false-query()");
  }

  return unionedPlans.length === 1
    ? (unionedPlans[0] ?? buildCtsItemsPlan("cts:false-query()"))
    : { kind: "union", children: unionedPlans };
}

function buildItemsPlan(
  context: QueryCompilerContext,
  query: Query,
): ItemsPlan {
  if (isQueryLeaf(query)) {
    if (query.target === "ocr") {
      const bindingName = registerOcrBinding(context, query);

      return {
        kind: "search",
        itemPredicates: [
          query.isNegated === true
            ? `[not(@uuid = ${bindingName})]`
            : `[@uuid = ${bindingName}]`,
        ],
        queryExpressions: [],
      };
    }

    const queryExpression = buildLeafQueryExpression(context, query);

    return query.isNegated === true
      ? buildNegatedItemsPlan(queryExpression)
      : buildCtsItemsPlan(queryExpression);
  }

  const optimizedIncludesGroupQueries = getCompatibleIncludesGroupLeaves(query);

  if (optimizedIncludesGroupQueries != null) {
    return buildCtsItemsPlan(
      buildIncludesGroupQueryExpression(context, optimizedIncludesGroupQueries),
    );
  }

  const childPlans: Array<ItemsPlan> = Array.from(
    getQueryGroupChildren(query),
    (childQuery) => buildItemsPlan(context, childQuery),
  );

  return getQueryGroupOperator(query) === "and"
    ? buildAndItemsPlan(childPlans)
    : buildOrItemsPlan(childPlans);
}

function collectItemsSearchPlans(
  plan: ItemsPlan,
  searchPlans: Array<ItemsSearchPlan>,
): void {
  if (plan.kind === "search") {
    searchPlans.push(plan);
    return;
  }

  for (const childPlan of plan.children) {
    collectItemsSearchPlans(childPlan, searchPlans);
  }
}

function buildItemsPlanExpression(parameters: {
  plan: ItemsPlan;
  baseItemsExpression: string;
  queryNamesByPlan: Map<ItemsSearchPlan, string>;
}): string {
  const { plan, baseItemsExpression, queryNamesByPlan } = parameters;

  if (plan.kind === "search") {
    const itemsExpression = `${baseItemsExpression}${plan.itemPredicates.join("")}`;
    const queryName = queryNamesByPlan.get(plan);

    return queryName == null
      ? itemsExpression
      : `cts:search(${itemsExpression}, ${queryName})`;
  }

  const childExpressions = Array.from(plan.children, (childPlan) =>
    buildItemsPlanExpression({
      plan: childPlan,
      baseItemsExpression,
      queryNamesByPlan,
    }),
  );

  return `(${childExpressions.join(plan.kind === "union" ? " | " : " intersect ")})`;
}

export function buildBelongsToCollectionQueryExpression(
  belongsToCollectionScopeUuids: ReadonlyArray<string>,
  belongsToCollectionPropertyVariableUuid: string,
): string | null {
  if (belongsToCollectionScopeUuids.length === 0) {
    return null;
  }

  const collectionValueQueryExpressions: Array<string> = Array.from(
    belongsToCollectionScopeUuids,
    (uuid) =>
      buildPlainElementAttributeValueQueryExpression({
        elementName: "value",
        attributeName: "uuid",
        value: searchValue(uuid),
      }),
  );

  return buildPropertyQueryExpression({
    propertyVariable: belongsToCollectionPropertyVariableUuid,
    queryExpression: buildNestedElementQuery(
      ["value"],
      buildOrCtsQueryExpressionInternal(collectionValueQueryExpressions),
    ),
  });
}

/**
 * Compile a query tree into the XQuery `let` clauses that bind `$items` to the
 * matching Set items
 *
 * Most queries compile to a single `cts:search` over the Set item projections.
 * An `ocr` leaf cannot: the projections drop the `<ocr>` layer, so it resolves
 * to a search over the Resource documents whose matching UUIDs are joined back
 * in as an item path predicate. A negated leaf cannot either, because CTS
 * answers a negation for the whole fragment rather than for the item that
 * matched, so it is filtered per item instead. Path predicates only ever AND,
 * so such a leaf that sits under an `or` becomes its own arm of a node union
 * instead, and one that sits under an `and` alongside a union becomes an
 * intersection.
 *
 * The searchable path has to stay inline in `cts:search`: binding it to a
 * variable first makes every query XDMP-UNSEARCHABLE.
 * @param parameters - The parameters for the compilation
 * @param parameters.queries - Recursive query tree to compile, if any
 * @param parameters.baseItemsExpression - The inline XQuery path selecting the items to search
 * @param parameters.scopeQueryExpression - An optional CTS query ANDed into every compiled search
 * @returns The prolog declaring the query helpers, and the `let` clauses binding `$items`
 */
const ITEMS_VARIABLE = "$items";
const SET_SCOPE_VARIABLE = "$setScopeUuids";

/**
 * The XQuery path a Set item search runs over
 *
 * The path has to stay inline in `cts:search`: binding it to a variable first
 * materializes the sequence and makes every query `XDMP-UNSEARCHABLE`, even a
 * plain word query. It references {@link SET_SCOPE_VARIABLE}, which
 * {@link compileSetItemsQuery} declares.
 */
const SET_ITEMS_EXPRESSION = `doc()/ochre/set[@uuid = ${SET_SCOPE_VARIABLE}]/items/*`;

/**
 * Compile a query tree into the clauses that bind the matching Set items
 *
 * The returned `itemsClause` binds {@link ITEMS_VARIABLE} and has to be placed
 * inside an XQuery body, with `prolog` declared ahead of it.
 * {@link compileSetItemsQuery} does both and is what fetchers should use;
 * this is exposed for tests that assert on the compiled CTS.
 * @param parameters - The plan parameters
 * @param parameters.queries - The query tree to compile, or null to match every item
 * @param parameters.baseItemsExpression - The inline searchable path to filter
 * @param parameters.scopeQueryExpression - An extra query AND-ed into every search
 * @returns The prolog, the clauses binding the items, and the bound CTS queries
 * @internal
 */
export function buildQueryPlan(parameters: {
  queries: Query | null;
  baseItemsExpression: string;
  scopeQueryExpression?: string | null;
}): {
  prolog: string;
  itemsClause: string;
  itemsVariable: string;
  queryBindings: Array<{ name: string; expression: string }>;
} {
  const { queries, baseItemsExpression, scopeQueryExpression } = parameters;

  const context = createQueryCompilerContext(baseItemsExpression);
  const plan: ItemsPlan =
    queries == null
      ? { kind: "search", itemPredicates: [], queryExpressions: [] }
      : buildItemsPlan(context, queries);
  const searchPlans: Array<ItemsSearchPlan> = [];
  collectItemsSearchPlans(plan, searchPlans);

  const boundSearchPlans: Array<{
    plan: ItemsSearchPlan;
    queryExpression: string;
  }> = [];

  for (const searchPlan of searchPlans) {
    const queryExpression = buildAndCtsQueryExpression([
      ...searchPlan.queryExpressions,
      ...(scopeQueryExpression == null ? [] : [scopeQueryExpression]),
    ]);

    if (queryExpression != null) {
      boundSearchPlans.push({ plan: searchPlan, queryExpression });
    }
  }

  const queryNamesByPlan = new Map<ItemsSearchPlan, string>();
  const queryBindings: Array<{ name: string; expression: string }> = [];
  const letClauses: Array<string> = Array.from(
    context.ocrBindings,
    (binding) => `let ${binding.name} := ${binding.expression}`,
  );

  for (const [index, boundSearchPlan] of boundSearchPlans.entries()) {
    const queryName =
      boundSearchPlans.length === 1 ? "$query" : `$query${index + 1}`;

    queryNamesByPlan.set(boundSearchPlan.plan, queryName);
    queryBindings.push({
      name: queryName,
      expression: boundSearchPlan.queryExpression,
    });
    letClauses.push(`let ${queryName} := ${boundSearchPlan.queryExpression}`);
  }

  letClauses.push(
    `let ${ITEMS_VARIABLE} := ${buildItemsPlanExpression({ plan, baseItemsExpression, queryNamesByPlan })}`,
  );

  return {
    prolog: context.helperDeclarations.join("\n\n"),
    itemsClause: letClauses.join("\n  "),
    itemsVariable: ITEMS_VARIABLE,
    queryBindings,
  };
}

/**
 * Compile a Set item query into a complete XQuery document
 *
 * Owns everything a caller would otherwise have to know and restate: the
 * version declaration, the Set scope variable, the supplemental-stripping
 * prolog, the inline searchable path, where the compiled helper prolog goes and
 * that it is only declared when non-empty, the `<ochre>` wrapper, and the name
 * of the variable holding the matching items. The body receives that name.
 * @param parameters - The query parameters
 * @param parameters.setScopeUuids - The Set scope UUIDs to search within
 * @param parameters.belongsToCollectionScopeUuids - Collection scope UUIDs to narrow to
 * @param parameters.queries - The query tree to compile, or null to match every item
 * @param parameters.declarations - Extra prolog declarations, placed before the compiled prolog
 * @param parameters.body - Builds the body from the name of the variable holding the items
 * @returns A complete XQuery document
 * @internal
 */
export function compileSetItemsQuery(parameters: {
  setScopeUuids: ReadonlyArray<string>;
  belongsToCollectionScopeUuids: ReadonlyArray<string>;
  queries: Query | null;
  declarations?: ReadonlyArray<string>;
  body: (itemsVariable: string) => string;
}): string {
  const {
    setScopeUuids,
    belongsToCollectionScopeUuids,
    queries,
    declarations = [],
    body,
  } = parameters;

  const plan = buildQueryPlan({
    queries,
    baseItemsExpression: SET_ITEMS_EXPRESSION,
    scopeQueryExpression: buildBelongsToCollectionQueryExpression(
      belongsToCollectionScopeUuids,
      BELONGS_TO_COLLECTION_UUID,
    ),
  });

  const prologDeclarations: Array<string> = [
    'xquery version "1.0-ml";',
    ...declarations,
    `declare variable ${SET_SCOPE_VARIABLE} := (${Array.from(setScopeUuids, (uuid) => stringLiteral(uuid)).join(", ")});`,
    SUPPLEMENTAL_XQUERY_PROLOG,
  ];

  if (plan.prolog !== "") {
    prologDeclarations.push(plan.prolog);
  }

  return `${prologDeclarations.join("\n\n")}

<ochre>{
${plan.itemsClause}
${body(plan.itemsVariable)}
}</ochre>`;
}

/**
 * Reduce a property-value facet query tree to the leaves that filter items
 *
 * A facet request carries property leaves that name a variable without naming
 * a value, which select what to aggregate rather than which items to keep.
 * Those are dropped, and groups left with a single child collapse into it.
 * @param queries - The query tree to reduce
 * @returns The reduced tree, or null when nothing filters items
 * @internal
 */
export function getItemFilterQueries(queries: Query | null): Query | null {
  if (queries == null) {
    return null;
  }

  if (isQueryLeaf(queries)) {
    if (
      queries.target !== "property" ||
      queries.dataType === "date" ||
      queries.dataType === "dateTime"
    ) {
      return queries;
    }

    return "value" in queries && queries.value != null ? queries : null;
  }

  const filteredChildren: Array<Query> = [];

  for (const childQuery of getQueryGroupChildren(queries)) {
    const filteredChildQuery = getItemFilterQueries(childQuery);

    if (filteredChildQuery != null) {
      filteredChildren.push(filteredChildQuery);
    }
  }

  if (filteredChildren.length <= 1) {
    return filteredChildren[0] ?? null;
  }

  return getQueryGroupOperator(queries) === "and"
    ? { and: filteredChildren }
    : { or: filteredChildren };
}

/**
 * Collect the property variables a query tree asks to be aggregated
 * @param queries - The query tree to walk
 * @returns One selector per distinct property variable and relation pair
 * @internal
 */
export function getPropertyFacetSelectors(
  queries: Query | null,
): Array<{ uuid: string; relation: PropertyRelation | null }> {
  if (queries == null) {
    return [];
  }

  const selectors = new Map<
    string,
    { uuid: string; relation: PropertyRelation | null }
  >();
  const pendingQueries: Array<Query> = [queries];

  while (pendingQueries.length > 0) {
    const query = pendingQueries.shift();
    if (query == null) {
      continue;
    }

    if (isQueryLeaf(query)) {
      if (query.target === "property" && query.propertyVariable != null) {
        const relation = query.propertyRelation ?? null;
        selectors.set(`${query.propertyVariable}|${relation}`, {
          uuid: query.propertyVariable,
          relation,
        });
      }

      continue;
    }

    pendingQueries.push(...getQueryGroupChildren(query));
  }

  return selectors.values().toArray();
}

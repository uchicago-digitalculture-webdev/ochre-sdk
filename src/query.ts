import type {
  PropertyRelation,
  Query,
  QueryGroup,
  QueryLeaf,
} from "#/types/index.js";
import { stringLiteral } from "#/utilities.js";

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

/**
 * Error message for OCR queries nested inside an OR group
 * @internal
 */
export const OCR_DISJUNCTION_ERROR_MESSAGE =
  "OCR queries cannot be nested inside an OR group because they are resolved by a document join instead of a CTS query";

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

type OcrUuidBinding = { name: string; expression: string };

type QueryCompilerContext = {
  nextHelperSerial: number;
  helperNamesByKey: Map<string, string>;
  helperDeclarations: Array<string>;
  nextOcrSerial: number;
  ocrVariableNamesByKey: Map<string, string>;
  ocrBindings: Array<OcrUuidBinding>;
  itemPredicates: Array<string>;
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
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  queryFamily?: CtsQueryFamily;
  language?: string;
}): string {
  const { value, matchMode, isCaseSensitive, queryFamily, language } =
    parameters;
  const isWildcarded = matchMode === "includes" && hasWildcardCharacters(value);
  const isStemmed =
    matchMode === "includes" &&
    queryFamily === "text" &&
    !isWildcarded &&
    shouldUseStemmedTextSearch(value);

  return `cts:word-query(${stringLiteral(value)}, ${buildWordQueryOptionsExpression({ matchMode, isCaseSensitive, queryFamily, language, isWildcarded, isStemmed })})`;
}

function buildRichTextPhraseQueryExpression(parameters: {
  value: string;
  isCaseSensitive: boolean;
}): string {
  const { value, isCaseSensitive } = parameters;

  return `cts:word-query(${stringLiteral(value)}, ${buildRichTextPhraseOptionsExpression({ isCaseSensitive })})`;
}

function buildRichTextExactQueryExpression(parameters: {
  value: string;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { value, isCaseSensitive } = parameters;
  const phraseQuery = buildRichTextPhraseQueryExpression({
    value,
    isCaseSensitive,
  });
  const terms = tokenizeExactTextSearchValue({ value, isCaseSensitive });

  if (terms.length <= 1) {
    return phraseQuery;
  }

  const tokenAndQuery = buildAndCtsQueryExpressionInternal(
    terms.map((term) =>
      buildRichTextPhraseQueryExpression({ value: term, isCaseSensitive }),
    ),
  );

  return buildOrCtsQueryExpressionInternal([phraseQuery, tokenAndQuery]);
}

function buildCtsElementWordQueryExpression(parameters: {
  elementName: string;
  value: string;
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
  const isWildcarded = matchMode === "includes" && hasWildcardCharacters(value);
  const isStemmed =
    matchMode === "includes" &&
    queryFamily === "text" &&
    !isWildcarded &&
    shouldUseStemmedTextSearch(value);

  return `cts:element-word-query(xs:QName("${elementName}"), ${stringLiteral(value)}, ${buildWordQueryOptionsExpression({ matchMode, isCaseSensitive, queryFamily, language, isWildcarded, isStemmed })})`;
}

function buildCtsElementAttributeWordQueryExpression(parameters: {
  elementName: string;
  attributeName: string;
  value: string;
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
  const isWildcarded = matchMode === "includes" && hasWildcardCharacters(value);
  const isStemmed =
    matchMode === "includes" &&
    queryFamily === "text" &&
    !isWildcarded &&
    shouldUseStemmedTextSearch(value);

  return `cts:element-attribute-word-query(xs:QName("${elementName}"), xs:QName("${attributeName}"), ${stringLiteral(value)}, ${buildWordQueryOptionsExpression({ matchMode, isCaseSensitive, queryFamily, language, isWildcarded, isStemmed })})`;
}

function buildCtsElementValueQueryExpression(parameters: {
  elementName: string;
  value: string;
  isCaseSensitive: boolean;
}): string {
  const { elementName, value, isCaseSensitive } = parameters;

  return `cts:element-value-query(xs:QName("${elementName}"), ${stringLiteral(value)}, ${buildWordQueryOptionsExpression({ matchMode: "exact", isCaseSensitive })})`;
}

function buildCtsElementAttributeValueQueryExpression(parameters: {
  elementName: string;
  attributeName: string;
  value: string;
  isCaseSensitive: boolean;
}): string {
  const { elementName, attributeName, value, isCaseSensitive } = parameters;

  return `cts:element-attribute-value-query(xs:QName("${elementName}"), xs:QName("${attributeName}"), ${stringLiteral(value)}, ${buildWordQueryOptionsExpression({ matchMode: "exact", isCaseSensitive })})`;
}

function buildPlainElementAttributeValueQueryExpression(parameters: {
  elementName: string;
  attributeName: string;
  value: string;
}): string {
  const { elementName, attributeName, value } = parameters;

  return `cts:element-attribute-value-query(xs:QName("${elementName}"), xs:QName("${attributeName}"), ${stringLiteral(value)})`;
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

// OCR words are separate elements, so a phrase never matches a single word or
// phrase query. `cts:near-query` distance is the span across all members, which
// makes `terms.length - 1` the exact-adjacency window.
function buildCtsNearQueryExpression(queryExpressions: Array<string>): string {
  return `cts:near-query((${queryExpressions.join(", ")}), ${queryExpressions.length - 1}, ("ordered"))`;
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

export function buildAndCtsQueryExpression(
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
    value: language,
  });
}

function buildPropertyLabelQuery(propertyVariable: string): string {
  return buildPlainElementAttributeValueQueryExpression({
    elementName: "label",
    attributeName: "uuid",
    value: propertyVariable,
  });
}

function buildValueNotIdReferenceQuery(): string {
  return buildNotCtsQueryExpression(
    buildPlainElementAttributeValueQueryExpression({
      elementName: "value",
      attributeName: "dataType",
      value: "IDREF",
    }),
  );
}

function buildRichTextContentQueryExpression(parameters: {
  value: string;
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
  value: string;
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
  value: string;
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
  value: string;
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
  value: string;
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
  value: string;
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
  value: string;
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
        value: propertyRelation,
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
        value: propertyRelation,
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
  value: string;
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
  value: string;
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
  value: string;
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
  value: string;
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
  value: string;
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

// OCR phrases are matched by word adjacency, so stop words have to be kept:
// dropping them would silently shrink the `cts:near-query` distance and make
// "state of the art" match a non-adjacent "state ... art".
function tokenizeOcrSearchValue(parameters: {
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): Array<string> {
  const { value, matchMode, isCaseSensitive } = parameters;
  const tokenSource = isCaseSensitive ? value : value.toLowerCase();
  const rawTerms =
    tokenSource.match(
      matchMode === "exact"
        ? CTS_EXACT_TEXT_TOKEN_REGEX
        : CTS_INCLUDES_TOKEN_REGEX,
    ) ?? [];
  const terms: Array<string> = [];

  for (const term of rawTerms) {
    if (getWildcardStrippedValue(term) !== "") {
      terms.push(term);
    }
  }

  return terms;
}

/**
 * Compile one CTS query expression per OCR search term, in word order
 *
 * Highlighting matches each OCR word against these same per-term expressions,
 * so hit locations always agree with what the filter matched.
 * @internal
 */
export function buildOcrTermQueryExpressions(parameters: {
  value: string;
  matchMode: "includes" | "exact";
  isCaseSensitive: boolean;
}): Array<string> {
  const { value, matchMode, isCaseSensitive } = parameters;
  const terms = tokenizeOcrSearchValue({ value, matchMode, isCaseSensitive });
  const isWholeWordEquality = matchMode === "exact" && terms.length === 1;

  return Array.from(terms, (term) =>
    isWholeWordEquality
      ? buildCtsElementValueQueryExpression({
          elementName: "string",
          value: term,
          isCaseSensitive,
        })
      : buildCtsWordQueryExpression({
          value: term,
          matchMode,
          isCaseSensitive,
          queryFamily: "text",
        }),
  );
}

function buildOcrQueryExpression(query: OcrQuery): string {
  const termQueryExpressions = buildOcrTermQueryExpressions(query);

  if (termQueryExpressions.length === 0) {
    return "cts:false-query()";
  }

  return buildNestedElementQuery(
    ["ocr"],
    termQueryExpressions.length > 1
      ? buildCtsNearQueryExpression(termQueryExpressions)
      : (termQueryExpressions[0] ?? "cts:false-query()"),
  );
}

function registerOcrItemPredicate(
  context: QueryCompilerContext,
  query: OcrQuery,
): void {
  const bindingKey = [
    query.value,
    query.matchMode,
    query.isCaseSensitive ? "case-sensitive" : "case-insensitive",
  ].join("|");
  let variableName = context.ocrVariableNamesByKey.get(bindingKey);

  if (variableName == null) {
    variableName = `$ocrUuids${context.nextOcrSerial}`;
    context.nextOcrSerial += 1;
    context.ocrVariableNamesByKey.set(bindingKey, variableName);
    // `cts:uris` resolves from indexes only, which reports false positives for
    // the positional `cts:near-query` phrases. A filtered `cts:search` is the
    // only accurate way to resolve the matching document URIs.
    context.ocrBindings.push({
      name: variableName,
      expression: `for $ocrDocument in cts:search(doc(), ${buildOcrQueryExpression(query)})\n    return document-uri($ocrDocument)`,
    });
  }

  const itemPredicate =
    query.isNegated === true
      ? `[not(@uuid = ${variableName})]`
      : `[@uuid = ${variableName}]`;

  if (!context.itemPredicates.includes(itemPredicate)) {
    context.itemPredicates.push(itemPredicate);
  }
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
  value: string;
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

function createQueryCompilerContext(): QueryCompilerContext {
  return {
    nextHelperSerial: 1,
    helperNamesByKey: new Map(),
    helperDeclarations: [],
    nextOcrSerial: 1,
    ocrVariableNamesByKey: new Map(),
    ocrBindings: [],
    itemPredicates: [],
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

function replaceSampleValueLiteral(
  expression: string,
  sampleValue: string,
  valueReference: string,
): string {
  return expression.replaceAll(
    stringLiteral(sampleValue),
    () => valueReference,
  );
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
    bodyExpression: buildLeafValueQueryExpression({ query, value, matchMode }),
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
    bodyExpression: replaceSampleValueLiteral(
      buildLeafValueQueryExpression({
        query,
        value: sampleValue,
        matchMode: "includes",
      }),
      sampleValue,
      "$value",
    ),
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

// A single-child `or` group compiles to its child, so it is not a real
// disjunction and must not reject an OCR leaf.
function isDisjunctiveQueryGroup(query: QueryGroup): boolean {
  return "or" in query && query.or.length > 1;
}

/**
 * Whether a query tree nests an OCR leaf inside an OR group
 * @internal
 */
export function hasOcrQueryInDisjunction(
  query: Query,
  isInDisjunction = false,
): boolean {
  if (isQueryLeaf(query)) {
    return query.target === "ocr" && isInDisjunction;
  }

  const isChildInDisjunction =
    isInDisjunction || isDisjunctiveQueryGroup(query);

  for (const childQuery of getQueryGroupChildren(query)) {
    if (hasOcrQueryInDisjunction(childQuery, isChildInDisjunction)) {
      return true;
    }
  }

  return false;
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

function buildQueryNode(
  context: QueryCompilerContext,
  query: Query,
  isInDisjunction: boolean,
): string {
  if (isQueryLeaf(query)) {
    if (query.target === "ocr") {
      if (isInDisjunction) {
        throw new Error(OCR_DISJUNCTION_ERROR_MESSAGE, { cause: query });
      }

      registerOcrItemPredicate(context, query);

      return "cts:true-query()";
    }

    const queryExpression = buildLeafQueryExpression(context, query);

    return query.isNegated === true
      ? buildNotCtsQueryExpression(queryExpression)
      : queryExpression;
  }

  const optimizedIncludesGroupQueries = getCompatibleIncludesGroupLeaves(query);

  if (optimizedIncludesGroupQueries != null) {
    return buildIncludesGroupQueryExpression(
      context,
      optimizedIncludesGroupQueries,
    );
  }

  const isChildInDisjunction =
    isInDisjunction || isDisjunctiveQueryGroup(query);
  const childQueryExpressions: Array<string> = Array.from(
    getQueryGroupChildren(query),
    (childQuery) => buildQueryNode(context, childQuery, isChildInDisjunction),
  );

  const buildCtsQueryExpression =
    getQueryGroupOperator(query) === "and"
      ? buildAndCtsQueryExpressionInternal
      : buildOrCtsQueryExpressionInternal;
  return buildCtsQueryExpression(childQueryExpressions);
}

export function buildBelongsToCollectionQueryExpression(
  belongsToCollectionScopeUuids: Array<string>,
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
        value: uuid,
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

export function buildQueryPlan(parameters: { queries: Query | null }): {
  prolog: string;
  queryExpression: string | null;
  ocrBindings: Array<OcrUuidBinding>;
  itemPredicates: string;
} {
  const { queries } = parameters;

  if (queries == null) {
    return {
      prolog: "",
      queryExpression: null,
      ocrBindings: [],
      itemPredicates: "",
    };
  }

  const context = createQueryCompilerContext();
  const queryExpression = buildQueryNode(context, queries, false);

  return {
    prolog: context.helperDeclarations.join("\n\n"),
    queryExpression,
    ocrBindings: context.ocrBindings,
    itemPredicates: context.itemPredicates.join(""),
  };
}

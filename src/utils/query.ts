import type { Query, QueryGroup, QueryLeaf } from "#/types/index.js";
import { stringLiteral } from "#/utils/internal.js";

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

type QueryCompilerContext = {
  nextHelperSerial: number;
  helperNamesByKey: Map<string, string>;
  helperDeclarations: Array<string>;
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

function tokenizeIncludesSearchValue(params: {
  value: string;
  isCaseSensitive: boolean;
}): Array<string> {
  const { value, isCaseSensitive } = params;
  const tokenSource = isCaseSensitive ? value : value.toLowerCase();
  const rawTerms = tokenSource.match(CTS_INCLUDES_TOKEN_REGEX) ?? [];
  const terms: Array<string> = [];

  for (const term of rawTerms) {
    const hasWildcard = term.includes("*") || term.includes("?");

    if (hasWildcard) {
      const wildcardStrippedTerm = term.replaceAll("*", "").replaceAll("?", "");

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

function tokenizeExactTextSearchValue(params: {
  value: string;
  isCaseSensitive: boolean;
}): Array<string> {
  const { value, isCaseSensitive } = params;
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
  return value.replaceAll("*", "").replaceAll("?", "");
}

function shouldUseStemmedTextSearch(value: string): boolean {
  const wildcardStrippedValue = getWildcardStrippedValue(value);

  return (
    wildcardStrippedValue.length >= 3 &&
    CTS_INCLUDES_TOKEN_WORD_REGEX.test(wildcardStrippedValue)
  );
}

function shouldUseFullValueFallbackForIncludes(params: {
  value: string;
  isCaseSensitive: boolean;
  terms: Array<string>;
}): boolean {
  const { value, isCaseSensitive, terms } = params;

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

function buildWordQueryOptionsExpression(params: {
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  queryFamily?: CtsQueryFamily;
  language?: string;
  isWildcarded?: boolean;
  isStemmed?: boolean;
}): string {
  const { matchMode, isCaseSensitive, queryFamily, language, isWildcarded } =
    params;
  const { isStemmed } = params;
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

    if (isStemmed && language != null && language !== "") {
      options.push(`lang=${language}`);
    }
  }

  return `(${options.map((option) => stringLiteral(option)).join(", ")})`;
}

function buildRichTextPhraseOptionsExpression(params: {
  isCaseSensitive: boolean;
}): string {
  const { isCaseSensitive } = params;
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

function buildCtsWordQueryExpression(params: {
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  queryFamily?: CtsQueryFamily;
  language?: string;
}): string {
  const { value, matchMode, isCaseSensitive, queryFamily, language } = params;
  const isWildcarded = matchMode === "includes" && hasWildcardCharacters(value);
  const isStemmed =
    matchMode === "includes" &&
    queryFamily === "text" &&
    !isWildcarded &&
    shouldUseStemmedTextSearch(value);

  return `cts:word-query(${stringLiteral(value)}, ${buildWordQueryOptionsExpression({ matchMode, isCaseSensitive, queryFamily, language, isWildcarded, isStemmed })})`;
}

function buildRichTextPhraseQueryExpression(params: {
  value: string;
  isCaseSensitive: boolean;
}): string {
  const { value, isCaseSensitive } = params;

  return `cts:word-query(${stringLiteral(value)}, ${buildRichTextPhraseOptionsExpression({ isCaseSensitive })})`;
}

function buildCtsNearQueryExpression(params: {
  queryExpressions: Array<string>;
  distance: number;
  isOrdered?: boolean;
}): string {
  const { queryExpressions, distance, isOrdered = false } = params;
  const options = isOrdered ? `, (${stringLiteral("ordered")})` : "";

  return `cts:near-query((${queryExpressions.join(", ")}), ${distance}${options})`;
}

function buildRichTextExactQueryExpression(params: {
  value: string;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { value, isCaseSensitive, language } = params;
  const phraseQuery = buildRichTextPhraseQueryExpression({
    value,
    isCaseSensitive,
  });
  const terms = tokenizeExactTextSearchValue({ value, isCaseSensitive });

  if (terms.length <= 1) {
    return phraseQuery;
  }

  const orderedNearQuery = buildCtsNearQueryExpression({
    queryExpressions: terms.map((term) =>
      buildCtsWordQueryExpression({
        value: term,
        matchMode: "exact",
        isCaseSensitive,
        queryFamily: "text",
        language,
      }),
    ),
    distance: 2,
    isOrdered: true,
  });

  return buildOrCtsQueryExpressionInternal([phraseQuery, orderedNearQuery]);
}

function buildCtsElementWordQueryExpression(params: {
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
  } = params;
  const isWildcarded = matchMode === "includes" && hasWildcardCharacters(value);
  const isStemmed =
    matchMode === "includes" &&
    queryFamily === "text" &&
    !isWildcarded &&
    shouldUseStemmedTextSearch(value);

  return `cts:element-word-query(xs:QName("${elementName}"), ${stringLiteral(value)}, ${buildWordQueryOptionsExpression({ matchMode, isCaseSensitive, queryFamily, language, isWildcarded, isStemmed })})`;
}

function buildCtsElementAttributeWordQueryExpression(params: {
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
  } = params;
  const isWildcarded = matchMode === "includes" && hasWildcardCharacters(value);
  const isStemmed =
    matchMode === "includes" &&
    queryFamily === "text" &&
    !isWildcarded &&
    shouldUseStemmedTextSearch(value);

  return `cts:element-attribute-word-query(xs:QName("${elementName}"), xs:QName("${attributeName}"), ${stringLiteral(value)}, ${buildWordQueryOptionsExpression({ matchMode, isCaseSensitive, queryFamily, language, isWildcarded, isStemmed })})`;
}

function buildCtsElementValueQueryExpression(params: {
  elementName: string;
  value: string;
  isCaseSensitive: boolean;
}): string {
  const { elementName, value, isCaseSensitive } = params;

  return `cts:element-value-query(xs:QName("${elementName}"), ${stringLiteral(value)}, ${buildWordQueryOptionsExpression({ matchMode: "exact", isCaseSensitive })})`;
}

function buildCtsElementAttributeValueQueryExpression(params: {
  elementName: string;
  attributeName: string;
  value: string;
  isCaseSensitive: boolean;
}): string {
  const { elementName, attributeName, value, isCaseSensitive } = params;

  return `cts:element-attribute-value-query(xs:QName("${elementName}"), xs:QName("${attributeName}"), ${stringLiteral(value)}, ${buildWordQueryOptionsExpression({ matchMode: "exact", isCaseSensitive })})`;
}

function buildPlainElementAttributeValueQueryExpression(params: {
  elementName: string;
  attributeName: string;
  value: string;
}): string {
  const { elementName, attributeName, value } = params;

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

function buildValueNotInheritedQuery(): string {
  return buildNotCtsQueryExpression(
    buildPlainElementAttributeValueQueryExpression({
      elementName: "value",
      attributeName: "inherited",
      value: "true",
    }),
  );
}

function buildValueNotIdRefQuery(): string {
  return buildNotCtsQueryExpression(
    buildPlainElementAttributeValueQueryExpression({
      elementName: "value",
      attributeName: "dataType",
      value: "IDREF",
    }),
  );
}

function buildRichTextContentQueryExpression(params: {
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { value, matchMode, isCaseSensitive, language } = params;

  return buildAndCtsQueryExpressionInternal([
    buildContentLanguageQuery(language),
    matchMode === "exact" ?
      buildRichTextExactQueryExpression({ value, isCaseSensitive, language })
    : buildCtsWordQueryExpression({
        value,
        matchMode,
        isCaseSensitive,
        queryFamily: "text",
        language,
      }),
  ]);
}

function buildValueContentInnerQuery(params: {
  language: string;
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { language, value, matchMode, isCaseSensitive } = params;

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

function buildValueDirectTextInnerQuery(params: {
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { value, matchMode, isCaseSensitive } = params;
  const directTextQuery =
    matchMode === "exact" ?
      buildCtsElementValueQueryExpression({
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

function buildValueRawValueInnerQuery(params: {
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { value, matchMode, isCaseSensitive } = params;

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

function buildNotesQueryExpression(params: {
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { value, matchMode, isCaseSensitive, language } = params;

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

function buildContentTargetQueryExpression(params: {
  target: ContentTextTarget;
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { target, value, matchMode, isCaseSensitive, language } = params;
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

function buildPropertyQueryExpression(params: {
  propertyVariable?: string;
  queryExpression: string;
}): string {
  const { propertyVariable, queryExpression } = params;
  const propertyQueryExpressions: Array<string> = [queryExpression];

  if (propertyVariable != null) {
    propertyQueryExpressions.unshift(buildPropertyLabelQuery(propertyVariable));
  }

  return buildNestedElementQuery(
    ["properties", "property"],
    buildAndCtsQueryExpressionInternal(propertyQueryExpressions),
  );
}

function buildPropertyTextMatchQueryExpression(params: {
  propertyVariable?: string;
  valueFilters?: Array<string>;
  contentQueryExpression?: string;
  rawValueQueryExpression?: string;
  bareValueQueryExpression?: string;
}): string {
  const {
    propertyVariable,
    valueFilters = [],
    contentQueryExpression,
    rawValueQueryExpression,
    bareValueQueryExpression,
  } = params;
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

function buildPropertyPresenceQueryExpression(params: {
  propertyVariable?: string;
}): string {
  return buildPropertyQueryExpression({
    propertyVariable: params.propertyVariable,
    queryExpression: "cts:true-query()",
  });
}

function buildPropertyStringQueryExpression(params: {
  propertyVariable?: string;
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { propertyVariable, value, matchMode, isCaseSensitive, language } =
    params;

  return buildPropertyTextMatchQueryExpression({
    propertyVariable,
    valueFilters: [buildValueNotInheritedQuery()],
    contentQueryExpression: buildValueContentInnerQuery({
      language,
      value,
      matchMode,
      isCaseSensitive,
    }),
  });
}

function buildPropertyScalarQueryExpression(params: {
  propertyVariable?: string;
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { propertyVariable, value, matchMode, isCaseSensitive } = params;

  return buildPropertyQueryExpression({
    propertyVariable,
    queryExpression: buildNestedElementQuery(
      ["value"],
      buildOrCtsQueryExpressionInternal([
        buildValueRawValueInnerQuery({ value, matchMode, isCaseSensitive }),
        buildValueDirectTextInnerQuery({ value, matchMode, isCaseSensitive }),
      ]),
    ),
  });
}

function buildPropertyAllQueryExpression(params: {
  query: AllPropertyQuery;
  value: string;
  matchMode: QueryMatchMode;
}): string {
  const { query, value, matchMode } = params;

  return buildPropertyTextMatchQueryExpression({
    propertyVariable: query.propertyVariable,
    valueFilters: [buildValueNotIdRefQuery()],
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

function buildPropertyIdRefQueryExpression(params: {
  propertyVariable?: string;
  value: string;
}): string {
  const { propertyVariable, value } = params;

  return buildPropertyQueryExpression({
    propertyVariable,
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
    queryExpression: buildNestedElementQuery(
      ["value"],
      buildAndCtsQueryExpressionInternal(rangeQueryExpressions),
    ),
  });
}

function buildItemStringQueryExpression(params: {
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { value, matchMode, isCaseSensitive, language } = params;

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

function getLeafSearchValue(query: QueryLeaf): string | null {
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

function buildLeafValueQueryExpression(params: {
  query: QueryLeaf;
  value: string;
  matchMode: QueryMatchMode;
}): string {
  const { query, value, matchMode } = params;

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
          return buildPropertyIdRefQueryExpression({
            propertyVariable: query.propertyVariable,
            value,
          });
        }
        case "string": {
          return buildPropertyStringQueryExpression({
            propertyVariable: query.propertyVariable,
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
  };
}

function registerConstantHelper(params: {
  context: QueryCompilerContext;
  key: string;
  bodyExpression: string;
}): QueryHelperRegistration {
  const { context, key, bodyExpression } = params;
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
  return expression.replaceAll(stringLiteral(sampleValue), valueReference);
}

function registerParameterizedHelper(params: {
  context: QueryCompilerContext;
  key: string;
  bodyExpression: string;
}): ParameterizedQueryHelperRegistration {
  const { context, key, bodyExpression } = params;
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

function getLeafHelperKey(params: {
  query: QueryLeaf;
  matchMode: QueryMatchMode;
  value: string;
}): string {
  const { query, matchMode, value } = params;

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
        value,
        query.isCaseSensitive ? "case-sensitive" : "case-insensitive",
        query.language,
      ].join("|");
    }
  }
}

function registerLeafHelper(params: {
  context: QueryCompilerContext;
  query: QueryLeaf;
  matchMode: QueryMatchMode;
  value: string;
}): QueryHelperRegistration {
  const { context, query, matchMode, value } = params;

  return registerConstantHelper({
    context,
    key: getLeafHelperKey({ query, matchMode, value }),
    bodyExpression: buildLeafValueQueryExpression({ query, value, matchMode }),
  });
}

function getIncludesLeafHelperKey(params: {
  query: QueryLeaf;
  value: string;
}): string {
  const { query, value } = params;
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
        query.isCaseSensitive ? "case-sensitive" : "case-insensitive",
        query.language,
        isWildcarded ? "wildcarded" : "unwildcarded",
        isStemmed ? "stemmed" : "unstemmed",
      ].join("|");
    }
  }
}

function registerIncludesLeafHelper(params: {
  context: QueryCompilerContext;
  query: QueryLeaf;
  sampleValue: string;
}): ParameterizedQueryHelperRegistration {
  const { context, query, sampleValue } = params;

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
  query: QueryLeaf,
): string {
  if (
    query.target === "property" &&
    query.dataType !== "date" &&
    query.dataType !== "dateTime" &&
    !("value" in query) &&
    query.propertyVariable != null
  ) {
    return buildPropertyPresenceQueryExpression({
      propertyVariable: query.propertyVariable,
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
    throw new Error("Missing searchable value for query leaf");
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
      term === (terms[0] ?? "") ?
        includesHelper
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

function getGroupableIncludesValue(query: QueryLeaf): string | null {
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
): Array<QueryLeaf> | null {
  if (!("or" in query) || query.or.length <= 1) {
    return null;
  }

  const leafQueries: Array<QueryLeaf> = [];

  for (const childQuery of query.or) {
    if (!isQueryLeaf(childQuery)) {
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
  queries: Array<QueryLeaf>,
): string {
  const firstQuery = queries[0];

  if (firstQuery == null) {
    throw new Error("Cannot build an includes group without queries");
  }

  const groupValue = getGroupableIncludesValue(firstQuery);

  if (groupValue == null) {
    throw new Error("Cannot build an includes group without a search value");
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

function buildQueryNode(context: QueryCompilerContext, query: Query): string {
  if (isQueryLeaf(query)) {
    const queryExpression = buildLeafQueryExpression(context, query);

    return query.isNegated === true ?
        buildNotCtsQueryExpression(queryExpression)
      : queryExpression;
  }

  const optimizedIncludesGroupQueries = getCompatibleIncludesGroupLeaves(query);

  if (optimizedIncludesGroupQueries != null) {
    return buildIncludesGroupQueryExpression(
      context,
      optimizedIncludesGroupQueries,
    );
  }

  const childQueryExpressions: Array<string> = [];

  for (const childQuery of getQueryGroupChildren(query)) {
    childQueryExpressions.push(buildQueryNode(context, childQuery));
  }

  return getQueryGroupOperator(query) === "and" ?
      buildAndCtsQueryExpressionInternal(childQueryExpressions)
    : buildOrCtsQueryExpressionInternal(childQueryExpressions);
}

export function buildBelongsToCollectionQueryExpression(
  belongsToCollectionScopeUuids: Array<string>,
  belongsToCollectionPropertyVariableUuid: string,
): string | null {
  if (belongsToCollectionScopeUuids.length === 0) {
    return null;
  }

  const collectionValueQueryExpressions: Array<string> = [];

  for (const uuid of belongsToCollectionScopeUuids) {
    collectionValueQueryExpressions.push(
      buildPlainElementAttributeValueQueryExpression({
        elementName: "value",
        attributeName: "uuid",
        value: uuid,
      }),
    );
  }

  return buildPropertyQueryExpression({
    propertyVariable: belongsToCollectionPropertyVariableUuid,
    queryExpression: buildNestedElementQuery(
      ["value"],
      buildOrCtsQueryExpressionInternal(collectionValueQueryExpressions),
    ),
  });
}

export function buildQueryPlan(params: { queries: Query | null }): {
  prolog: string;
  queryExpression: string | null;
} {
  const { queries } = params;

  if (queries == null) {
    return { prolog: "", queryExpression: null };
  }

  const context = createQueryCompilerContext();
  const queryExpression = buildQueryNode(context, queries);

  return { prolog: context.helperDeclarations.join("\n\n"), queryExpression };
}

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

// Each distinct OCR text search doubles the number of compiled search branches,
// so the ceiling keeps a pathological query from fanning out without bound.
const MAX_OCR_TEXT_CONDITIONS = 4;

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
type OcrTextQuery = Extract<QueryLeaf, { target: "ocrText" }>;
type CtsQueryLeaf = Exclude<QueryLeaf, OcrTextQuery>;

type OcrTextCondition = { variableName: string; bindingExpression: string };

type QueryCompilerContext = {
  nextHelperSerial: number;
  helperNamesByKey: Map<string, string>;
  helperDeclarations: Array<string>;
  ocrTextConditions: Array<OcrTextCondition>;
  ocrTextConditionIndexesByKey: Map<string, number>;
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
      ? buildRichTextExactQueryExpression({ value, isCaseSensitive })
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

// OCR text is a single flat text node, so a phrase is never split across
// element boundaries the way rich text runs are. That makes the token-AND
// fallback of `buildRichTextExactQueryExpression` both unnecessary and wrong
// here: it would let an exact query match the words in any order.
function buildOcrTextQueryExpression(query: OcrTextQuery): string {
  const { value, matchMode, isCaseSensitive } = query;
  const phraseQueryExpression = buildRichTextPhraseQueryExpression({
    value,
    isCaseSensitive,
  });

  if (matchMode === "exact") {
    return buildNestedElementQuery(["ocrText"], phraseQueryExpression);
  }

  const terms = tokenizeIncludesSearchValue({ value, isCaseSensitive });

  if (terms.length === 0) {
    return "cts:false-query()";
  }

  const tokenizedQueryExpression = buildAndCtsQueryExpressionInternal(
    Array.from(terms, (term) =>
      buildCtsWordQueryExpression({
        value: term,
        matchMode,
        isCaseSensitive,
        queryFamily: "text",
      }),
    ),
  );
  const valueQueryExpression = shouldUseFullValueFallbackForIncludes({
    value,
    isCaseSensitive,
    terms,
  })
    ? buildOrCtsQueryExpressionInternal([
        phraseQueryExpression,
        tokenizedQueryExpression,
      ])
    : tokenizedQueryExpression;

  return buildNestedElementQuery(["ocrText"], valueQueryExpression);
}

function getOcrTextConditionKey(query: OcrTextQuery): string {
  return [
    query.value,
    query.matchMode,
    query.isCaseSensitive ? "case-sensitive" : "case-insensitive",
  ].join("|");
}

function registerOcrTextCondition(
  context: QueryCompilerContext,
  query: OcrTextQuery,
): void {
  const key = getOcrTextConditionKey(query);

  if (context.ocrTextConditionIndexesByKey.has(key)) {
    return;
  }

  context.ocrTextConditionIndexesByKey.set(
    key,
    context.ocrTextConditions.length,
  );
  context.ocrTextConditions.push({
    variableName: `$ocrTextUuids${context.ocrTextConditions.length + 1}`,
    // `cts:uris` resolves from indexes only, which reports false positives for
    // phrase and wildcard matches. A filtered `cts:search` is the only accurate
    // way to resolve the matching document URIs.
    bindingExpression: `for $ocrTextDocument in cts:search(doc(), ${buildOcrTextQueryExpression(query)})\n    return document-uri($ocrTextDocument)`,
  });
}

function collectOcrTextConditions(
  context: QueryCompilerContext,
  query: Query,
): void {
  if (isQueryLeaf(query)) {
    if (query.target === "ocrText") {
      registerOcrTextCondition(context, query);
    }

    return;
  }

  for (const childQuery of getQueryGroupChildren(query)) {
    collectOcrTextConditions(context, childQuery);
  }
}

function isOcrTextLeafMatched(
  context: QueryCompilerContext,
  query: OcrTextQuery,
  ocrTextValues: ReadonlyArray<boolean>,
): boolean {
  const conditionIndex = context.ocrTextConditionIndexesByKey.get(
    getOcrTextConditionKey(query),
  );
  const isMatched =
    conditionIndex != null && ocrTextValues[conditionIndex] === true;

  return query.isNegated === true ? !isMatched : isMatched;
}

/**
 * Enumerate every assignment of "this item is in the OCR text match set" across
 * the compiled conditions, least significant position first
 */
function getOcrTextValueCombinations(count: number): Array<Array<boolean>> {
  return Array.from({ length: 2 ** count }, (_, index) =>
    Array.from(
      { length: count },
      (_, position) => ((index >> position) & 1) === 1,
    ),
  );
}

/**
 * Resolve a query tree against one OCR text assignment, treating every CTS leaf
 * as unknown. Only a definite `false` is actionable: it means the branch cannot
 * match anything and can be dropped before it costs a `cts:search`.
 */
function evaluateOcrTextBranch(
  context: QueryCompilerContext,
  query: Query,
  ocrTextValues: ReadonlyArray<boolean>,
): boolean | null {
  if (isQueryLeaf(query)) {
    return query.target === "ocrText"
      ? isOcrTextLeafMatched(context, query, ocrTextValues)
      : null;
  }

  const isAndGroup = "and" in query;
  let result: boolean | null = isAndGroup;

  for (const childQuery of getQueryGroupChildren(query)) {
    const childResult = evaluateOcrTextBranch(
      context,
      childQuery,
      ocrTextValues,
    );

    if (childResult === !isAndGroup) {
      return !isAndGroup;
    }

    if (childResult == null) {
      result = null;
    }
  }

  return result;
}

function buildOcrTextItemPredicates(
  context: QueryCompilerContext,
  ocrTextValues: ReadonlyArray<boolean>,
): string {
  const itemPredicates: Array<string> = Array.from(
    context.ocrTextConditions,
    (condition, index) =>
      ocrTextValues[index] === true
        ? `[@uuid = ${condition.variableName}]`
        : `[not(@uuid = ${condition.variableName})]`,
  );

  return itemPredicates.join("");
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
    ocrTextConditions: [],
    ocrTextConditionIndexesByKey: new Map(),
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

function getCompatibleIncludesGroupLeaves(
  query: QueryGroup,
): Array<CtsQueryLeaf> | null {
  if (!("or" in query) || query.or.length <= 1) {
    return null;
  }

  const leafQueries: Array<CtsQueryLeaf> = [];

  for (const childQuery of query.or) {
    if (!isQueryLeaf(childQuery) || childQuery.target === "ocrText") {
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
  ocrTextValues: ReadonlyArray<boolean>,
): string {
  if (isQueryLeaf(query)) {
    if (query.target === "ocrText") {
      return isOcrTextLeafMatched(context, query, ocrTextValues)
        ? "cts:true-query()"
        : "cts:false-query()";
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

  const childQueryExpressions: Array<string> = Array.from(
    getQueryGroupChildren(query),
    (childQuery) => buildQueryNode(context, childQuery, ocrTextValues),
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

/**
 * Compile a query tree into the CTS searches that resolve it
 *
 * OCR text is not carried by Set item projections, so an `ocrText` leaf cannot
 * be a CTS term: it resolves to a document join whose UUID list can only be
 * applied as an item path predicate, and path predicates only ever AND. To keep
 * `ocrText` composable with `or` anyway, the tree is split on each distinct OCR
 * text condition, one branch per assignment of "this item is in that match
 * set". Every branch is a plain CTS search, and their union is the result.
 * Branches that the assignment already rules out are dropped, so a query whose
 * OCR text leaves are all conjunctive still compiles to a single search.
 */
export function buildQueryPlan(parameters: { queries: Query | null }): {
  prolog: string;
  ocrTextBindings: Array<{ name: string; expression: string }>;
  branches: Array<{ itemPredicates: string; queryExpression: string | null }>;
} {
  const { queries } = parameters;

  if (queries == null) {
    return {
      prolog: "",
      ocrTextBindings: [],
      branches: [{ itemPredicates: "", queryExpression: null }],
    };
  }

  const context = createQueryCompilerContext();
  collectOcrTextConditions(context, queries);

  if (context.ocrTextConditions.length > MAX_OCR_TEXT_CONDITIONS) {
    throw new Error(
      `A query cannot contain more than ${MAX_OCR_TEXT_CONDITIONS} distinct OCR text searches`,
      { cause: context.ocrTextConditions.length },
    );
  }

  const branches: Array<{
    itemPredicates: string;
    queryExpression: string | null;
  }> = [];

  for (const ocrTextValues of getOcrTextValueCombinations(
    context.ocrTextConditions.length,
  )) {
    if (evaluateOcrTextBranch(context, queries, ocrTextValues) === false) {
      continue;
    }

    branches.push({
      itemPredicates: buildOcrTextItemPredicates(context, ocrTextValues),
      queryExpression: buildQueryNode(context, queries, ocrTextValues),
    });
  }

  return {
    prolog: context.helperDeclarations.join("\n\n"),
    ocrTextBindings: Array.from(context.ocrTextConditions, (condition) => ({
      name: condition.variableName,
      expression: condition.bindingExpression,
    })),
    branches,
  };
}

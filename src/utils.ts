import * as v from "valibot";
import type {
  LanguageCodes,
  Property,
  SetItemProperty,
} from "./types/index.js";

const MAX_SCHEMA_VALIDATION_ISSUES = 3;
const PSEUDO_UUID_REGEX = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
type SchemaValidationIssue = v.BaseIssue<unknown>;

function getSchemaValidationLeafIssues(
  issues: ReadonlyArray<SchemaValidationIssue>,
  leaves: Array<SchemaValidationIssue> = [],
): Array<SchemaValidationIssue> {
  for (const issue of issues) {
    if (issue.issues != null && issue.issues.length > 0) {
      getSchemaValidationLeafIssues(issue.issues, leaves);
      continue;
    }

    leaves.push(issue);
  }

  return leaves;
}

function formatSchemaValidationIssue(issue: SchemaValidationIssue): string {
  const path = v.getDotPath(issue);
  return `${path != null && path.length > 0 ? path : "(root)"}: ${
    issue.message
  }`;
}

/**
 * Formats Valibot validation issues for compact error messages.
 * @param issues - The validation issues to format
 * @internal
 */
export function formatSchemaValidationIssues(
  issues: ReadonlyArray<SchemaValidationIssue>,
): string {
  const leafIssues = getSchemaValidationLeafIssues(issues);
  const issuesToFormat = leafIssues.length > 0 ? leafIssues : issues;
  const formattedIssues: Array<string> = [];

  for (const issue of issuesToFormat.slice(0, MAX_SCHEMA_VALIDATION_ISSUES)) {
    formattedIssues.push(formatSchemaValidationIssue(issue));
  }

  const hiddenIssueCount = issuesToFormat.length - formattedIssues.length;
  if (hiddenIssueCount > 0) {
    formattedIssues.push(`+${hiddenIssueCount.toLocaleString("en-US")} more`);
  }

  return `Schema validation failed: ${formattedIssues.join("; ")}`;
}

/**
 * Creates an Error whose message includes compact schema-validation details.
 * @param message - The base error message
 * @param issues - The validation issues to include
 * @internal
 */
export function createSchemaValidationError(
  message: string,
  issues: ReadonlyArray<SchemaValidationIssue>,
): Error {
  return new Error(`${message}. ${formatSchemaValidationIssues(issues)}`, {
    cause: issues,
  });
}

/**
 * Logs Valibot validation issues to the console with detailed formatting
 * @param issues - The validation issues to log
 * @param depth - The depth of the issues for indentation
 * @internal
 */
export function logIssues(
  issues: ReturnType<typeof v.safeParse>["issues"],
  depth = 0,
): void {
  if (issues == null) {
    return;
  }

  for (const issue of issues) {
    const indent = "  ".repeat(depth);
    const prefix = depth === 0 ? "❌" : "└─";

    const pathStr =
      issue.path != null && issue.path.length > 0
        ? ` at ${v.getDotPath(issue)}`
        : "";

    const typeInfo = `[${issue.kind}:${issue.type}]`;

    console.error(`${indent}${prefix} ${typeInfo} ${issue.message}${pathStr}`);

    if (issue.expected != null) {
      console.error(`${indent}   Expected: ${issue.expected}`);
      console.error(`${indent}   Received: ${issue.received}`);
    }

    if (issue.input !== undefined && typeof issue.input !== "object") {
      console.error(`${indent}   Input: ${JSON.stringify(issue.input)}`);
    }

    if (issue.requirement !== undefined) {
      console.error(
        `${indent}   Requirement: ${JSON.stringify(issue.requirement)}`,
      );
    }

    if (issue.issues != null && issue.issues.length > 0) {
      console.error(`${indent}   Nested issues:`);
      logIssues(issue.issues, depth + 1);
    }

    if (depth === 0) {
      console.error("");
    }
  }
}

/**
 * Validates a pseudo-UUID string
 * @param value - The string to validate
 * @returns True if the string is a valid pseudo-UUID, false otherwise
 * @internal
 */
export function isPseudoUuid(value: string): boolean {
  return PSEUDO_UUID_REGEX.test(value);
}

/**
 * Build a string literal for an XQuery string
 * @param value - The string value to escape
 * @returns The escaped string literal
 */
export function stringLiteral(value: string): string {
  const escapedDoubleQuote = value.replaceAll('"', '""');
  return `"${escapedDoubleQuote}"`;
}

/**
 * Flatten a properties array
 * @param properties - The properties to flatten
 * @returns The flattened properties
 * @internal
 */
export function flattenProperties<T extends LanguageCodes = LanguageCodes>(
  properties: ReadonlyArray<Property<T> | SetItemProperty<T>>,
): Array<SetItemProperty<T>> {
  const result: Array<SetItemProperty<T>> = [];

  for (const property of properties) {
    result.push({
      variable: property.variable,
      values: property.values,
      comment: property.comment,
    });

    if ("properties" in property) {
      result.push(...flattenProperties(property.properties));
    }
  }

  return result;
}

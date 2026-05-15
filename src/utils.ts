import * as v from "valibot";
import type {
  LanguageCodes,
  Property,
  SetItemProperty,
} from "./types/index.js";

const PSEUDO_UUID_REGEX = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
type SchemaValidationIssue = v.BaseIssue<unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

function isSchemaValidationIssue(
  value: unknown,
): value is SchemaValidationIssue {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.kind === "string" &&
    typeof value.type === "string" &&
    typeof value.message === "string"
  );
}

function isSchemaValidationIssues(
  value: unknown,
): value is ReadonlyArray<SchemaValidationIssue> {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  for (const item of value) {
    if (!isSchemaValidationIssue(item)) {
      return false;
    }
  }

  return true;
}

function getIssuePath(issue: SchemaValidationIssue): string {
  const path = v.getDotPath(issue);
  return path != null && path.length > 0 ? path : "(root)";
}

function formatPrimitiveValue(value: unknown): string | null {
  if (value == null) {
    return String(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "symbol"
  ) {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof RegExp) {
    return String(value);
  }

  return null;
}

function appendSchemaValidationIssues(
  lines: Array<string>,
  issues: ReadonlyArray<SchemaValidationIssue>,
  depth = 0,
  prefix = "",
): void {
  let index = 0;
  for (const issue of issues) {
    index += 1;
    const number = prefix.length > 0 ? `${prefix}.${index}` : String(index);
    const indent = "  ".repeat(depth);
    lines.push(
      `${indent}${number}. ${getIssuePath(issue)}`,
      `${indent}   Message: ${issue.message}`,
      `${indent}   Type: ${issue.kind}:${issue.type}`,
    );

    if (issue.expected != null) {
      lines.push(`${indent}   Expected: ${issue.expected}`);
    }

    if (issue.received.length > 0) {
      lines.push(`${indent}   Received: ${issue.received}`);
    }

    const input = formatPrimitiveValue(issue.input);
    if (input != null) {
      lines.push(`${indent}   Input: ${input}`);
    }

    const requirement = formatPrimitiveValue(issue.requirement);
    if (requirement != null) {
      lines.push(`${indent}   Requirement: ${requirement}`);
    }

    if (issue.issues != null && issue.issues.length > 0) {
      lines.push(`${indent}   Nested issues:`);
      appendSchemaValidationIssues(lines, issue.issues, depth + 1, number);
    }
  }
}

function formatCauseValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value.length > 0 ? value : null;
  }

  const primitiveValue = formatPrimitiveValue(value);
  if (primitiveValue != null) {
    return primitiveValue;
  }

  if (Array.isArray(value)) {
    const values: Array<string> = [];
    for (const item of value) {
      const formattedItem =
        typeof item === "string" && item.length > 0
          ? item
          : formatPrimitiveValue(item);
      if (formattedItem != null && formattedItem.length > 0) {
        values.push(formattedItem);
      }
    }

    return values.length > 0 ? values.join(", ") : null;
  }

  if (isRecord(value)) {
    const values: Array<string> = [];
    for (const [key, entryValue] of Object.entries(value)) {
      const formattedEntryValue = formatPrimitiveValue(entryValue);
      if (formattedEntryValue != null) {
        values.push(`${key}: ${formattedEntryValue}`);
      }
    }

    return values.length > 0 ? values.join("; ") : null;
  }

  return null;
}

function appendDetailedError(
  lines: Array<string>,
  error: unknown,
  fallbackMessage: string,
  depth: number,
  seenErrors: Set<unknown>,
): void {
  const indent = "  ".repeat(depth);

  if (error instanceof Error) {
    if (seenErrors.has(error)) {
      lines.push(`${indent}Error: [Circular cause]`);
      return;
    }
    seenErrors.add(error);

    lines.push(`${indent}Error`);
    if (error.name !== "Error") {
      lines.push(`${indent}Name: ${error.name}`);
    }
    lines.push(`${indent}Message: ${error.message}`);

    if (error instanceof AggregateError && error.errors.length > 0) {
      lines.push("", `${indent}Contained errors`);
      let index = 0;
      for (const containedError of error.errors) {
        index += 1;
        lines.push(`${indent}${index}.`);
        appendDetailedError(
          lines,
          containedError,
          "Unknown error",
          depth + 1,
          seenErrors,
        );
      }
    }

    if (error.cause != null) {
      const causeLines: Array<string> = [];
      if (appendDetailedCause(causeLines, error.cause, depth, seenErrors)) {
        lines.push("", ...causeLines);
      }
    }
    return;
  }

  lines.push(`${indent}Error`, `${indent}Message: ${fallbackMessage}`);

  const value = formatCauseValue(error);
  if (value != null) {
    lines.push(`${indent}Value: ${value}`);
  }
}

function appendDetailedCause(
  lines: Array<string>,
  cause: unknown,
  depth: number,
  seenErrors: Set<unknown>,
): boolean {
  const indent = "  ".repeat(depth);

  if (isSchemaValidationIssues(cause)) {
    lines.push(`${indent}Schema validation`);
    appendSchemaValidationIssues(lines, cause, depth);
    return true;
  }

  if (cause instanceof Error) {
    lines.push(`${indent}Cause`);
    appendDetailedError(lines, cause, cause.message, depth + 1, seenErrors);
    return true;
  }

  const formattedCause = formatCauseValue(cause);
  if (formattedCause != null) {
    lines.push(`${indent}Cause`, `${indent}${formattedCause}`);
    return true;
  }

  return false;
}

export function getErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

export function getDetailedError(
  error: unknown,
  fallbackMessage = "Unknown error",
): string {
  const lines: Array<string> = [];
  appendDetailedError(lines, error, fallbackMessage, 0, new Set<unknown>());
  return lines.join("\n");
}

export function getErrorOutput(
  error: unknown,
  fallbackMessage: string,
): { error: string; detailedError: string } {
  const message = getErrorMessage(error, fallbackMessage);
  return { error: message, detailedError: getDetailedError(error, message) };
}

export function createSchemaValidationError(
  message: string,
  issues: ReadonlyArray<SchemaValidationIssue>,
): Error {
  return new Error(message, { cause: issues });
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

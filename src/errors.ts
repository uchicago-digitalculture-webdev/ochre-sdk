import * as v from "valibot";
import { isObject, readEntries } from "#/reflection.js";

type SchemaValidationIssue = v.BaseIssue<unknown>;

/**
 * The shape a valibot issue has to have for this module to render it
 *
 * A schema rather than a hand-written predicate: the fields being checked are
 * exactly a shape, and `v.is` narrows without asserting anything unchecked. An
 * array cannot pass, because it carries none of these fields.
 */
const schemaValidationIssueSchema = v.looseObject({
  kind: v.string(),
  type: v.string(),
  message: v.string(),
});

const schemaValidationIssuesSchema = v.pipe(
  v.array(schemaValidationIssueSchema),
  v.minLength(1),
);

function isSchemaValidationIssues(
  value: unknown,
): value is ReadonlyArray<SchemaValidationIssue> {
  return v.is(schemaValidationIssuesSchema, value);
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

function formatCauseArray(value: ReadonlyArray<unknown>): string | null {
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

function formatCauseRecord(value: object): string | null {
  const values: Array<string> = [];
  for (const [key, entryValue] of readEntries(value)) {
    const formattedEntryValue = formatPrimitiveValue(entryValue);
    if (formattedEntryValue != null) {
      values.push(`${key}: ${formattedEntryValue}`);
    }
  }

  return values.length > 0 ? values.join("; ") : null;
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
    return formatCauseArray(value);
  }

  if (isObject(value)) {
    return formatCauseRecord(value);
  }

  return null;
}

function appendContainedErrors(
  lines: Array<string>,
  containedErrors: ReadonlyArray<unknown>,
  indent: string,
  depth: number,
  seenErrors: Set<unknown>,
): void {
  lines.push("", `${indent}Contained errors`);
  let index = 0;
  for (const containedError of containedErrors) {
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
      appendContainedErrors(lines, error.errors, indent, depth, seenErrors);
    }

    if (error.cause != null) {
      const causeLines: Array<string> = [];
      if (didAppendDetailedCause(causeLines, error.cause, depth, seenErrors)) {
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

function didAppendDetailedCause(
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

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

function getDetailedError(
  error: unknown,
  fallbackMessage = "Unknown error",
): string {
  const lines: Array<string> = [];
  appendDetailedError(lines, error, fallbackMessage, 0, new Set<unknown>());
  return lines.join("\n");
}

/**
 * Render an error as a short message and a fully detailed report
 * @param error - The thrown value
 * @param fallbackMessage - The message to use when the value is not an Error
 * @returns The message and the detailed report
 * @internal
 */
export function getErrorOutput(
  error: unknown,
  fallbackMessage: string,
): { error: string; detailedError: string } {
  const message = getErrorMessage(error, fallbackMessage);
  return { error: message, detailedError: getDetailedError(error, message) };
}

/**
 * Wrap schema validation issues in an error {@link getErrorOutput} can render
 * @param message - The failure message
 * @param issues - The validation issues to carry as the cause
 * @returns The error
 * @internal
 */
export function createSchemaValidationError(
  message: string,
  issues: ReadonlyArray<SchemaValidationIssue>,
): Error {
  return new Error(message, { cause: issues });
}

/**
 * Validates a pseudo-UUID string
 * @param value - The string to validate
 * @returns True if the string is a valid pseudo-UUID, false otherwise
 * @internal
 */

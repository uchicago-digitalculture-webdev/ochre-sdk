import * as v from "valibot";

/**
 * Logs Valibot validation issues to the console with detailed formatting
 * @param issues - The validation issues to log
 * @param depth - The depth of the issues for indentation
 * @internal
 */
export function logIssues(
  issues: ReturnType<typeof v.safeParse>["issues"],
  depth = 0,
) {
  if (issues == null) {
    return;
  }

  for (const issue of issues) {
    const indent = "  ".repeat(depth);
    const prefix = depth === 0 ? "❌" : "└─";

    // Build the path string if available
    const pathStr =
      issue.path != null && issue.path.length > 0 ?
        ` at ${v.getDotPath(issue)}`
      : "";

    // Format the issue type and kind
    const typeInfo = `[${issue.kind}:${issue.type}]`;

    // Main error message
    console.error(`${indent}${prefix} ${typeInfo} ${issue.message}${pathStr}`);

    // Additional details with better formatting
    if (issue.expected != null) {
      console.error(`${indent}   Expected: ${issue.expected}`);
      console.error(`${indent}   Received: ${issue.received}`);
    }

    // Show input value if it's not the same as received and is useful
    if (issue.input !== undefined && typeof issue.input !== "object") {
      console.error(`${indent}   Input: ${JSON.stringify(issue.input)}`);
    }

    // Show requirement if available (for validation actions like minLength, etc.)
    if (issue.requirement !== undefined) {
      console.error(
        `${indent}   Requirement: ${JSON.stringify(issue.requirement)}`,
      );
    }

    // Recursively log nested issues
    if (issue.issues != null && issue.issues.length > 0) {
      console.error(`${indent}   Nested issues:`);
      logIssues(issue.issues, depth + 1);
    }

    // Add separator for better readability between issues at the same level
    if (depth === 0) {
      console.error("");
    }
  }
}

import type * as v from "valibot";

/**
 * Logs Valibot validation issues to the console
 * @param issues - The validation issues to log
 * @param depth - The depth of the issues
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
    console.error("\t".repeat(depth), issue.message);
    if (issue.issues != null && issue.issues.length > 0) {
      logIssues(issue.issues, depth + 1);
    }
  }
}

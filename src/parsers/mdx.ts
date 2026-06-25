const MDX_LITERAL_EXPRESSION_REGEX = /[!#*<>[\]_`{|}~]/;
const MDX_LITERAL_BLOCK_REGEX =
  /(?:^|\n)[\t ]*(?:import|export|[+>-]|\d+[).])(?:[\t ]|$)/;
const MDX_MULTIPLE_SPACES_REGEX = / {2,}/g;
const MDX_INLINE_BOUNDARY_PATTERN =
  "(?:Annotation|ExternalLink|InlineImage|InternalLink|TooltipSpan|em|strong|u)";
const MDX_INLINE_BOUNDARY_SPACES_REGEX = new RegExp(
  String.raw`(\}|<\/${MDX_INLINE_BOUNDARY_PATTERN}>|\/>)([\t ]+)(?=\{|<\/?${MDX_INLINE_BOUNDARY_PATTERN}\b)`,
  "g",
);
const MDX_INLINE_BOUNDARY_REGEX = new RegExp(
  String.raw`(?:\}[\t ]*|<\/${MDX_INLINE_BOUNDARY_PATTERN}>|\/>)(?=\{|<\/?${MDX_INLINE_BOUNDARY_PATTERN}\b)`,
);

function preserveMultipleSpaces(value: string): string {
  return value.replaceAll(
    MDX_MULTIPLE_SPACES_REGEX,
    (spaces) => `${spaces.slice(0, 1)}${"\u{A0}".repeat(spaces.length - 1)}`,
  );
}

export function serializeMDXText(value: string): string {
  const displaySafeValue = preserveMultipleSpaces(value);
  const isPreservingDisplaySpacing = displaySafeValue !== value;

  if (
    displaySafeValue === "" ||
    (!isPreservingDisplaySpacing &&
      !MDX_LITERAL_EXPRESSION_REGEX.test(displaySafeValue) &&
      !MDX_LITERAL_BLOCK_REGEX.test(displaySafeValue))
  ) {
    return displaySafeValue;
  }

  return `{${JSON.stringify(displaySafeValue)}}`;
}

export function serializeMDXContent(value: string): string {
  const content = value.replaceAll(
    MDX_INLINE_BOUNDARY_SPACES_REGEX,
    (_, previousBoundary: string, spaces: string) =>
      `${previousBoundary}{${JSON.stringify(preserveMultipleSpaces(spaces))}}`,
  );

  if (!MDX_INLINE_BOUNDARY_REGEX.test(content)) {
    return content;
  }

  return content.endsWith("\n") ? `<>\n${content}</>` : `<>\n${content}\n</>`;
}

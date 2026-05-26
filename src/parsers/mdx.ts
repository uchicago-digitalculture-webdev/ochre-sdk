const MDX_LITERAL_EXPRESSION_REGEX = /[!#*<>[\]_`{|}~]/;
const MDX_LITERAL_BLOCK_REGEX =
  /(?:^|\n)[\t ]*(?:import|export|[+>-]|\d+[).])(?:[\t ]|$)/;

export function serializeMDXText(value: string): string {
  if (
    value === "" ||
    (!MDX_LITERAL_EXPRESSION_REGEX.test(value) &&
      !MDX_LITERAL_BLOCK_REGEX.test(value))
  ) {
    return value;
  }

  return `{${JSON.stringify(value)}}`;
}

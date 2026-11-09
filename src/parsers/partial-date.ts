import type {
  PartialDate,
  PartialDateBound,
  PartialDateQualifier,
  PartialDateSeason,
  PartialDateValue,
} from "#/types/index.js";
import type { XMLPartialDates } from "#/xml/types.js";

const YEAR_REGEX = /^([?~%])?(\d[\dX]{3})([?~%])?$/i;

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const SEASONS: Record<string, PartialDateSeason> = {
  spring: "spring",
  summer: "summer",
  autumn: "autumn",
  fall: "autumn",
  winter: "winter",
};

const SEASON_CODES: Record<PartialDateSeason, number> = {
  spring: 21,
  summer: 22,
  autumn: 23,
  winter: 24,
};

const QUALIFIER_SYMBOLS: Record<PartialDateQualifier, string> = {
  uncertain: "?",
  approximate: "~",
  uncertainAndApproximate: "%",
};

function parseQualifier(symbols: Array<string>): PartialDateQualifier | null {
  const isUncertain = symbols.some(
    (symbol) => symbol === "?" || symbol === "%",
  );
  const isApproximate = symbols.some(
    (symbol) => symbol === "~" || symbol === "%",
  );

  if (isUncertain && isApproximate) {
    return "uncertainAndApproximate";
  }
  if (isUncertain) {
    return "uncertain";
  }
  if (isApproximate) {
    return "approximate";
  }

  return null;
}

function parseYear(
  value: string,
): Pick<PartialDateValue, "year" | "qualifier"> | null {
  const match = YEAR_REGEX.exec(value);
  if (match == null) {
    return null;
  }

  const [, prefix, year, suffix] = match;
  const symbols: Array<string> = [];
  for (const symbol of [prefix, suffix]) {
    if (symbol != null) {
      symbols.push(symbol);
    }
  }

  return { year: year!.toUpperCase(), qualifier: parseQualifier(symbols) };
}

function parseMonthOrSeason(
  value: string,
): Pick<PartialDateValue, "month" | "season"> | null {
  if (/^\d{1,2}$/.test(value)) {
    const month = Number(value);
    return month >= 1 && month <= 12 ? { month, season: null } : null;
  }

  const name = value.toLowerCase();
  const season = SEASONS[name];
  if (season != null) {
    return { month: null, season };
  }

  const index = MONTH_NAMES.findIndex(
    (monthName) => monthName === name || monthName.slice(0, 3) === name,
  );

  return index === -1 ? null : { month: index + 1, season: null };
}

function getDaysInMonth(year: string, month: number): number {
  if (month === 2) {
    if (year.includes("X")) {
      return 29;
    }

    const yearNumber = Number(year);
    const isLeapYear =
      yearNumber % 4 === 0 &&
      (yearNumber % 100 !== 0 || yearNumber % 400 === 0);
    return isLeapYear ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseDay(value: string, year: string, month: number): number | null {
  if (!/^\d{1,2}$/.test(value)) {
    return null;
  }

  const day = Number(value);
  return day >= 1 && day <= getDaysInMonth(year, month) ? day : null;
}

function parseOneOf(year: string): Array<PartialDateValue> | null {
  const values: Array<PartialDateValue> = [];
  for (const part of year.split("/")) {
    const parsedYear = parseYear(part.trim());
    if (parsedYear == null) {
      return null;
    }

    values.push({ ...parsedYear, month: null, season: null, day: null });
  }

  return values;
}

function parseDate(
  year: string,
  month: string,
  day: string,
): PartialDateValue | null {
  const parsedYear = parseYear(year);
  const parsedMonth =
    month === "" ? { month: null, season: null } : parseMonthOrSeason(month);
  if (parsedYear == null || parsedMonth == null) {
    return null;
  }

  if (day === "") {
    return { ...parsedYear, ...parsedMonth, day: null };
  }

  const parsedDay =
    parsedMonth.month == null
      ? null
      : parseDay(day, parsedYear.year, parsedMonth.month);

  return parsedDay == null
    ? null
    : { ...parsedYear, ...parsedMonth, day: parsedDay };
}

function parseBound(
  rawYear: string | undefined,
  rawMonth: string | undefined,
  rawDay: string | undefined,
): PartialDateBound | null {
  const year = rawYear?.trim() ?? "";
  const month = rawMonth?.trim() ?? "";
  const day = rawDay?.trim() ?? "";

  if (year === "" && month === "" && day === "") {
    return null;
  }

  if (year.includes("/")) {
    const values = month === "" && day === "" ? parseOneOf(year) : null;
    if (values != null) {
      return { kind: "oneOf", values };
    }
  } else {
    const value = parseDate(year, month, day);
    if (value != null) {
      return { kind: "date", value };
    }
  }

  return {
    kind: "unparsed",
    year: year === "" ? null : year,
    month: month === "" ? null : month,
    day: day === "" ? null : day,
  };
}

function isBefore(start: PartialDateValue, end: PartialDateValue): boolean {
  const startParts = [
    Number(start.year.replaceAll("X", "0")),
    start.month ?? 1,
    start.day ?? 1,
  ];
  const endParts = [
    Number(end.year.replaceAll("X", "0")),
    end.month ?? 1,
    end.day ?? 1,
  ];

  for (const [index, startPart] of startParts.entries()) {
    const endPart = endParts[index]!;
    if (startPart !== endPart) {
      return startPart < endPart;
    }
  }

  return false;
}

function formatEdtfValue(value: PartialDateValue): string | null {
  if (
    value.qualifier != null &&
    (value.year.includes("X") || value.season != null)
  ) {
    return null;
  }

  let edtf = value.year;
  if (value.qualifier != null) {
    edtf += QUALIFIER_SYMBOLS[value.qualifier];
  }
  if (value.month != null) {
    edtf += `-${value.month.toString().padStart(2, "0")}`;
  }
  if (value.season != null) {
    edtf += `-${SEASON_CODES[value.season]}`;
  }
  if (value.day != null) {
    edtf += `-${value.day.toString().padStart(2, "0")}`;
  }

  return edtf;
}

function formatEdtfRangeValue(value: PartialDateValue): string | null {
  return value.season == null ? formatEdtfValue(value) : null;
}

function formatEdtfSet(values: Array<PartialDateValue>): string | null {
  const members: Array<string> = [];
  for (const value of values) {
    const member = value.qualifier == null ? formatEdtfValue(value) : null;
    if (member == null) {
      return null;
    }

    members.push(member);
  }

  return `[${members.join(",")}]`;
}

function formatEdtf(
  start: PartialDateBound | null,
  end: PartialDateBound | null,
): string | null {
  if (start == null) {
    if (end?.kind !== "date") {
      return null;
    }

    const endEdtf = formatEdtfRangeValue(end.value);
    return endEdtf == null ? null : `../${endEdtf}`;
  }

  if (end == null) {
    switch (start.kind) {
      case "date": {
        return formatEdtfValue(start.value);
      }
      case "oneOf": {
        return formatEdtfSet(start.values);
      }
      case "unparsed": {
        return null;
      }
    }
  }

  if (
    start.kind !== "date" ||
    end.kind !== "date" ||
    !isBefore(start.value, end.value)
  ) {
    return null;
  }

  const startEdtf = formatEdtfRangeValue(start.value);
  const endEdtf = formatEdtfRangeValue(end.value);
  return startEdtf == null || endEdtf == null
    ? null
    : `${startEdtf}/${endEdtf}`;
}

/**
 * Parse the partial dates of an event
 *
 * Reads the year, month and day fields rather than the EDTF text OCHRE
 * writes alongside them, which leaves out every field that is not a plain
 * four-digit year. An end identical to the start is a single date. The EDTF
 * string is only set for what EDTF can express: no qualifier on a year with
 * unspecified digits or on a season, no season in a range, and no range
 * whose end begins before its start.
 * @param rawPartialDates - The raw partialDates element
 * @returns The parsed partial dates, or null when every field is empty
 * @internal
 */
export function parsePartialDate(
  rawPartialDates: XMLPartialDates | undefined,
): PartialDate | null {
  if (rawPartialDates == null) {
    return null;
  }

  const { year, month, day, endYear, endMonth, endDay } = rawPartialDates;
  const start = parseBound(year, month, day);
  const isEndSameAsStart =
    (year?.trim() ?? "") === (endYear?.trim() ?? "") &&
    (month?.trim() ?? "") === (endMonth?.trim() ?? "") &&
    (day?.trim() ?? "") === (endDay?.trim() ?? "");
  const end = isEndSameAsStart ? null : parseBound(endYear, endMonth, endDay);

  if (start == null && end == null) {
    return null;
  }

  return { start, end, edtf: formatEdtf(start, end) };
}

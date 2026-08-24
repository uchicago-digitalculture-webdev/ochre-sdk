/**
 * Regular expression to match ISO date/time strings and OCHRE's "YYYY-MM-DD HH:mm:ss" format.
 */
const DATE_TIME_REGEX =
  /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2})(?::(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?(Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

/**
 * Parses ISO date/time strings and OCHRE's "YYYY-MM-DD HH:mm:ss" format.
 * Like date-fns parseISO: strings without a timezone offset (including
 * date-only strings) are parsed as local time, not UTC. Returns an
 * Invalid Date for anything unparseable.
 *
 * @param value - The date/time string to parse.
 * @returns A Date object representing the parsed date/time, or an Invalid Date if parsing fails.
 * @internal
 */
export function parseDateTime(value: string): Date {
  const match = DATE_TIME_REGEX.exec(value.replace(" ", "T"));
  if (match == null) {
    return new Date(NaN);
  }

  const year = Number(match[1]);
  const month = match[2] != null ? Number(match[2]) - 1 : 0;
  const day = match[3] != null ? Number(match[3]) : 1;
  const hours = Number(match[4] ?? 0);
  const minutes = Number(match[5] ?? 0);
  const seconds = Number(match[6] ?? 0);
  const milliseconds =
    match[7] != null ? Number(match[7].slice(0, 3).padEnd(3, "0")) : 0;
  const timezone = match[8];

  const isMidnight24 =
    hours === 24 && minutes === 0 && seconds === 0 && milliseconds === 0;
  if (minutes > 59 || seconds > 59 || (!isMidnight24 && hours > 23)) {
    return new Date(NaN);
  }

  const date = new Date(0);
  if (timezone != null) {
    date.setUTCFullYear(year, month, day);
    if (date.getUTCMonth() !== month || date.getUTCDate() !== day) {
      return new Date(NaN);
    }
    date.setUTCHours(hours, minutes, seconds, milliseconds);
  } else {
    date.setFullYear(year, month, day);
    if (date.getMonth() !== month || date.getDate() !== day) {
      return new Date(NaN);
    }
    date.setHours(hours, minutes, seconds, milliseconds);
  }

  if (timezone == null || timezone === "Z") {
    return date;
  }

  const offsetSign = timezone.startsWith("+") ? -1 : 1;
  const offsetHours = Number(timezone.slice(1, 3));
  const offsetMinutes = Number(timezone.slice(3).replace(":", "") || "0");
  if (offsetMinutes > 59) {
    return new Date(NaN);
  }

  return new Date(
    date.getTime() +
      offsetSign * (offsetHours * 3_600_000 + offsetMinutes * 60_000),
  );
}

import { describe, expect, it } from "vitest";
import { parseDateTime } from "#/xml/dates.js";

/**
 * Returns the local time in milliseconds for the given date-time components.
 * @param year - The full year (e.g., 2024).
 * @param month - The month (1-12).
 * @param day - The day of the month (1-31).
 * @param hours - The hours (0-23), default is 0.
 * @param minutes - The minutes (0-59), default is 0.
 * @param seconds - The seconds (0-59), default is 0.
 * @param milliseconds - The milliseconds (0-999), default is 0.
 * @returns The local time in milliseconds since the Unix epoch.
 */
function localTime(
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
): number {
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hours, minutes, seconds, milliseconds);
  return date.getTime();
}

describe("parseDateTime", () => {
  it("parses date-only strings as local midnight", () => {
    expect(parseDateTime("2024-05-15").getTime()).toBe(localTime(2024, 5, 15));
  });

  it("parses partial dates (year, year-month) as local time", () => {
    expect(parseDateTime("2024").getTime()).toBe(localTime(2024, 1, 1));
    expect(parseDateTime("2024-05").getTime()).toBe(localTime(2024, 5, 1));
  });

  it("parses OCHRE's space-separated datetime as local time", () => {
    expect(parseDateTime("2024-05-15 10:30:45").getTime()).toBe(
      localTime(2024, 5, 15, 10, 30, 45),
    );
  });

  it("parses T-separated datetimes without offset as local time", () => {
    expect(parseDateTime("2024-05-15T10:30:45.5").getTime()).toBe(
      localTime(2024, 5, 15, 10, 30, 45, 500),
    );
  });

  it("parses UTC and offset timestamps", () => {
    expect(parseDateTime("2024-05-15T10:30:45Z").getTime()).toBe(
      Date.UTC(2024, 4, 15, 10, 30, 45),
    );
    expect(parseDateTime("2024-05-15T10:30:45+02:00").getTime()).toBe(
      Date.UTC(2024, 4, 15, 8, 30, 45),
    );
    expect(parseDateTime("2024-05-15T10:30:45-0530").getTime()).toBe(
      Date.UTC(2024, 4, 15, 16, 0, 45),
    );
  });

  it("handles ISO 24:00 midnight and years below 100", () => {
    expect(parseDateTime("2024-05-15T24:00:00").getTime()).toBe(
      localTime(2024, 5, 16),
    );
    expect(parseDateTime("0099-05-15T00:00:00Z").getTime()).toBe(
      new Date(0).setUTCFullYear(99, 4, 15),
    );
  });

  it("accepts leap days only in leap years", () => {
    expect(parseDateTime("2024-02-29").getTime()).toBe(localTime(2024, 2, 29));
    expect(parseDateTime("2023-02-29").getTime()).toBeNaN();
  });

  it("rejects invalid calendar dates and times", () => {
    for (const value of [
      "2024-13-01",
      "2024-00-10",
      "2024-05-00",
      "2024-05-32",
      "2024-05-15T24:30:00",
      "2024-05-15T10:60:00",
      "2024-05-15T10:30:60",
    ]) {
      expect(parseDateTime(value).getTime(), value).toBeNaN();
    }
  });

  it("rejects non-ISO strings", () => {
    for (const value of ["", "garbage", "March 5, 2024", "15-05-2024"]) {
      expect(parseDateTime(value).getTime(), value).toBeNaN();
    }
  });
});

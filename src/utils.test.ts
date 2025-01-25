import { expect, it } from "vitest";
import { fetchWebsite } from "./utils/fetchers/website.js";

it("website", async () => {
  const website = await fetchWebsite("ospama");

  expect(website?.identification.label).toBe(
    "Gender and Politics in Early Modern European Republics (Venice, Genoa XV-XVIII centuries)",
  );
});

it("website with sidebar", async () => {
  const website = await fetchWebsite("guerrilla-television");

  expect(website?.sidebarElements.length).toBeGreaterThan(0);
});

it("website with page with css styles", async () => {
  const website = await fetchWebsite("uchicago-node");

  expect(website?.pages[0]?.properties.cssStyles.length).toBeGreaterThan(0);
});

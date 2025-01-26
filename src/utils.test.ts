import { expect, it } from "vitest";
import { fetchWebsite } from "./utils/fetchers/website.js";

const [ospama, guerrillaTelevision, uchicagoNode] = await Promise.all([
  fetchWebsite("ospama"),
  fetchWebsite("guerrilla-television"),
  fetchWebsite("uchicago-node"),
]);

it("website", async () => {
  expect(ospama?.identification.label).toBe(
    "Gender and Politics in Early Modern European Republics (Venice, Genoa XV-XVIII centuries)",
  );
});

it("website with sidebar", async () => {
  expect(guerrillaTelevision?.sidebarElements.length).toBeGreaterThan(0);
});

it("website with page with css styles", async () => {
  expect(uchicagoNode?.pages[0]?.properties.cssStyles.length).toBeGreaterThan(
    0,
  );
});

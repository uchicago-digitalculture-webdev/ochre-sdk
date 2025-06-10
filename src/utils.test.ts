import { expect, it } from "vitest";
import { fetchItem } from "./utils/fetchers/item.js";
import { fetchWebsite } from "./utils/fetchers/website.js";

const [
  // [_, ospama],
  [__, guerrillaTelevision],
  [___, uchicagoNode],
  { item: rasShamraData },
] = await Promise.all([
  // fetchWebsite("ospama"),
  fetchWebsite("guerrilla-television"),
  fetchWebsite("uchicago-node"),
  fetchItem("ff48d967-f69c-48e6-aed3-4e03e52ed51d", "set"),
]);

// it("website", async () => {
//   expect(ospama?.identification.label).toBe(
//     "Gender and Politics in Early Modern European Republics (Venice, Genoa XV-XVIII centuries)",
//   );
// });

it("website with sidebar", async () => {
  expect(guerrillaTelevision?.sidebar?.elements.length).toBeGreaterThan(0);
});

it("website with page with css styles", async () => {
  expect(uchicagoNode?.pages[0]?.properties.cssStyles.length).toBeGreaterThan(
    0,
  );
});

it("rash shamra tablet inventory set", async () => {
  expect(rasShamraData.items.length).toBeGreaterThan(0);
});

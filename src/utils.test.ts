import { expect, it } from "vitest";
import { fetchSet } from "./utils/fetchers/set.js";
import { fetchWebsite } from "./utils/fetchers/website.js";
import { getPropertyByLabel } from "./utils/getters.js";

const [
  ospama,
  guerrillaTelevision,
  uchicagoNode,
  rasShamraData,
  idalionTerracotas,
] = await Promise.all([
  fetchWebsite("ospama"),
  fetchWebsite("guerrilla-television"),
  fetchWebsite("uchicago-node"),
  fetchSet("ff48d967-f69c-48e6-aed3-4e03e52ed51d"),
  fetchSet("0f351a13-9809-4e1a-a3eb-56722d5cf3e0"),
]);

it("website", async () => {
  expect(ospama?.identification.label).toBe(
    "Gender and Politics in Early Modern European Republics (Venice, Genoa XV-XVIII centuries)",
  );
});

it("website with sidebar", async () => {
  expect(guerrillaTelevision?.sidebar?.elements.length).toBeGreaterThan(0);
});

it("website with page with css styles", async () => {
  expect(uchicagoNode?.pages[0]?.properties.cssStyles.length).toBeGreaterThan(
    0,
  );
});

it("rash shamra tablet inventory set", async () => {
  expect(rasShamraData?.set.items.spatialUnits.length).toBeGreaterThan(0);
});

it("idalion terracotas set", async () => {
  const firstItem = idalionTerracotas?.set.items.spatialUnits[0];
  if (!firstItem) {
    throw new Error("No first item found");
  }

  const propertyToCheck = getPropertyByLabel(
    firstItem.properties,
    "Terminus post quem",
  );
  if (!propertyToCheck) {
    throw new Error("Property not found");
  }

  expect(propertyToCheck.values[0]!.content).toBe("");
  expect(propertyToCheck.values[0]!.booleanValue).toBe(false);
});

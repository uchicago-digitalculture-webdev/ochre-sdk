import { expect, it } from "vitest";
import { fetchTreeItems } from "#/fetchers/tree/items.js";

const CINEMETRICS_FILMS_TREE_UUID = "5f69ef7c-9006-4e7a-bf56-0f266346f9fb";
const CINEMETRICS_ARTICLES_TREE_UUID = "a2dcbd31-f5fc-44be-92fd-a0296a13016c";

it("should paginate a large Tree", async () => {
  const { totalCount, items, error } = await fetchTreeItems(
    {
      treeScopeUuids: [CINEMETRICS_FILMS_TREE_UUID],
      sort: { target: "title", direction: "asc" },
      page: 1,
      pageSize: 25,
    },
    ["concept"],
    { languages: ["eng"] },
  );

  expect(error).toBeNull();
  expect(totalCount).toBeGreaterThan(20_000);
  expect(items).toHaveLength(25);
});

it("should return the last page of a large Tree", async () => {
  const pageSize = 25;
  const first = await fetchTreeItems(
    {
      treeScopeUuids: [CINEMETRICS_FILMS_TREE_UUID],
      sort: { target: "title", direction: "asc" },
      page: 1,
      pageSize,
    },
    ["concept"],
    { languages: ["eng"] },
  );

  expect(first.totalCount).not.toBeNull();

  const lastPage = Math.ceil(first.totalCount! / pageSize);
  const { items, error } = await fetchTreeItems(
    {
      treeScopeUuids: [CINEMETRICS_FILMS_TREE_UUID],
      sort: { target: "title", direction: "asc" },
      page: lastPage,
      pageSize,
    },
    ["concept"],
    { languages: ["eng"] },
  );

  expect(error).toBeNull();
  expect(items?.length).toBeGreaterThan(0);
});

it("should filter Tree items by a query", async () => {
  const { totalCount, items, error } = await fetchTreeItems(
    {
      treeScopeUuids: [CINEMETRICS_FILMS_TREE_UUID],
      queries: {
        target: "title",
        value: "space odyssey",
        matchMode: "includes",
        isCaseSensitive: false,
        language: "eng",
      },
      page: 1,
      pageSize: 25,
    },
    ["concept"],
    { languages: ["eng"] },
  );

  expect(error).toBeNull();
  expect(totalCount).toBeGreaterThan(0);
  expect(totalCount).toBeLessThan(100);

  const matchedItems = items ?? [];
  for (const item of matchedItems) {
    expect(item.identification.label.getText("eng").toLowerCase()).toContain(
      "odyssey",
    );
  }
});

it("should flatten the items a Tree nests under headings", async () => {
  const { totalCount, items, error } = await fetchTreeItems(
    {
      treeScopeUuids: [CINEMETRICS_ARTICLES_TREE_UUID],
      sort: { target: "title", direction: "asc" },
      page: 1,
      pageSize: 100,
    },
    ["resource"],
    { languages: ["eng"] },
  );

  expect(error).toBeNull();
  expect(totalCount).toBeGreaterThan(10);
  expect(items?.length).toBe(totalCount);

  const flattenedItems = items ?? [];
  for (const item of flattenedItems) {
    expect(item.category).toBe("resource");
  }
});

it("should return nothing for a Tree UUID that is not published", async () => {
  const { totalCount, items, error } = await fetchTreeItems({
    treeScopeUuids: ["00000000-0000-0000-0000-000000000000"],
    page: 1,
  });

  expect(error).toBeNull();
  expect(totalCount).toBe(0);
  expect(items).toHaveLength(0);
});

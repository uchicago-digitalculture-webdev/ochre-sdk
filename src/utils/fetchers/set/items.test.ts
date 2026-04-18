import { expect, it } from "vitest";
import { fetchSetItems } from "./items.js";

const UCHICAGO_NODE_SET_SCOPE_UUIDS = [
  "10268bd8-5e97-4f8c-b3f7-89d85d93a776",
  "6b81459f-978c-4958-affa-3f0e895bf86e",
  "a6af0d98-5e68-4565-953d-2633a6ce145c",
  "e59a10d4-c873-4aad-8a2f-f4e62240c5a3",
  "c103ea19-5617-480e-bdfa-8ae8e1d1f83f",
  "606c62dd-80ad-41db-ae1d-7a8b2ff7ef27",
] as const;

function buildInputValueQueries(value: string) {
  return {
    or: [
      {
        target: "title" as const,
        value,
        matchMode: "includes" as const,
        isCaseSensitive: false,
        language: "eng",
      },
      {
        target: "description" as const,
        value,
        matchMode: "includes" as const,
        isCaseSensitive: false,
        language: "eng",
      },
      {
        target: "bibliography" as const,
        value,
        matchMode: "includes" as const,
        isCaseSensitive: false,
        language: "eng",
      },
      {
        target: "periods" as const,
        value,
        matchMode: "includes" as const,
        isCaseSensitive: false,
        language: "eng",
      },
      {
        target: "property" as const,
        dataType: "all" as const,
        value,
        matchMode: "includes" as const,
        isCaseSensitive: false,
        language: "eng",
      },
    ],
  };
}

it("should fetch uchicago-node Set items for query: 'maps of Pilsen'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: buildInputValueQueries("maps of Pilsen"),
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(2);
});

it("should fetch uchicago-node Set items for query: 'west garfield'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: {
      and: [
        buildInputValueQueries("west garfield"),
        {
          target: "property",
          propertyVariable: "cf4b9fdc-6cef-4cc6-b6b6-7182aca93fb8",
          dataType: "date",
          from: "1886-01-01T00:00:00Z",
          to: "1896-12-31T23:59:59Z",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "9f4ba746-585e-45b0-a654-43d52c9d840b",
          dataType: "IDREF",
          value: "ede04283-36d5-471b-a8ca-3f5836fd992d",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "4c9fc941-5c23-4c22-84a8-628177d772bc",
          dataType: "IDREF",
          value: "0092cc2f-934d-4ae6-a69f-dd53ac41e6ff",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
      ],
    },
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(3);
});

it("should fetch uchicago-node Set items for query: 'ca. 1870'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: buildInputValueQueries("ca. 1870"),
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(177);
});

it("should fetch uchicago-node Set items for query: 'cat'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: buildInputValueQueries("cat"),
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(1);
});

it("should fetch sosc-core-at-smart Set items for bibliographies query: 'Aristotle, The Politics'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: ["16f5a39a-47b9-492d-9f9c-b7e4ec4156b6"],
    queries: {
      target: "bibliography",
      value: "Aristotle, The Politics",
      matchMode: "exact",
      isCaseSensitive: true,
      language: "eng",
    },
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(8);
});

it("should fetch more uchicago-node Set items for wildcard query: 'cat*'", async () => {
  const { totalCount: catCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: buildInputValueQueries("cat"),
    page: 1,
    pageSize: 48,
  });
  const { totalCount: wildcardCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: buildInputValueQueries("cat*"),
    page: 1,
    pageSize: 48,
  });

  expect(catCount).toBe(1);
  expect(wildcardCount).toBe(28);
  expect(wildcardCount).toBeGreaterThan(catCount!);
});

it("should fetch uchicago-node Set items for stemmed query: 'train'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: buildInputValueQueries("train"),
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(8);
});

import { expect, it } from "vitest";
import { fetchSetItems } from "./items.js";

it("should fetch uchicago-node Set items for query: 'ca. 1870'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [
      "10268bd8-5e97-4f8c-b3f7-89d85d93a776",
      "6b81459f-978c-4958-affa-3f0e895bf86e",
      "a6af0d98-5e68-4565-953d-2633a6ce145c",
      "e59a10d4-c873-4aad-8a2f-f4e62240c5a3",
      "c103ea19-5617-480e-bdfa-8ae8e1d1f83f",
      "606c62dd-80ad-41db-ae1d-7a8b2ff7ef27",
    ],
    queries: {
      or: [
        {
          target: "title",
          value: "ca. 1870",
          matchMode: "includes",
          isCaseSensitive: false,
          language: "eng",
        },
        {
          target: "description",
          value: "ca. 1870",
          matchMode: "includes",
          isCaseSensitive: false,
          language: "eng",
        },
        {
          target: "bibliography",
          value: "ca. 1870",
          matchMode: "includes",
          isCaseSensitive: false,
          language: "eng",
        },
        {
          target: "periods",
          value: "ca. 1870",
          matchMode: "includes",
          isCaseSensitive: false,
          language: "eng",
        },
        {
          target: "property",
          dataType: "all",
          value: "ca. 1870",
          matchMode: "includes",
          isCaseSensitive: false,
          language: "eng",
        },
      ],
    },
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(177);
});

it("should fetch uchicago-node Set items for query: 'cat'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [
      "10268bd8-5e97-4f8c-b3f7-89d85d93a776",
      "6b81459f-978c-4958-affa-3f0e895bf86e",
      "a6af0d98-5e68-4565-953d-2633a6ce145c",
      "e59a10d4-c873-4aad-8a2f-f4e62240c5a3",
      "c103ea19-5617-480e-bdfa-8ae8e1d1f83f",
      "606c62dd-80ad-41db-ae1d-7a8b2ff7ef27",
    ],
    queries: {
      or: [
        {
          target: "title",
          value: "cat",
          matchMode: "includes",
          isCaseSensitive: false,
          language: "eng",
        },
        {
          target: "description",
          value: "cat",
          matchMode: "includes",
          isCaseSensitive: false,
          language: "eng",
        },
        {
          target: "bibliography",
          value: "cat",
          matchMode: "includes",
          isCaseSensitive: false,
          language: "eng",
        },
        {
          target: "periods",
          value: "cat",
          matchMode: "includes",
          isCaseSensitive: false,
          language: "eng",
        },
        {
          target: "property",
          dataType: "all",
          value: "cat",
          matchMode: "includes",
          isCaseSensitive: false,
          language: "eng",
        },
      ],
    },
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(1);
});

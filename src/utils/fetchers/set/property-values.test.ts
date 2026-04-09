import { expect, it } from "vitest";
import { fetchSetPropertyValues } from "./property-values.js";

const UCHICAGO_NODE_SET_SCOPE_UUIDS = [
  "10268bd8-5e97-4f8c-b3f7-89d85d93a776",
  "6b81459f-978c-4958-affa-3f0e895bf86e",
  "a6af0d98-5e68-4565-953d-2633a6ce145c",
  "e59a10d4-c873-4aad-8a2f-f4e62240c5a3",
  "c103ea19-5617-480e-bdfa-8ae8e1d1f83f",
  "606c62dd-80ad-41db-ae1d-7a8b2ff7ef27",
] as const;

function buildUchicagoNodePropertyValueSelectionQuery() {
  return {
    or: [
      {
        target: "property" as const,
        propertyVariable: "8383140a-e676-417f-b5d8-863d9df6d905",
        dataType: "string" as const,
        matchMode: "exact" as const,
        isCaseSensitive: true,
        language: "eng",
      },
      {
        target: "property" as const,
        propertyVariable: "f311cb1b-2993-4584-bb0e-9a35888f29b9",
        dataType: "string" as const,
        matchMode: "exact" as const,
        isCaseSensitive: true,
        language: "eng",
      },
      {
        target: "property" as const,
        propertyVariable: "03b520c1-248f-41e1-b05f-5aa0488e5bbe",
        dataType: "IDREF" as const,
        matchMode: "exact" as const,
        isCaseSensitive: true,
        language: "eng",
      },
      {
        target: "property" as const,
        propertyVariable: "30054cb2-909a-4f34-8db9-8fe7369d691d",
        dataType: "IDREF" as const,
        matchMode: "exact" as const,
        isCaseSensitive: true,
        language: "eng",
      },
      {
        target: "property" as const,
        propertyVariable: "48a43a29-b240-4d0a-9ab2-fa3025ca5cf7",
        dataType: "IDREF" as const,
        matchMode: "exact" as const,
        isCaseSensitive: true,
        language: "eng",
      },
      {
        target: "property" as const,
        propertyVariable: "4c9fc941-5c23-4c22-84a8-628177d772bc",
        dataType: "IDREF" as const,
        matchMode: "exact" as const,
        isCaseSensitive: true,
        language: "eng",
      },
      {
        target: "property" as const,
        propertyVariable: "9f4ba746-585e-45b0-a654-43d52c9d840b",
        dataType: "IDREF" as const,
        matchMode: "exact" as const,
        isCaseSensitive: true,
        language: "eng",
      },
      {
        target: "property" as const,
        propertyVariable: "cf4b9fdc-6cef-4cc6-b6b6-7182aca93fb8",
        dataType: "date" as const,
        from: "0000",
        to: "9999-12-31",
        matchMode: "exact" as const,
        isCaseSensitive: true,
        language: "eng",
      },
    ],
  };
}

function buildUchicagoNodeItemSearchQuery(value: string) {
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
        target: "notes" as const,
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

it("should fetch idalion Set 'Object register' property values", async () => {
  const { propertyValues } = await fetchSetPropertyValues({
    setScopeUuids: ["23d13357-408b-4980-8962-8c8e876a2188"],
    queries: {
      or: [
        {
          target: "property",
          propertyVariable: "0346b4de-0b0e-7679-2200-2485ce9fef90",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "06e9db63-4863-6be7-5efd-9fc7083e94c1",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "0c1b3a91-29b5-735b-8d95-66bf967a83fd",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "0d6fb192-e961-486d-9536-019c87a24395",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "108422f2-ffc8-4ed4-9863-815ef0cee189",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "1d3a3b97-0a4a-24d3-d79e-5069ee97420a",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "296f03df-6452-e1ea-f24e-b21ac25c0f93",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "45ac5c15-be69-8e93-6d12-c1c6c8a591d4",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "55103161-6a8e-03d6-761f-77fa41da213b",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "78ae3f43-08a9-d4fe-7ac9-69408088d61e",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "7ed72a30-14a2-df6f-a2c9-76295cdb4bdb",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "99749c7f-be6c-840f-8295-0b239007b73d",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "9c824444-6ca4-4ee4-baa6-7824f8ab05f2",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "9ef98572-7a17-fe11-3c90-fe4f0a66fa78",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "a06fce65-9ced-7386-2b3e-138aa72a1219",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "bcb1c228-6063-eee7-fdc2-005057496f23",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "cc87e19a-87d9-16b4-83cd-b1d19ce0ab7c",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "f72f1b40-2602-57fe-9b34-351d7d4df00e",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "f8840172-4bc2-f7b4-874c-cf1cb1be02bc",
          dataType: "string",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "8af2dee5-7a0c-49ca-88f9-a19f404f70a9",
          dataType: "IDREF",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "a308b798-771c-4f1e-82b1-fb33244deeed",
          dataType: "IDREF",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "a4ffdbf8-8a45-42ea-b5b5-60db5c7a62d6",
          dataType: "IDREF",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "d58ed982-5601-46c0-a246-e1f20d9a75e3",
          dataType: "IDREF",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "fa700b6d-cb9f-4528-acc5-ecd8e0fe343c",
          dataType: "IDREF",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "fa84cb91-9814-4f49-98d6-746b28c8198c",
          dataType: "IDREF",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "17cce39e-c5d7-3d55-63cf-4bff72180b0f",
          dataType: "date",
          from: "0000",
          to: "9999-12-31",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
      ],
    },
    attributes: { bibliographies: true, periods: true },
    isLimitedToLeafPropertyValues: false,
  });

  expect(propertyValues).not.toBeNull();
  expect(propertyValues?.length).toBeGreaterThan(0);
});

it("should fetch uchicago-node Set property values for wildcard query: 'cat*'", async () => {
  const { propertyValues } = await fetchSetPropertyValues({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: {
      and: [
        buildUchicagoNodePropertyValueSelectionQuery(),
        buildUchicagoNodeItemSearchQuery("cat*"),
      ],
    },
    isLimitedToLeafPropertyValues: false,
  });

  expect(propertyValues).not.toBeNull();
  expect(propertyValues?.length).toBeGreaterThan(0);
});

it("should fetch uchicago-node Set 'Search' property values", async () => {
  const { propertyValues } = await fetchSetPropertyValues({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: {
      and: [
        buildUchicagoNodePropertyValueSelectionQuery(),
        buildUchicagoNodeItemSearchQuery("ca. 1870"),
      ],
    },
    isLimitedToLeafPropertyValues: false,
  });

  expect(propertyValues).not.toBeNull();
  expect(propertyValues?.length).toBeGreaterThan(0);
});

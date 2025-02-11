import type { OchreTree } from "./types/internal.raw.js";
import { expect, it } from "vitest";
import { fetchSet } from "./utils/fetchers/set.js";
import { fetchWebsite } from "./utils/fetchers/website.js";
import { parseProperties } from "./utils/parse.js";

const [ospama, guerrillaTelevision, uchicagoNode, rasShamraData] =
  await Promise.all([
    fetchWebsite("ospama"),
    fetchWebsite("guerrilla-television"),
    fetchWebsite("uchicago-node"),
    fetchSet("ff48d967-f69c-48e6-aed3-4e03e52ed51d"),
  ]);

const mockWebsiteProperties: OchreTree["properties"] = {
  property: {
    property: [
      {
        label: {
          uuid: "150101dd-b169-4def-a427-c2f653862d03",
          content: "webUI",
        },
        value: {
          category: "value",
          type: "string",
          uuid: "ce1cf896-9551-41db-b026-1d5d0e12712f",
          content: "plum",
        },
      },
      {
        label: {
          uuid: "bf11a733-a217-462b-9f77-f8fdff802709",
          content: "status",
        },
        value: {
          category: "value",
          type: "string",
          uuid: "7510711a-e080-4f0b-90ee-f6374316e544",
          content: "development",
        },
      },
      {
        label: {
          uuid: "bca2f4be-8bc7-4e90-b893-c9578ae154ae",
          content: "navbar-visible",
        },
        value: { type: "boolean", content: true },
      },
      {
        label: {
          uuid: "e9afb9b5-6079-4687-bd1d-670a2efec72e",
          content: "footer-visible",
        },
        value: { type: "boolean", content: true },
      },
      {
        label: {
          uuid: "8ace6c00-27be-43da-ab2e-52c4b35b4ef5",
          content: "sidebar-visible",
        },
        value: { type: "boolean", content: true },
      },
      {
        label: {
          uuid: "8ad21709-133a-4188-98e2-526da13bfdbf",
          content: "search-collection",
        },
        value: {
          publicationDateTime: "2024-12-10T14:57:26",
          category: "table",
          type: "IDREF",
          uuid: "10268bd8-5e97-4f8c-b3f7-89d85d93a776",
          content: "GTV Films",
        },
      },
    ],
    label: {
      uuid: "f1c131b6-1498-48a4-95bf-a9edae9fd518",
      content: "presentation",
    },
    value: {
      category: "value",
      type: "string",
      uuid: "0e500a69-13c3-44e8-82ac-806fbdeaddfd",
      content: "website",
    },
  },
};

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

it("rash shamra tablet inventory set", async () => {
  expect(rasShamraData?.set.items.spatialUnits.length).toBeGreaterThan(0);
});

it("website properties", async () => {
  expect(
    parseProperties(
      Array.isArray(mockWebsiteProperties.property) ?
        mockWebsiteProperties.property
      : [mockWebsiteProperties.property],
    ),
  ).toEqual([
    {
      label: "presentation",
      values: [
        {
          content: "website",
          type: "string",
          category: null,
          uuid: "0e500a69-13c3-44e8-82ac-806fbdeaddfd",
          publicationDateTime: null,
        },
      ],
      comment: null,
      properties: [
        {
          label: "webUI",
          values: [
            {
              content: "plum",
              type: "string",
              category: null,
              uuid: "ce1cf896-9551-41db-b026-1d5d0e12712f",
              publicationDateTime: null,
            },
          ],
          comment: null,
          properties: [],
        },
        {
          label: "status",
          values: [
            {
              content: "development",
              type: "string",
              category: null,
              uuid: "7510711a-e080-4f0b-90ee-f6374316e544",
              publicationDateTime: null,
            },
          ],
          comment: null,
          properties: [],
        },
        {
          label: "navbar-visible",
          values: [
            {
              content: "Yes",
              type: "boolean",
              category: null,
              uuid: null,
              publicationDateTime: null,
            },
          ],
          comment: null,
          properties: [],
        },
        {
          label: "footer-visible",
          values: [
            {
              content: "Yes",
              type: "boolean",
              category: null,
              uuid: null,
              publicationDateTime: null,
            },
          ],
          comment: null,
          properties: [],
        },
        {
          label: "sidebar-visible",
          values: [
            {
              content: "Yes",
              type: "boolean",
              category: null,
              uuid: null,
              publicationDateTime: null,
            },
          ],
          comment: null,
          properties: [],
        },
        {
          label: "search-collection",
          values: [
            {
              content: "GTV Films",
              type: "IDREF",
              category: "table",
              uuid: "10268bd8-5e97-4f8c-b3f7-89d85d93a776",
              publicationDateTime: new Date("2024-12-10T11:57:26.000Z"),
            },
          ],
          comment: null,
          properties: [],
        },
      ],
    },
  ]);
});

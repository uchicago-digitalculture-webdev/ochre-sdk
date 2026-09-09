import type * as v from "valibot";
import type { FetchFunction } from "#/parsers/helpers.js";
import { decodeOchreResponse } from "#/fetchers/request.js";

/**
 * Build parsed OCHRE data for a test, the way a fetcher would
 *
 * A fixture written as an object is two steps removed from what a parser
 * receives: nothing checks it against the schema, so it can take a shape OCHRE
 * could not send, and it carries none of the source-offset metadata
 * `fast-xml-parser` attaches, so anything reading source order silently falls
 * back to declaration order. Writing the fixture as XML and decoding it the
 * way the fetchers do closes both gaps.
 * @param xml - The XML body, as OCHRE would return it
 * @param schema - The schema for the endpoint being imitated
 * @returns The validated data
 * @throws When the fixture does not satisfy the schema
 * @internal
 */
export function ochreFixture<TOutput>(
  xml: string,
  schema: v.GenericSchema<unknown, TOutput>,
): TOutput {
  return decodeOchreResponse({ xml, schema, label: "OCHRE fixture" });
}

/**
 * A fetch that answers every request with the same XML
 * @param xml - The XML body to return
 * @returns A fetch function and the requests it received
 * @internal
 */
export function ochreFixtureFetch(xml: string): {
  fetch: FetchFunction;
  requests: Array<{ url: string; body: string }>;
} {
  const requests: Array<{ url: string; body: string }> = [];

  return {
    requests,
    fetch: async (input, init) => {
      requests.push({ url: input.toString(), body: String(init?.body ?? "") });

      return new Response(xml);
    },
  };
}

import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import type { FetchFunction } from "#/parsers/helpers.js";
import { OCHRE_ENDPOINT, XML_PARSER_OPTIONS } from "#/constants.js";
import { createSchemaValidationError } from "#/errors.js";
import { restoreXMLMetadata } from "#/xml/metadata.js";

const OCHRE_XQUERY_ENDPOINT = `${OCHRE_ENDPOINT}?xquery&xsl=none&lang="*"`;

const xmlParser = new XMLParser(XML_PARSER_OPTIONS);

export type OchreRequestOptions = {
  fetch?: FetchFunction;
  signal?: AbortSignal;
  timeoutMilliseconds?: number;
};

function resolveSignal(
  options: OchreRequestOptions | undefined,
): AbortSignal | undefined {
  const { signal, timeoutMilliseconds } = options ?? {};

  if (timeoutMilliseconds == null) {
    return signal;
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMilliseconds);

  return signal == null
    ? timeoutSignal
    : AbortSignal.any([signal, timeoutSignal]);
}

/**
 * Turn an OCHRE XML response into validated data
 *
 * The XML parser, the schema check and the metadata graft are one step: the
 * graft has to follow validation because `v.safeParse` drops the
 * non-enumerable source offsets `fast-xml-parser` records, and skipping it
 * leaves a value that is the right shape but has lost its source order. Kept
 * separate from the request so a caller holding an XML string, such as a test,
 * gets exactly what the network path produces.
 * @param parameters - The decode parameters
 * @param parameters.xml - The raw XML response body
 * @param parameters.schema - The schema the response must satisfy
 * @param parameters.label - What is being decoded, used in failure messages
 * @param parameters.checkRawData - Guard run against the parsed XML before validation
 * @returns The validated response, with XML source metadata restored
 * @throws When the query failed on the server, the guard rejects, or validation fails
 * @internal
 */
export function decodeOchreResponse<TOutput>(parameters: {
  xml: string;
  schema: v.GenericSchema<unknown, TOutput>;
  label: string;
  checkRawData?: (data: unknown) => void;
}): TOutput {
  const { xml, schema, label, checkRawData } = parameters;

  if (xml.trim() === "<result><ochre/></result>") {
    throw new Error(
      `Failed to fetch ${label}: the OCHRE API could not run the query`,
    );
  }

  const data = xmlParser.parse(xml) as unknown;

  checkRawData?.(data);

  const { success, issues, output } = v.safeParse(schema, data);
  if (!success) {
    throw createSchemaValidationError(`Failed to parse ${label}`, issues);
  }
  restoreXMLMetadata(output, data);

  return output;
}

/**
 * Post an XQuery to the OCHRE API and validate the response
 *
 * Owns every fact about talking to OCHRE: the endpoint, the request shape and
 * the failure policy. Decoding the body is {@link decodeOchreResponse}.
 * @param parameters - The request parameters
 * @param parameters.xquery - The XQuery to post
 * @param parameters.schema - The schema the response must satisfy
 * @param parameters.label - What is being fetched, used in failure messages
 * @param parameters.options - Transport options
 * @param parameters.checkRawData - Guard run against the parsed XML before validation
 * @returns The validated response, with XML source metadata restored
 * @throws When the request fails, the guard rejects, or validation fails
 * @internal
 */
export async function requestOchre<TOutput>(parameters: {
  xquery: string;
  schema: v.GenericSchema<unknown, TOutput>;
  label: string;
  options?: OchreRequestOptions;
  checkRawData?: (data: unknown) => void;
}): Promise<TOutput> {
  const { xquery, schema, label, options, checkRawData } = parameters;

  const response = await (options?.fetch ?? fetch)(OCHRE_XQUERY_ENDPOINT, {
    method: "POST",
    body: xquery,
    headers: { "Content-Type": "application/xquery" },
    signal: resolveSignal(options),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${label}: OCHRE API responded with status ${response.status}`,
      { cause: response.statusText },
    );
  }

  return decodeOchreResponse({
    xml: await response.text(),
    schema,
    label,
    checkRawData,
  });
}

/**
 * Post a JSON payload to the OCHRE API
 * @param parameters - The request parameters
 * @param parameters.body - The JSON payload to post
 * @param parameters.label - What is being posted, used in failure messages
 * @param parameters.options - Transport options
 * @returns Whether the API accepted the payload
 * @throws When the request cannot be completed at all
 * @internal
 */
export async function isOchreJsonAccepted(parameters: {
  body: unknown;
  label: string;
  options?: OchreRequestOptions;
}): Promise<boolean> {
  const { body, label, options } = parameters;

  let response: Response;
  try {
    response = await (options?.fetch ?? fetch)(OCHRE_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      signal: resolveSignal(options),
    });
  } catch (error) {
    throw new Error(`Failed to post ${label}`, { cause: error });
  }

  if (response.status >= 500) {
    throw new Error(
      `Failed to post ${label}: OCHRE API responded with status ${response.status}`,
      { cause: response.statusText },
    );
  }

  return response.ok;
}

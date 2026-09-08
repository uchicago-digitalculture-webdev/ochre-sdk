import { XMLParser } from "fast-xml-parser";
import { isObject, readEntries, readProperty } from "#/reflection.js";

const XML_METADATA_SYMBOL = XMLParser.getMetaDataSymbol() as symbol;

/**
 * Read the source metadata `fast-xml-parser` attaches under a symbol key
 *
 * Returned as `unknown`: nothing here needs to know its shape, only whether it
 * is there, and {@link getXMLSourceIndex} narrows the one field it reads.
 * @param value - The value to read from
 * @returns The metadata, or undefined when there is none
 */
function readXMLMetadata(value: unknown): unknown {
  return readProperty(value, XML_METADATA_SYMBOL);
}

/**
 * Read the offset a node started at in the source XML
 * @param value - The parsed node
 * @returns The offset, or null when the node carries no source metadata
 * @internal
 */
export function getXMLSourceIndex(value: unknown): number | null {
  const startIndex = readProperty(readXMLMetadata(value), "startIndex");

  return typeof startIndex === "number" ? startIndex : null;
}

/**
 * Re-attach the source metadata validation dropped
 *
 * `v.safeParse` returns a fresh object graph and does not carry over the
 * non-enumerable symbol `fast-xml-parser` records offsets under, so it is
 * grafted back on by walking the validated output alongside the raw input.
 * @param output - The validated output to graft onto
 * @param input - The raw parsed input to read metadata from
 * @internal
 */
export function restoreXMLMetadata(output: unknown, input: unknown): void {
  if (!isObject(output) || !isObject(input)) {
    return;
  }

  const metadata = readXMLMetadata(input);
  if (metadata !== undefined) {
    Object.defineProperty(output, XML_METADATA_SYMBOL, {
      value: metadata,
      enumerable: false,
      configurable: true,
    });
  }

  if (Array.isArray(output) && Array.isArray(input)) {
    for (const [index, outputValue] of output.entries()) {
      restoreXMLMetadata(outputValue, input[index]);
    }
    return;
  }

  for (const [key, outputValue] of readEntries(output)) {
    restoreXMLMetadata(outputValue, readProperty(input, key));
  }
}

import type { XMLMetaData } from "fast-xml-parser";
import { XMLParser } from "fast-xml-parser";

const XML_METADATA_SYMBOL = XMLParser.getMetaDataSymbol() as symbol;

type XMLMetadataRecord = Record<symbol, XMLMetaData | undefined>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

function getXMLMetadata(value: unknown): XMLMetaData | null {
  if (!isRecord(value)) {
    return null;
  }

  return (value as XMLMetadataRecord)[XML_METADATA_SYMBOL] ?? null;
}

export function getXMLSourceIndex(value: unknown): number | null {
  const startIndex = getXMLMetadata(value)?.startIndex;
  return typeof startIndex === "number" ? startIndex : null;
}

export function restoreXMLMetadata(output: unknown, input: unknown): void {
  if (!isRecord(output) || !isRecord(input)) {
    return;
  }

  const metadata = getXMLMetadata(input);
  if (metadata != null) {
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

  for (const [key, outputValue] of Object.entries(output)) {
    restoreXMLMetadata(outputValue, input[key]);
  }
}

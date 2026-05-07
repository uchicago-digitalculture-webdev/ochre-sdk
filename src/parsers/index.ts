import { parseISO } from "date-fns";
import { deepEqual } from "fast-equals";
import type {
  BaseItem,
  Context,
  ContextItem,
  ContextNode,
  Data,
  DataCategory,
  Event,
  Identification,
  Item,
  ItemsDataCategory,
  Note,
  RecursiveDataCategory,
  Tree,
} from "#/types/index.js";
import type {
  XMLBaseItem,
  XMLContext,
  XMLContextValue,
  XMLData,
  XMLEvent,
  XMLIdentification,
  XMLNote,
  XMLString,
  XMLTree,
} from "#/types/xml/types.js";
import { DEFAULT_LANGUAGES } from "#/constants.js";
import {
  extractAliases,
  parseXMLContent,
  parseXMLString,
} from "#/parsers/string.js";
import { MultilingualString } from "#/types/multilingual.js";

/**
 * Parses the identification of an item or project
 * @param rawIdentification - The raw identification from the XML data
 * @param options - The options for the identification
 * @param options.languages - The languages to use
 * @param options.isRichText - Whether to parse the text as rich text
 * @returns The parsed identification
 *
 * @internal
 */
function parseIdentification<T extends ReadonlyArray<string>>(
  rawIdentification: XMLIdentification,
  options: { languages: T; isRichText: boolean },
): Identification<T> {
  const label =
    "content" in rawIdentification.label ?
      parseXMLContent<T>(rawIdentification.label, {
        languages: options.languages,
        isRichText: options.isRichText,
      })
    : MultilingualString.fromObject(
        Object.fromEntries(
          options.languages.map((language) => [
            language,
            parseXMLString(rawIdentification.label as XMLString, {
              isRichText: options.isRichText,
              parseEmail: false,
            }),
          ]),
        ) as Partial<Record<T[number], string>>,
        options.languages,
        { isRichText: options.isRichText },
      );

  const abbreviation =
    rawIdentification.abbreviation == null ? null
    : "content" in rawIdentification.abbreviation! ?
      parseXMLContent<T>(rawIdentification.abbreviation, {
        languages: options.languages,
        isRichText: options.isRichText,
      })
    : MultilingualString.fromObject(
        Object.fromEntries(
          options.languages.map((language) => [
            language,
            parseXMLString(rawIdentification.abbreviation as XMLString, {
              isRichText: options.isRichText,
              parseEmail: false,
            }),
          ]),
        ) as Partial<Record<T[number], string>>,
        options.languages,
        { isRichText: options.isRichText },
      );

  const labelAliases = extractAliases(rawIdentification.label, {
    isRichText: options.isRichText,
  });
  const abbreviationAliases = extractAliases(rawIdentification.abbreviation, {
    isRichText: options.isRichText,
  });
  const code = rawIdentification.code?.payload ?? null;
  const email = rawIdentification.email?.payload ?? null;
  const website =
    rawIdentification.website?.payload == null ?
      null
    : parseXMLString(rawIdentification.website, {
        isRichText: options.isRichText,
        parseEmail: false,
      });

  const alias = {
    label: labelAliases?.[0] ?? null,
    abbreviation: abbreviationAliases?.[0] ?? null,
  };

  return { label, abbreviation, alias, code, email, website };
}

/**
 * Parses the context item from the XML data
 * @param contextItem - The raw XML data
 * @returns The parsed context item
 *
 * @internal
 */
function parseContextItem(contextItem: XMLContextValue): ContextItem {
  return {
    uuid: contextItem.uuid,
    publicationDateTime:
      contextItem.publicationDateTime == null ?
        null
      : parseISO(contextItem.publicationDateTime),
    index: Number(contextItem.n),
    content: contextItem.payload,
  };
}

/**
 * Parses the context from the XML data
 * @param rawContext - The raw XML data
 * @param dataCategory - The category of the data to parse
 * @returns The parsed context
 *
 * @internal
 */
function parseContext<U extends RecursiveDataCategory>(
  rawContext: XMLContext,
  dataCategory: U,
): Context<U> {
  return {
    nodes:
      rawContext[0]?.context.map(
        (context) =>
          ({
            tree: parseContextItem(context.tree[0]!),
            project: parseContextItem(context.project),
            [dataCategory]:
              context[dataCategory]?.map((item) => parseContextItem(item)) ??
              [],
          }) as ContextNode<U>,
      ) ?? [],
    displayPath: rawContext[0]?.displayPath ?? "",
  };
}

/**
 * Parses the event from the XML data
 * @param rawEvent - The raw XML data
 * @param options - The options for the parser
 * @param options.languages - The languages to use
 * @param options.isRichText - Whether to parse the text as rich text
 * @returns The parsed event
 *
 * @internal
 */
function parseEvent<T extends ReadonlyArray<string>>(
  rawEvent: XMLEvent,
  options: { languages: T; isRichText: boolean },
): Event<T> {
  return {
    date: rawEvent.dateTime == null ? null : parseISO(rawEvent.dateTime),
    label: parseXMLContent<T>(rawEvent.label, {
      languages: options.languages,
      isRichText: options.isRichText,
    }),
    comment:
      rawEvent.comment == null ?
        null
      : parseXMLContent<T>(rawEvent.comment, {
          languages: options.languages,
          isRichText: options.isRichText,
        }).getText(),
    agent: null, // TODO: parse agent
  };
}

/**
 * Parses the data from the XML data
 * @param rawData - The raw XML data
 * @param options - The options for the parser
 * @param options.category - The category of the OCHRE item to fetch
 * @param options.itemCategory - The category of items contained in the OCHRE item to fetch (only used for tree and set)
 * @param options.languages - The languages to use
 * @param options.isRichText - Whether to parse the text as rich text
 * @returns The parsed data
 *
 * @internal
 */
export function parseData<
  U extends DataCategory,
  V extends U extends "tree" | "set" ? ItemsDataCategory : never = never,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawData: XMLData,
  options: {
    category?: U;
    itemCategory?: V;
    languages: T;
    isRichText?: boolean;
  },
): Data<U, V, T> {
  const rawOchre = rawData.result.ochre;
  const metadataLanguages =
    rawOchre.metadata.language?.map((language) =>
      parseXMLString(language, {
        isRichText: options.isRichText ?? false,
        parseEmail: false,
      }),
    ) ?? DEFAULT_LANGUAGES;

  const languagesToUse =
    options.languages.length > 0 ?
      metadataLanguages.filter((language) =>
        options.languages!.includes(language),
      )
    : metadataLanguages;

  if (
    languagesToUse.length === 0 ||
    options.languages.length !== languagesToUse.length ||
    !deepEqual(
      languagesToUse
        .toSorted((a, b) => a.localeCompare(b, "en-US"))
        .map((language) => language.toLocaleLowerCase("en-US")),
      options.languages
        .toSorted((a, b) => a.localeCompare(b, "en-US"))
        .map((language) => language.toLocaleLowerCase("en-US")),
    )
  ) {
    const unsupportedLanguages = options.languages.filter(
      (language) =>
        !metadataLanguages
          .map((lang) => lang.toLocaleLowerCase("en-US"))
          .includes(language.toLocaleLowerCase("en-US")),
    );

    throw new Error(
      `The following language(s) are not supported by the dataset: ${unsupportedLanguages
        .toSorted((a, b) => a.localeCompare(b, "en-US"))
        .join(", ")}. Available languages: ${metadataLanguages
        .toSorted((a, b) => a.localeCompare(b, "en-US"))
        .join(", ")}`,
    );
  }

  const defaultLanguage = metadataLanguages.find((language) =>
    language.includes(DEFAULT_LANGUAGES[0]!),
  );
  if (defaultLanguage == null) {
    throw new Error("Default language not found");
  }

  const items: Array<Item<U, V, T>> = [];
  const category = options.category ?? rawOchre.metadata.item?.category;
  switch (category) {
    case "tree": {
      if (!("tree" in rawOchre)) {
        throw new Error("Tree not found");
      }
      for (const tree of rawOchre.tree) {
        const parsedTree = parseTree(tree, {
          isRichText: options.isRichText ?? false,
          itemCategory: options.itemCategory!,
          languages: options.languages,
        }) as Item<"tree", V, T>;
        items.push(parsedTree as unknown as Item<U, V, T>);
      }
      break;
    }
    default: {
      throw new Error(`Unsupported category: ${category}`);
    }
  }

  const returnData: Data<U, V, T> = {
    uuid: rawOchre.uuid,
    belongsTo: {
      uuid: rawOchre.uuidBelongsTo,
      abbreviation: rawOchre.belongsTo,
    },
    publicationDateTime: parseISO(rawOchre.publicationDateTime),
    metadata: {
      dataset: parseXMLString(rawOchre.metadata.dataset, {
        isRichText: false,
        parseEmail: false,
      }),
      description: parseXMLString(rawOchre.metadata.description, {
        isRichText: false,
        parseEmail: false,
      }),
      publisher: parseXMLString(rawOchre.metadata.publisher, {
        isRichText: false,
        parseEmail: false,
      }),
      identifier: parseXMLString(rawOchre.metadata.identifier, {
        isRichText: false,
        parseEmail: false,
      }),
      project:
        rawOchre.metadata.project == null ?
          null
        : {
            identification: parseIdentification(
              rawOchre.metadata.project.identification,
              {
                languages: languagesToUse as T,
                isRichText: options.isRichText ?? false,
              },
            ),
            website:
              rawOchre.metadata.project.identification.website == null ?
                null
              : parseXMLString(
                  rawOchre.metadata.project.identification.website,
                  { isRichText: false, parseEmail: false },
                ),
            dateFormat: rawOchre.metadata.project.dateFormat ?? null,
          },
      item:
        rawOchre.metadata.item == null ?
          null
        : {
            identification: parseIdentification(
              rawOchre.metadata.item.identification,
              {
                languages: languagesToUse as T,
                isRichText: options.isRichText ?? false,
              },
            ),
            category: rawOchre.metadata.item.category,
            type: rawOchre.metadata.item.type,
            maxLength:
              rawOchre.metadata.item.maxLength != null ?
                Number(rawOchre.metadata.item.maxLength)
              : null,
          },
      defaultLanguage,
      languages: metadataLanguages as T,
    },
    items,
  };

  return returnData;
}

/**
 * Parses the base item from the XML data
 * @param category - The category of the OCHRE item to fetch
 * @param rawItem - The raw XML data
 * @param options - The options for the parser
 * @param options.languages - The languages to use
 * @param options.isRichText - Whether to parse the text as rich text
 * @returns The parsed base item
 *
 * @internal
 */
function parseBaseItem<U extends DataCategory, T extends ReadonlyArray<string>>(
  category: U,
  rawItem: XMLBaseItem,
  options: { languages: T | undefined; isRichText: boolean },
): BaseItem<U, T> {
  const returnItem: BaseItem<U, T> = {
    uuid: rawItem.uuid,
    category,
    publicationDateTime:
      rawItem.publicationDateTime == null ?
        null
      : parseISO(rawItem.publicationDateTime),
    context:
      rawItem.context == null ?
        null
      : parseContext(rawItem.context, category as RecursiveDataCategory),
    date: rawItem.date == null ? null : parseISO(rawItem.date),
    license:
      rawItem.availability == null ?
        null
      : {
          content: parseXMLString(rawItem.availability.license, {
            isRichText: false,
            parseEmail: false,
          }),
          target: rawItem.availability.license.target ?? null,
        },
    copyright: null, // TODO: parse copyright
    watermark: null, // TODO: parse watermark
    identification: parseIdentification(rawItem.identification, {
      languages: options.languages ?? DEFAULT_LANGUAGES,
      isRichText: options.isRichText,
    }) as Identification<T>,
    creators: [], // TODO: parse creators
    description:
      rawItem.description == null ?
        null
      : parseXMLContent<T>(rawItem.description, {
          languages: options.languages ?? (DEFAULT_LANGUAGES as T),
          isRichText: options.isRichText,
        }),
    events:
      rawItem.events == null ?
        []
      : rawItem.events.event.map(
          (event) =>
            parseEvent(event, {
              languages: options.languages ?? DEFAULT_LANGUAGES,
              isRichText: options.isRichText,
            }) as Event<T>,
        ),
  };

  return returnItem;
}

/**
 * Parses the tree from the XML data
 * @param rawTree - The raw XML data
 * @param options - The options for the parser
 * @param options.itemCategory - The category of items contained in the OCHRE item to fetch (only used for tree and set)
 * @param options.languages - The languages to use
 * @param options.isRichText - Whether to parse the text as rich text
 * @returns The parsed tree
 *
 * @internal
 */
function parseTree<
  U extends ItemsDataCategory,
  T extends ReadonlyArray<string>,
>(
  rawTree: XMLTree,
  options: { itemCategory: U; languages: T; isRichText: boolean },
): Item<"tree", U, T> {
  const baseItem = parseBaseItem("tree", rawTree, options);

  const tree = {
    ...baseItem,
    type: rawTree.type ?? null,
    itemsCategory: options.itemCategory,
    links: [],
    notes:
      rawTree.notes == null ?
        []
      : rawTree.notes.note.map((note) =>
          parseNote(note, {
            languages: options.languages,
            isRichText: options.isRichText,
          }),
        ),
    properties: [],
    bibliographies: [],
    items: [], // TODO: parse items (DON'T TOUCH THIS LINE)
  } as unknown as Tree<U, T>;

  return tree;
}

/**
 * Parses the note from the XML data
 * @param rawNote - The raw XML data
 * @param options - The options for the parser
 * @param options.languages - The languages to use
 * @param options.isRichText - Whether to parse the text as rich text
 * @returns The parsed note
 *
 * @internal
 */
function parseNote<T extends ReadonlyArray<string>>(
  rawNote: XMLNote,
  options: { languages: T; isRichText: boolean },
): Note<T> {
  const note: Note<T> = {
    number: Number(rawNote.noteNo),
    title: rawNote.title ?? null,
    content: parseXMLContent<T>(rawNote, {
      languages: options.languages,
      isRichText: options.isRichText,
    }),
    authors: [], // TODO: parse authors
  };

  return note;
}

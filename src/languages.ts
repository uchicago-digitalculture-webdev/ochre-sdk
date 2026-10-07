/**
 * What an OCHRE language code tags
 *
 * - `language`: text in a natural language
 * - `transliteration`: a language written in another script (`ota-xlt`)
 * - `vocabulary`: codes or notation that are not a language (`rel`)
 * - `non-linguistic`: `zxx`, which OCHRE publishes for aliases and for
 *   labels that are not in any language
 */
export type OchreLanguageKind =
  | "language"
  | "transliteration"
  | "vocabulary"
  | "non-linguistic";

/**
 * The standard an OCHRE language code is taken from
 *
 * - `iso639-2b`: the bibliographic ISO 639-2 code, which is OCHRE's rule
 * - `iso639-2t`: the terminology ISO 639-2 code, which OCHRE uses for Dutch
 * - `iso639-3`: the ISO 639-3 identifier, for languages ISO 639-2 has no
 *   code for
 * - `ochre`: a code of OCHRE's own, which may collide with an unrelated
 *   ISO 639-3 language (`lmc` is OCHRE's Late Middle Chinese, ISO's Limilngan)
 */
export type OchreLanguageStandard =
  | "iso639-2b"
  | "iso639-2t"
  | "iso639-3"
  | "ochre";

/**
 * A language code OCHRE publishes, with the standard codes it stands for
 */
export type OchreLanguage = {
  /**
   * The English name of the language
   */
  name: string;
  /**
   * What the code tags
   */
  kind: OchreLanguageKind;
  /**
   * The standard the OCHRE code itself is taken from
   */
  standard: OchreLanguageStandard;
  /**
   * The ISO 639-3 identifier of the language, or null when the code tags
   * no language, or a language ISO 639-3 does not code
   */
  iso639_3: string | null;
  /**
   * The BCP 47 tag to hand to `Intl` and HTML `lang` attributes, or null
   * when no standard tag fits
   */
  bcp47: string | null;
};

/**
 * Every language code OCHRE publishes, mapped to the ISO 639-3 and BCP 47
 * codes it stands for
 *
 * OCHRE publishes ISO 639-2 codes in their bibliographic (B) form, the
 * Library of Congress MARC convention (`per`, not ISO 639-3 `fas`), with
 * three exceptions: the ISO 639-3 identifier where ISO 639-2 has no code
 * (`yua`), the terminology (T) form for Dutch (`nld`, not `dut`), and codes
 * of its own for transliterations and vocabularies (`ota-xlt`, `rel`), some
 * of which collide with unrelated ISO 639-3 languages. Key everything by
 * these codes, because they are what OCHRE serves, and convert through this
 * table when a standard code is needed.
 */
export const OCHRE_LANGUAGES = {
  akk: {
    name: "Akkadian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "akk",
    bcp47: "akk",
  },
  xno: {
    name: "Anglo-Norman",
    kind: "language",
    standard: "iso639-3",
    iso639_3: "xno",
    bcp47: "xno",
  },
  ara: {
    name: "Arabic",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "ara",
    bcp47: "ar",
  },
  arc: {
    name: "Aramaic",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "arc",
    bcp47: "arc",
  },
  arm: {
    name: "Armenian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "hye",
    bcp47: "hy",
  },
  bel: {
    name: "Belarusian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "bel",
    bcp47: "be",
  },
  ben: {
    name: "Bengali",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "ben",
    bcp47: "bn",
  },
  btc: {
    name: "Betacode",
    kind: "vocabulary",
    standard: "ochre",
    iso639_3: null,
    bcp47: "grc-Latn-x-betacode",
  },
  bos: {
    name: "Bosnian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "bos",
    bcp47: "bs",
  },
  bul: {
    name: "Bulgarian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "bul",
    bcp47: "bg",
  },
  cnn: {
    name: "Canaanite",
    kind: "language",
    standard: "ochre",
    iso639_3: null,
    bcp47: null,
  },
  yue: {
    name: "Cantonese",
    kind: "language",
    standard: "iso639-3",
    iso639_3: "yue",
    bcp47: "yue",
  },
  cat: {
    name: "Catalan",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "cat",
    bcp47: "ca",
  },
  chi: {
    name: "Chinese",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "zho",
    bcp47: "zh",
  },
  chu: {
    name: "Church Slavonic",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "chu",
    bcp47: "cu",
  },
  lzh: {
    name: "Classical Chinese",
    kind: "language",
    standard: "iso639-3",
    iso639_3: "lzh",
    bcp47: "lzh",
  },
  cop: {
    name: "Coptic",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "cop",
    bcp47: "cop",
  },
  hrv: {
    name: "Croatian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "hrv",
    bcp47: "hr",
  },
  cze: {
    name: "Czech",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "ces",
    bcp47: "cs",
  },
  egyd: {
    name: "Demotic",
    kind: "language",
    standard: "ochre",
    iso639_3: "egy",
    bcp47: "egy-Egyd",
  },
  nld: {
    name: "Dutch",
    kind: "language",
    standard: "iso639-2t",
    iso639_3: "nld",
    bcp47: "nl",
  },
  dum: {
    name: "Dutch (Middle)",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "dum",
    bcp47: "dum",
  },
  egy: {
    name: "Egyptian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "egy",
    bcp47: "egy",
  },
  elx: {
    name: "Elamite",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "elx",
    bcp47: "elx",
  },
  eng: {
    name: "English",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "eng",
    bcp47: "en",
  },
  enm: {
    name: "English (Middle)",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "enm",
    bcp47: "enm",
  },
  ecy: {
    name: "Eteocypriot",
    kind: "language",
    standard: "iso639-3",
    iso639_3: "ecy",
    bcp47: "ecy",
  },
  fre: {
    name: "French",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "fra",
    bcp47: "fr",
  },
  frm: {
    name: "French (Middle)",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "frm",
    bcp47: "frm",
  },
  fro: {
    name: "French (Old)",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "fro",
    bcp47: "fro",
  },
  geo: {
    name: "Georgian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "kat",
    bcp47: "ka",
  },
  ger: {
    name: "German",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "deu",
    bcp47: "de",
  },
  nds: {
    name: "German (Low)",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "nds",
    bcp47: "nds",
  },
  gmh: {
    name: "German (Middle High)",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "gmh",
    bcp47: "gmh",
  },
  goh: {
    name: "German (Old High)",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "goh",
    bcp47: "goh",
  },
  grc: {
    name: "Greek",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "grc",
    bcp47: "grc",
  },
  guj: {
    name: "Gujarati",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "guj",
    bcp47: "gu",
  },
  pinyin: {
    name: "Hanyu Pinyin",
    kind: "transliteration",
    standard: "ochre",
    iso639_3: "cmn",
    bcp47: "zh-Latn-pinyin",
  },
  htt: {
    name: "Hattian",
    kind: "language",
    standard: "ochre",
    iso639_3: "xht",
    bcp47: "xht",
  },
  heb: {
    name: "Hebrew",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "heb",
    bcp47: "he",
  },
  hin: {
    name: "Hindi",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "hin",
    bcp47: "hi",
  },
  hit: {
    name: "Hittite",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "hit",
    bcp47: "hit",
  },
  xhu: {
    name: "Hurrian",
    kind: "language",
    standard: "iso639-3",
    iso639_3: "xhu",
    bcp47: "xhu",
  },
  ita: {
    name: "Italian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "ita",
    bcp47: "it",
  },
  jpn: {
    name: "Japanese",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "jpn",
    bcp47: "ja",
  },
  "jpn-xlt": {
    name: "Japanese XLit",
    kind: "transliteration",
    standard: "ochre",
    iso639_3: "jpn",
    bcp47: "ja-Latn-t-ja",
  },
  kaz: {
    name: "Kazakh",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "kaz",
    bcp47: "kk",
  },
  kor: {
    name: "Korean",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "kor",
    bcp47: "ko",
  },
  lmc: {
    name: "Late Middle Chinese",
    kind: "language",
    standard: "ochre",
    iso639_3: "ltc",
    bcp47: "ltc",
  },
  lat: {
    name: "Latin",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "lat",
    bcp47: "la",
  },
  xlt: {
    name: "Latin XLit",
    kind: "transliteration",
    standard: "ochre",
    iso639_3: null,
    bcp47: "und-Latn",
  },
  luw: {
    name: "Luwian",
    kind: "language",
    standard: "ochre",
    iso639_3: null,
    bcp47: null,
  },
  cmn: {
    name: "Mandarin",
    kind: "language",
    standard: "iso639-3",
    iso639_3: "cmn",
    bcp47: "cmn",
  },
  mar: {
    name: "Marathi",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "mar",
    bcp47: "mr",
  },
  met: {
    name: "Metrical",
    kind: "vocabulary",
    standard: "ochre",
    iso639_3: null,
    bcp47: null,
  },
  zxx: {
    name: "No linguistic content",
    kind: "non-linguistic",
    standard: "iso639-2b",
    iso639_3: "zxx",
    bcp47: "zxx",
  },
  och: {
    name: "Old Chinese",
    kind: "language",
    standard: "iso639-3",
    iso639_3: "och",
    bcp47: "och",
  },
  peo: {
    name: "Old Persian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "peo",
    bcp47: "peo",
  },
  ota: {
    name: "Ottoman Turkish",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "ota",
    bcp47: "ota",
  },
  "ota-xlt": {
    name: "Ottoman Turkish XLit",
    kind: "transliteration",
    standard: "ochre",
    iso639_3: "ota",
    bcp47: "ota-Latn-t-ota-arab",
  },
  pla: {
    name: "Palaic",
    kind: "language",
    standard: "ochre",
    iso639_3: "plq",
    bcp47: "plq",
  },
  per: {
    name: "Persian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "fas",
    bcp47: "fa",
  },
  phn: {
    name: "Phoenician",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "phn",
    bcp47: "phn",
  },
  xpg: {
    name: "Phrygian",
    kind: "language",
    standard: "iso639-3",
    iso639_3: "xpg",
    bcp47: "xpg",
  },
  pol: {
    name: "Polish",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "pol",
    bcp47: "pl",
  },
  por: {
    name: "Portuguese",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "por",
    bcp47: "pt",
  },
  pro: {
    name: "Pronunciation",
    kind: "vocabulary",
    standard: "iso639-2b",
    iso639_3: null,
    bcp47: null,
  },
  rel: {
    name: "Relator",
    kind: "vocabulary",
    standard: "ochre",
    iso639_3: null,
    bcp47: "zxx",
  },
  rus: {
    name: "Russian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "rus",
    bcp47: "ru",
  },
  san: {
    name: "Sanskrit",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "san",
    bcp47: "sa",
  },
  srp: {
    name: "Serbian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "srp",
    bcp47: "sr",
  },
  spa: {
    name: "Spanish",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "spa",
    bcp47: "es",
  },
  sux: {
    name: "Sumerian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "sux",
    bcp47: "sux",
  },
  sup: {
    name: "Supplemental",
    kind: "vocabulary",
    standard: "ochre",
    iso639_3: null,
    bcp47: null,
  },
  syc: {
    name: "Syriac",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "syc",
    bcp47: "syc",
  },
  tei: {
    name: "TEI",
    kind: "vocabulary",
    standard: "ochre",
    iso639_3: null,
    bcp47: null,
  },
  tur: {
    name: "Turkish",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "tur",
    bcp47: "tr",
  },
  uga: {
    name: "Ugaritic",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "uga",
    bcp47: "uga",
  },
  ukr: {
    name: "Ukrainian",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "ukr",
    bcp47: "uk",
  },
  urd: {
    name: "Urdu",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "urd",
    bcp47: "ur",
  },
  uzb: {
    name: "Uzbek",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "uzb",
    bcp47: "uz",
  },
  var: {
    name: "Variation",
    kind: "vocabulary",
    standard: "ochre",
    iso639_3: null,
    bcp47: null,
  },
  was: {
    name: "Washo",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "was",
    bcp47: "was",
  },
  yid: {
    name: "Yiddish",
    kind: "language",
    standard: "iso639-2b",
    iso639_3: "yid",
    bcp47: "yi",
  },
  yua: {
    name: "Yucatec Maya",
    kind: "language",
    standard: "iso639-3",
    iso639_3: "yua",
    bcp47: "yua",
  },
} as const satisfies Record<string, OchreLanguage>;

/**
 * A language code OCHRE publishes
 */
export type OchreLanguageCode = keyof typeof OCHRE_LANGUAGES;

/**
 * Check whether a string is a language code OCHRE publishes
 * @param code - The code to check
 * @returns Whether OCHRE publishes the code
 */
export function isOchreLanguageCode(code: string): code is OchreLanguageCode {
  return Object.hasOwn(OCHRE_LANGUAGES, code);
}

/**
 * Look up a language OCHRE publishes by its OCHRE code
 * @param code - The OCHRE language code
 * @returns The language, or null when OCHRE does not publish the code
 */
export function getOchreLanguage(code: string): OchreLanguage | null {
  return isOchreLanguageCode(code) ? OCHRE_LANGUAGES[code] : null;
}

/**
 * Find the OCHRE code of a language from its ISO 639-3 identifier
 * @param iso639_3 - The ISO 639-3 identifier
 * @returns The OCHRE code of the language itself, not of a transliteration,
 * or null when OCHRE publishes no code for it
 */
export function getOchreLanguageCode(
  iso639_3: string,
): OchreLanguageCode | null {
  if (
    isOchreLanguageCode(iso639_3) &&
    OCHRE_LANGUAGES[iso639_3].iso639_3 === iso639_3
  ) {
    return iso639_3;
  }

  for (const [code, language] of Object.entries(OCHRE_LANGUAGES)) {
    if (
      language.kind === "language" &&
      language.iso639_3 === iso639_3 &&
      isOchreLanguageCode(code)
    ) {
      return code;
    }
  }

  return null;
}

/**
 * MorphhbBibleProvider
 *
 * Implements IHebrewBibleProvider using the Open Scriptures Hebrew Bible (morphhb) dataset.
 * The XML files are fetched from the GitHub raw content URL as a CDN.
 *
 * IMPORTANT: This provider supplies ONLY the Hebrew text and navigational structure.
 * It does NOT supply morphological analysis — that comes from Gemini + Farfán.
 *
 * Caching strategy: parsed books are cached in-memory per process lifetime.
 *
 * morphhb XML format (OSIS):
 *   <verse osisID="Jonah.2.3">
 *     <w lemma="c/H559" morph="HC/Vqw3ms">וַ/יֹּ֣אמֶר</w>
 *     ...
 *   </verse>
 */

import type {
  IHebrewBibleProvider,
  HebrewBook,
  HebrewVerse,
  HebrewWordToken,
  BookIndex,
  BibleSection,
} from '@dosfilos/domain';
import { HEBREW_BOOKS_CATALOG } from './books-catalog.js';

type ParsedBook = {
  verses: Map<string, { hebrewText: string; words: HebrewWordToken[] }>;
  versesPerChapter: number[];
};

/** Base URL to access the morphhb WLC XML files. */
const MORPHHB_BASE_URL =
  'https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc';

/**
 * Inlines morphhb `<seg>` markers into the text of the preceding `<w>` element.
 *
 * morphhb stores special markers as standalone `<seg>` elements between `<w>` words.
 * Verified against the actual XML source (e.g. Gen.3.22):
 *
 *  • Maqaf  (x-maqqef) U+05BE ־  — prosodic hyphen:
 *      `</w><seg type="x-maqqef">־</seg><w ...>`
 *    → The maqaf char is appended to the FIRST word's text.
 *
 *  • Paseq  (x-paseq) U+05C0 ׀  — cantillation pause separator:
 *      `</w>\n<seg type="x-paseq">׀</seg>`
 *    → The paseq char is appended to the preceding word's text.
 *
 *  • Sof Pasuq (x-sof-pasuq) U+05C3 ׃  — verse-ending marker:
 *      `</w><seg type="x-sof-pasuq">׃</seg>`
 *    → Appended to the last word so the full stop renders inline.
 *
 * By mutating the XML string BEFORE the `<w>` regex runs, both characters are
 * captured naturally without changing the rest of the parser logic.
 */
function inlineSegMarkers(verseContent: string): string {
  return verseContent
    // Maqaf: <seg type="x-maqqef">־</seg> (with content, NOT self-closing)
    .replace(/<\/w>(\s*)<seg\s+type="x-maqqef">[^<]*<\/seg>/g, '\u05BE</w>$1')
    // Paseq: <seg type="x-paseq">׀</seg> (note: x-paseq, NOT x-pe)
    .replace(/<\/w>(\s*)<seg\s+type="x-paseq">[^<]*<\/seg>/g, '\u05C0</w>$1')
    // Sof Pasuq: <seg type="x-sof-pasuq">׃</seg>
    .replace(/<\/w>(\s*)<seg\s+type="x-sof-pasuq">[^<]*<\/seg>/g, '\u05C3</w>$1');
}

/**
 * Deja sólo el QERE donde el texto trae ketiv y qere.
 *
 * morphhb escribe el ketiv como `<w type="x-ketiv">` y el qere dentro de la
 * nota que lo sigue (`<note><rdg type="x-qere"><w>…</w></rdg></note>`). El
 * lector de `<w>` los tomaba a los DOS como palabras: en Rut 1:8 el versículo
 * tenía «יעשה יַ֣עַשׂ», cuatro consonantes que el modelo nunca escribió, y
 * todo lo que seguía se corría. Se muestra el qere, que es lo que se lee y lo
 * que el modelo analiza. Un ketiv sin qere (ketiv wela qere) se conserva.
 */
function keepQereOverKetiv(verseContent: string): string {
  return verseContent.replace(
    /<w\b[^>]*type="x-ketiv"[^>]*>[\s\S]*?<\/w>(?=\s*<note\b[^>]*>(?:(?!<\/note>)[\s\S])*?<rdg\s+type="x-qere">\s*<w\b)/g,
    '',
  );
}

/**
 * Parses a morphhb OSIS XML string into a structured map of verseId → tokens.
 */
export function parseMorphhbXml(xmlText: string): ParsedBook {
  // Simple regex-based parser (avoids a full XML DOM parser dependency)
  const verseMap = new Map<string, { hebrewText: string; words: HebrewWordToken[] }>();
  const versesPerChapter: number[] = [];

  // Match each <verse> block
  const verseRegex = /<verse\s+osisID="([^"]+)">([\s\S]*?)<\/verse>/g;
  let verseMatch: RegExpExecArray | null;

  while ((verseMatch = verseRegex.exec(xmlText)) !== null) {
    const [, osisId, rawVerseContent] = verseMatch;
    const parts = osisId.split('.');
    const chapter = parseInt(parts[1] ?? '0', 10);

    // Inline maqaf (x-maqqef) and paseq (x-pe) seg markers into adjacent <w> elements
    // BEFORE running the word regex, so they are captured as part of the word text.
    const verseContent = inlineSegMarkers(keepQereOverKetiv(rawVerseContent));

    // Collect word tokens from <w> elements
    const words: HebrewWordToken[] = [];
    const wRegex = /<w\s+([^>]*)>([\s\S]*?)<\/w>/g;
    let wMatch: RegExpExecArray | null;

    while ((wMatch = wRegex.exec(verseContent)) !== null) {
      const [, attrs, rawText] = wMatch;
      const lemma = extractAttr(attrs, 'lemma');
      const morph = extractAttr(attrs, 'morph');
      // Remove OSIS markup from the text (ketiv/qere etc.), slashes, and normalize spaces.
      // NOTE: the replace(/\//g) strips morphhb's morpheme slash notation (e.g. "וַ/יֹּאמֶר")
      // but must NOT strip the maqaf U+05BE or paseq U+05C0 that were just inlined.
      const text = rawText.replace(/<[^>]+>/g, '').replace(/\//g, '').replace(/\s+/g, ' ').trim();

      if (text) {
        words.push({ text, lemma, oshbMorphCode: morph });
      }
    }


    // Join word tokens with spaces, but omit the space after a maqaf (U+05BE ־).
    // Maqaf binds words prosodically: "פֶּן־יִשְׁלַח" not "פֶּן־ יִשְׁלַח".
    const hebrewText = words.reduce((acc, w, i) => {
      if (i === 0) return w.text;
      const prevEndsMaqaf = words[i - 1].text.endsWith('\u05BE');
      return acc + (prevEndsMaqaf ? '' : ' ') + w.text;
    }, '');
    verseMap.set(osisId, { hebrewText, words });

    // Track max verse per chapter
    const verse = parseInt(parts[2] ?? '0', 10);
    if (!versesPerChapter[chapter - 1] || versesPerChapter[chapter - 1] < verse) {
      versesPerChapter[chapter - 1] = verse;
    }
  }

  return { verses: verseMap, versesPerChapter };
}

function extractAttr(attrs: string, name: string): string {
  const match = new RegExp(`${name}="([^"]*)"`, 'i').exec(attrs);
  return match ? match[1] : '';
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class MorphhbBibleProvider implements IHebrewBibleProvider {
  private readonly cache = new Map<string, ParsedBook>();

  getBooks(): HebrewBook[] {
    return HEBREW_BOOKS_CATALOG;
  }

  getBookIndex(morphhbKey: string): BookIndex {
    const book = this.getCachedBook(morphhbKey);
    if (!book) {
      throw new Error(
        `Book "${morphhbKey}" not loaded. Call a method that triggers loading first.`,
      );
    }
    return { bookKey: morphhbKey, versesPerChapter: book.versesPerChapter };
  }

  getChapterCount(morphhbKey: string): number {
    const bookMeta = HEBREW_BOOKS_CATALOG.find((b) => b.morphhbKey === morphhbKey);
    return bookMeta?.chapterCount ?? 0;
  }

  getVerseCount(morphhbKey: string, chapter: number): number {
    const book = this.getCachedBook(morphhbKey);
    return book?.versesPerChapter[chapter - 1] ?? 0;
  }

  getVerse(morphhbKey: string, chapter: number, verse: number): HebrewVerse {
    const book = this.getCachedBook(morphhbKey);
    const osisId = `${morphhbKey}.${chapter}.${verse}`;

    if (!book) {
      throw new Error(`Book "${morphhbKey}" not loaded. Call loadBook() first.`);
    }

    const data = book.verses.get(osisId);
    if (!data) {
      throw new Error(`Verse ${osisId} not found in the morphhb dataset.`);
    }

    const bookMeta = HEBREW_BOOKS_CATALOG.find((b) => b.morphhbKey === morphhbKey);
    const displayReference = `${bookMeta?.nameSpanish ?? morphhbKey} ${chapter}:${verse}`;

    return {
      reference: osisId,
      displayReference,
      hebrewText: data.hebrewText,
      words: data.words,
    };
  }

  /**
   * Loads and parses a book from morphhb into the in-memory cache.
   * Must be called before getVerse() / getVerseCount() for a book.
   */
  async loadBook(morphhbKey: string): Promise<void> {
    if (this.cache.has(morphhbKey)) return;

    const url = `${MORPHHB_BASE_URL}/${morphhbKey}.xml`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to load morphhb data for "${morphhbKey}": HTTP ${response.status}`,
      );
    }
    const xmlText = await response.text();
    const parsed = parseMorphhbXml(xmlText);
    this.cache.set(morphhbKey, parsed);
  }

  private getCachedBook(morphhbKey: string): ParsedBook | undefined {
    return this.cache.get(morphhbKey);
  }
}

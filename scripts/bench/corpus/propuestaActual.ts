/**
 * Banco del corpus — lo que el sistema propone HOY (fase «Del corpus al texto», #826–#829).
 *
 * Reproduce, con las mismas funciones puras del repo, las rutas deterministas de la app:
 *   inicial  = propuesta del selector (`proposeSheetRanges`): edición del texto, hojas que nombran el
 *              pasaje o estructura del comentario. El respaldo semántico (`retrieveChunks`) no se
 *              reproduce porque pide un embedding (gasto); si una fuente cae ahí, queda vacía.
 *   pregunta = tarjeta «¿Qué responde cada pregunta?» (`reviewCorpusByQuestion`).
 *   seccion  = secciones sugeridas de la gramática (`sectionsForKeys`).
 *   lema     = entrada de cada lema del pasaje en léxicos y diccionarios.
 * Esta es la línea base: las rutas nuevas de la fase A se agregan en otro archivo y se comparan.
 */
import {
  referenceRegExp, referenceOccurrencesIn, referenceVersesFromRefs, conElIndiceDePasajes, lemmaEntriesIn, lemmaKey,
} from '../../../packages/functions/src/library/documentTextSearch';
import {
  parseBriefQuestions, passageReferenceQuery, questionLemmas, passageLemmas, grammarSearchKeys, grammarKeysFromMorphology,
  mergeGrammarKeys, sectionsForKeys, proposePassageSheets, rankPassageSheets,
  textEditionSheetsForPassage, resolveOutlineReferences, outlineStructureQuality, selectChunksForPassage, sheetsForChunkRanges,
  reviewCorpusByQuestion, normalizeSheetRanges, isPickedByPages, isTextEditionSourceType, LEMMA_ENTRY_SOURCE_TYPES,
} from '../../../packages/domain/src/index';
import type { LibroCargado } from './cargarLibro';
import type { CasoBanco, PropuestaFuente } from './tipos';
import type { VersoMorfologia } from './morfologia';

type Rango = { start: number; end: number };

const hojasDe = (rangos: ReadonlyArray<Rango>): Set<number> => {
  const o = new Set<number>();
  for (const r of rangos) for (let s = r.start; s <= r.end; s++) o.add(s);
  return o;
};

export const RUTAS_ACTUALES = ['inicial', 'pregunta', 'seccion', 'lema'] as const;

/**
 * Propuestas de todas las fuentes de un caso. `libros` trae el libro cargado de cada fuente.
 * `versos` es la morfología del pasaje (vacía si el idioma aún no tiene lemas en el banco).
 */
export function propuestaActual(
  caso: CasoBanco,
  libros: ReadonlyMap<string, LibroCargado>,
  versos: readonly VersoMorfologia[],
): PropuestaFuente[] {
  const passage = { ...caso.pasaje } as never as Parameters<typeof textEditionSheetsForPassage>[1];
  const brief = caso.consigna;
  const questions = brief ? parseBriefQuestions(brief, passage) : [];
  const qVerses = [...new Set(questions.flatMap(q => q.verses.filter(v => v.chapter === caso.pasaje.chapterStart).map(v => v.verse)))];
  const entries = versos as never;
  const qLemmas = versos.length ? questionLemmas(questions, entries) : [];
  const pLemmas = versos.length ? passageLemmas(entries) : [];
  const claves = mergeGrammarKeys(grammarSearchKeys(brief), grammarKeysFromMorphology(entries));
  const q = passageReferenceQuery(passage);
  if (!q) throw new Error(`Pasaje sin consulta de referencia: ${JSON.stringify(caso.pasaje)}`);
  const re = referenceRegExp(q.names);
  const enElPasaje = (c: number, v: number) => c >= q.chapterStart && c <= q.chapterEnd
    && (c !== q.chapterStart || q.verseStart == null || v >= q.verseStart)
    && (c !== q.chapterEnd || q.verseEnd == null || v <= q.verseEnd);

  const fuentesRevision: unknown[] = [];
  const parciales: Array<Omit<PropuestaFuente, 'porPregunta'> & { porPregunta: Map<number, Set<number>> }> = [];

  for (const f of caso.fuentes) {
    const L = libros.get(f.libro);
    if (!L) continue;
    const type = f.sourceType;

    // Hojas que nombran el pasaje (callable `searchDocumentText`, modo referencia).
    const porHoja = new Map<number, { sheet: number; count: number; verses: number[]; snippet: string; section: string | null }>();
    for (const c of L.fragmentos) {
      const e = conElIndiceDePasajes(referenceOccurrencesIn(c.text, re, enElPasaje), referenceVersesFromRefs(c.refs as never, q.bookId, enElPasaje));
      if (e.at.length === 0) continue;
      const h = porHoja.get(c.sheet);
      if (h) { h.count += e.at.length; h.verses = [...new Set([...h.verses, ...e.verses])].sort((x, y) => x - y); }
      else porHoja.set(c.sheet, { sheet: c.sheet, count: e.at.length, verses: e.verses, snippet: '', section: c.section });
    }
    // El callable recorta a 80 por relevancia.
    const devueltas = [...porHoja.values()].sort((x, y) => (y.verses.length - x.verses.length) || (y.count - x.count) || (x.sheet - y.sheet)).slice(0, 80);
    const ranked = rankPassageSheets(devueltas);

    const pasaje = (): Rango[] => {
      const eleg = proposePassageSheets(devueltas as never, qVerses.length ? qVerses : null);
      const antes = (type === 'lexicon-technical' || type === 'theological-dictionary') ? 1 : 0;
      return normalizeSheetRanges(eleg.map((r: Rango) => ({ start: Math.max(1, r.start - antes), end: r.end })));
    };
    const estructura = (): Rango[] => {
      const ent: Array<{ chunkIndex: number; page: number; section: string | null; sectionPath: string[] }> = [];
      for (const t of L.esquema) for (let i = t.startChunk; i <= t.endChunk; i++) ent.push({ chunkIndex: i, page: t.page, section: t.section, sectionPath: t.sectionPath });
      if (!ent.length) return [];
      const resolved = resolveOutlineReferences(ent as never, caso.pasaje.bookId);
      if (!outlineStructureQuality(resolved).usable) return [];
      const sel = selectChunksForPassage(resolved, passage as never, { contextChunks: 1, maxChunks: 60 });
      return sel.chunkCount === 0 ? [] : sheetsForChunkRanges(L.indice as never, sel.ranges);
    };

    let inicial: Rango[] = []; let rutaInicial = 'ninguna';
    if (isTextEditionSourceType(type as never)) {
      inicial = textEditionSheetsForPassage(L.indice as never, passage); rutaInicial = inicial.length ? 'edición' : 'ninguna';
      if (!inicial.length) { inicial = estructura(); rutaInicial = inicial.length ? 'estructura' : 'ninguna'; }
    } else if (isPickedByPages({ sourceType: type as never })) {
      inicial = pasaje(); rutaInicial = inicial.length ? 'pasaje' : 'ninguna';
      if (!inicial.length) { inicial = estructura(); rutaInicial = inicial.length ? 'estructura' : 'semántica (no reproducible)'; }
    } else {
      inicial = estructura(); rutaInicial = inicial.length ? 'estructura' : 'ninguna';
      if (!inicial.length) { inicial = pasaje(); rutaInicial = inicial.length ? 'pasaje' : 'semántica (no reproducible)'; }
    }

    const esLex = LEMMA_ENTRY_SOURCE_TYPES.has(type as never);
    const entradasQ = esLex ? lemmaEntriesIn(L.fragmentos as never, qLemmas.map(l => lemmaKey(l.lemma))) : {};
    const entradasP = esLex ? lemmaEntriesIn(L.fragmentos as never, pLemmas.map(l => lemmaKey(l.lemma))) : {};
    const lema = new Set<number>();
    for (const e of Object.values(entradasP) as Array<{ startSheet: number; endSheet: number }>) for (let x = e.startSheet; x <= e.endSheet; x++) lema.add(x);
    const seccion = new Set<number>((type === 'grammar-syntax' ? sectionsForKeys(L.secciones, claves) : []).map((x: { sheet: number }) => x.sheet));

    fuentesRevision.push({
      sourceId: f.libro, sourceType: type, selected: inicial, pinned: [],
      verseHits: ranked.map(h => ({ sheet: h.sheet, count: h.count, verses: h.verses })),
      ...(esLex ? {
        lemmaEntries: qLemmas.map(l => {
          const e = (entradasQ as Record<string, { startSheet: number; endSheet: number }>)[lemmaKey(l.lemma)];
          return { question: l.question, lemma: l.lemma, term: l.term, entry: e ? { start: e.startSheet, end: e.endSheet } : null, appears: !!e };
        }),
      } : {}),
      printedPages: 'resolved',
    });
    parciales.push({
      libro: f.libro, sourceType: type, rutaInicial,
      rutas: { inicial: hojasDe(inicial), pregunta: new Set<number>(), seccion, lema },
      porPregunta: new Map(),
    });
  }

  // La tarjeta por pregunta: solo con preguntas y un capítulo, como en la app.
  if (questions.length && caso.pasaje.chapterStart === caso.pasaje.chapterEnd) {
    const review = reviewCorpusByQuestion({ questions, chapter: caso.pasaje.chapterStart, sources: fuentesRevision as never });
    const porLibro = new Map(parciales.map(p => [p.libro, p]));
    for (const row of review.rows) for (const cov of row.sources) for (const h of cov.sheets) {
      const p = porLibro.get(cov.sourceId);
      if (!p) continue;
      (p.rutas.pregunta as Set<number>).add(h.sheet);
      const s = p.porPregunta.get(row.number) ?? new Set<number>();
      s.add(h.sheet);
      p.porPregunta.set(row.number, s);
    }
  }
  return parciales;
}

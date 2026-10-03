import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    passageLemmas,
    type BibleBookId,
    type ExegeticalPaper,
    type PassageLemma,
    type VerseMorphologyEntry,
} from '@dosfilos/domain';
import {
    MorphhbOriginalLanguageProvider,
    SBLGNTBibleProvider,
    TestamentDispatcherOriginalLanguageProvider,
} from '@dosfilos/infrastructure';

/** Un proveedor por sesión: cada uno guarda en memoria los libros que bajó. */
let proveedor: TestamentDispatcherOriginalLanguageProvider | null = null;
const proveedorDeMorfologia = () =>
    (proveedor ??= new TestamentDispatcherOriginalLanguageProvider(
        new SBLGNTBibleProvider(),
        new MorphhbOriginalLanguageProvider(),
    ));

/** La tabla Strong → lema (≈200 KB): sólo se baja si el pasaje es hebreo. */
let strong: Promise<Record<string, string>> | null = null;
const tablaDeStrong = () =>
    (strong ??= import('@/data/hebrew/strongLemmas.json').then(m => m.default as Record<string, string>));

/**
 * Los versículos del pasaje: los de los pasos del trabajo, o, antes de
 * generarlos, los del pasaje cuando cabe en un capítulo.
 */
export function passageVerses(
    paper: Pick<ExegeticalPaper, 'passage' | 'steps'>,
): Array<{ bookId: BibleBookId; chapter: number; verse: number }> {
    const deLosPasos = paper.steps
        .filter(s => s.kind === 'verse' && s.verseRef)
        .map(s => ({ bookId: s.verseRef!.bookId as BibleBookId, chapter: s.verseRef!.chapterStart, verse: s.verseRef!.verseStart ?? 1 }));
    if (deLosPasos.length > 0) return deLosPasos;
    const p = paper.passage;
    if (p.chapterStart !== (p.chapterEnd ?? p.chapterStart) || p.verseStart == null || p.verseEnd == null) return [];
    return Array.from({ length: p.verseEnd - p.verseStart + 1 }, (_, i) => ({
        bookId: p.bookId as BibleBookId, chapter: p.chapterStart, verse: p.verseStart! + i,
    }));
}

/**
 * Los lemas de TODO el pasaje, de la morfología (MorphGNT / morphhb).
 *
 * «Páginas por lema» los sacaba de los versículos ya analizados, y era
 * circular: para analizar bien hacen falta las hojas del léxico, y las hojas
 * salían del análisis (Jonás 4:5-11: nada de 4:8-11 con 4:5-4:7 analizados).
 */
export function usePassageLemmas(paper: ExegeticalPaper | null | undefined, enabled: boolean) {
    const versos = useMemo(() => (paper ? passageVerses(paper) : []), [paper]);
    const clave = versos.map(v => `${v.bookId}.${v.chapter}.${v.verse}`).join(',');
    return useQuery({
        queryKey: ['exegesis-passage-lemmas', clave],
        queryFn: async (): Promise<PassageLemma[]> => {
            const p = proveedorDeMorfologia();
            const entradas = await Promise.all(versos.map(async v => {
                try {
                    const morphology = await p.getVerseMorphology?.(v.bookId, v.chapter, v.verse);
                    return morphology ? [{ chapter: v.chapter, verse: v.verse, morphology } satisfies VerseMorphologyEntry] : [];
                } catch (err) {
                    console.warn('[lemas del pasaje] sin morfología para', v, err);
                    return [];
                }
            }));
            const verses = entradas.flat();
            const hebreo = verses.some(e => e.morphology.tokens.some(t => 'oshbMorphCode' in t));
            const tabla = hebreo ? await tablaDeStrong() : null;
            return passageLemmas(verses, n => tabla?.[String(n)]);
        },
        enabled: enabled && versos.length > 0,
        staleTime: Infinity,
        gcTime: 60 * 60 * 1000,
        retry: 1,
    });
}

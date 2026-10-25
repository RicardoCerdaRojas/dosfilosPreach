import type { BibleBookId } from '../../bible/canon/BibleCanon';
import type { PassageReference } from '../../bible/canon/passage-reference';

/**
 * Notas curadas «Para predicar…» por libro (fase «Encuadre de la serie»,
 * docs/FASE_ENCUADRE_SERIE_2026-10.md). Son decisiones que el pastor tiene
 * que tomar al planear la serie y que el texto no resuelve solo; cada
 * afirmación lleva su fuente. Datos fijos escritos a mano, como el catálogo:
 * nada se genera al mostrarlas. En español, como los `rationale` del catálogo.
 */
export interface PreachingNote {
    id: string;
    title: string;
    body: string;
    /** De dónde sale cada afirmación: obras del catálogo o textos bíblicos. */
    sources: ReadonlyArray<string>;
    /** El pasaje que toca la nota, para resaltarla cuando el alcance de la serie lo incluye. */
    passage?: PassageReference;
}

const WILLIAMSON = 'Williamson, Ezra, Nehemiah (WBC 16), 1985';
const ESKENAZI = 'Eskenazi, In an Age of Prose: A Literary Approach to Ezra-Nehemiah, 1988';
const FENSHAM = 'Fensham, The Books of Ezra and Nehemiah (NICOT), 1982';
const KIDNER = 'Kidner, Ezra and Nehemiah (TOTC), 1979';
const BLENKINSOPP = 'Blenkinsopp, Ezra-Nehemiah: A Commentary (OTL), 1988';

/** Esdras y Nehemías comparten las notas: en la Biblia hebrea son un solo libro (nota 1). */
const EZRA_NEHEMIAH_NOTES: ReadonlyArray<PreachingNote> = [
    {
        id: 'ezr-neh-unidad',
        title: 'Esdras y Nehemías son un solo libro',
        body: 'En la Biblia hebrea, Esdras y Nehemías forman un solo libro, y así lo leen los comentarios de referencia: '
            + 'el regreso, el templo, la ley y la muralla son un mismo relato. Antes de planear, decide: '
            + '¿tu serie termina en Esdras 10 o sigue hasta Nehemías 13?',
        sources: [WILLIAMSON, ESKENAZI, FENSHAM, KIDNER],
    },
    {
        id: 'ezr-4-orden-tematico',
        title: 'Esdras 4:6-23 ordena por tema, no por fecha',
        body: 'Esdras 4:6-23 junta la oposición de los reinados de Jerjes (4:6) y Artajerjes (4:7-23), posteriores a Darío '
            + '(4:24; caps. 5–6), para mostrar el patrón de la oposición. Respeta el orden del narrador y no afirmes una '
            + 'cronología que el texto no da. También se discute si Esdras llegó antes o después de Nehemías '
            + '(la propuesta de Van Hoonacker): es un debate abierto.',
        sources: [WILLIAMSON, BLENKINSOPP, 'Esd 4:5-7, 4:24'],
        passage: { bookId: 'EZR', chapterStart: 4, verseStart: 6, chapterEnd: 4, verseEnd: 23 },
    },
    {
        id: 'ezr-arameo',
        title: 'El arameo también dice algo',
        body: 'La correspondencia imperial está en arameo, la lengua del imperio (Esd 4:8–6:18; 7:12-26). Es también un dato '
            + 'teológico: el libro cita los documentos de los reyes y, a la vez, muestra a Dios moviendo a esos reyes '
            + '(1:1; 6:22; 7:27).',
        sources: [ESKENAZI, WILLIAMSON, 'Esd 1:1; 6:22; 7:27'],
    },
    {
        id: 'ezr-neh-listas',
        title: 'Las listas van con su narración',
        body: 'Las listas (Esd 2; 8:1-14; 10:18-44) dan nombre al pueblo que regresa, y no solo a sus líderes; la del '
            + 'capítulo 2 vuelve en Nehemías 7. Agrúpalas con la narración vecina en lugar de predicarlas solas.',
        sources: [ESKENAZI, 'Esd 2; Neh 7:6-73'],
    },
    {
        id: 'ezr-9-10-matrimonios',
        title: 'Esdras 9–10 pide cuidado pastoral',
        body: 'El eje del pasaje es el pacto y la idolatría, no la etnia: Esdras cita la ley que prohibía esos matrimonios '
            + 'porque desviaban al pueblo de Dios (Esd 9:1, 11-12; Dt 7:3-4; Mal 2:10-16). Pablo impide aplicarlo hoy como '
            + 'mandato de divorcio (1 Co 7:12-16). El libro termina sin resolver, y Nehemías 13 muestra la recaída: cerrar '
            + 'la serie en Esdras 10 sin mirar Nehemías deja a la congregación en el peor punto. Decide tú cómo lo tratas.',
        sources: ['Esd 9:1, 11-12', 'Dt 7:3-4', 'Mal 2:10-16', '1 Co 7:12-16', 'Neh 13:23-27', WILLIAMSON],
        passage: { bookId: 'EZR', chapterStart: 9, verseStart: 1, chapterEnd: 10, verseEnd: 44 },
    },
];

const NOTES_BY_BOOK: Partial<Record<BibleBookId, ReadonlyArray<PreachingNote>>> = {
    EZR: EZRA_NEHEMIAH_NOTES,
    NEH: EZRA_NEHEMIAH_NOTES,
};

/** Las notas para predicar el libro; vacío si no hay curadas. */
export function getPreachingNotes(bookId: BibleBookId): ReadonlyArray<PreachingNote> {
    return NOTES_BY_BOOK[bookId] ?? [];
}

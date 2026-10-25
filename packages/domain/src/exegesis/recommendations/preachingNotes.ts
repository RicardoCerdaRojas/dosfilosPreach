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

/**
 * Esdras y Nehemías comparten las notas: en la Biblia hebrea son un solo libro (nota 1).
 * Cada cita bíblica se cotejó con el texto (RVR1960 del repo) al escribirla; las
 * fechas (458 y 445 a. C.) son los años 7.º y 20.º de Artajerjes I (Esd 7:7-8; Neh 2:1).
 */
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
        id: 'ezr-1-continuidad',
        title: 'Esdras empieza donde termina Crónicas',
        body: 'Esdras 1:1-3 repite casi palabra por palabra el final de 2 Crónicas (36:22-23): el decreto de Ciro cumple '
            + '"la palabra de Jehová por boca de Jeremías" (Esd 1:1; Jer 29:10). Más adelante, la obra del templo avanza '
            + 'con la predicación de Hageo y Zacarías (Esd 5:1; 6:14). Lee esos profetas junto con Esdras 5–6: cuentan '
            + 'el mismo momento desde la voz profética.',
        sources: ['Esd 1:1-3', '2 Cr 36:22-23', 'Jer 29:10', 'Esd 5:1; 6:14', 'Hag 1:1', 'Zac 1:1', WILLIAMSON],
        passage: { bookId: 'EZR', chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 3 },
    },
    {
        id: 'ezr-3-restauracion-incompleta',
        title: 'Una restauración incompleta',
        body: 'Cuando se echan los cimientos del templo, el llanto de los ancianos que vieron la primera casa se mezcla '
            + 'con los gritos de alegría (Esd 3:12-13); Hageo pregunta lo mismo y promete una gloria mayor (Hag 2:3-9). '
            + 'Al final, el pueblo ora: "hoy somos siervos" en su propia tierra (Neh 9:36-37). No prediques el regreso '
            + 'como una restauración cumplida: el libro deja abierta la espera, y el Nuevo Testamento la lleva hasta '
            + 'Jesús, que habla del templo de su cuerpo (Jn 2:19-21).',
        sources: ['Esd 3:12-13', 'Hag 2:3-9', 'Neh 9:36-37', 'Jn 2:19-21', WILLIAMSON, KIDNER],
        passage: { bookId: 'EZR', chapterStart: 3, verseStart: 12, chapterEnd: 3, verseEnd: 13 },
    },
    {
        id: 'ezr-4-orden-tematico',
        title: 'Esdras 4:6-23 es un paréntesis',
        // El texto sí da los reinados (4:5-7, 24): la nota no dice que falte cronología.
        body: 'Esdras 4:6-23 es un paréntesis que adelanta la oposición bajo Jerjes ("Asuero" en 4:6) y Artajerjes '
            + '(4:7-23); 4:24 retoma el hilo de 4:5, en tiempos de Darío. Explícalo para que la congregación no lo lea '
            + 'como hechos anteriores a Darío.',
        sources: [WILLIAMSON, BLENKINSOPP, 'Esd 4:5-7, 4:24'],
        passage: { bookId: 'EZR', chapterStart: 4, verseStart: 6, chapterEnd: 4, verseEnd: 23 },
    },
    {
        id: 'ezr-neh-orden',
        title: '¿Quién llegó primero, Esdras o Nehemías?',
        body: 'Williamson y Blenkinsopp defienden el orden tradicional: Esdras llega en el año séptimo de Artajerjes I '
            + '(458 a. C.; Esd 7:7-8) y Nehemías en el vigésimo (445 a. C.; Neh 2:1). Van Hoonacker propuso que Nehemías '
            + 'llegó antes. El narrador los junta en Nehemías 8:9 y 12:26, 36.',
        sources: [WILLIAMSON, BLENKINSOPP, 'Esd 7:7-8', 'Neh 2:1', 'Neh 8:9; 12:26, 36'],
    },
    {
        id: 'ezr-arameo',
        title: 'El arameo también dice algo',
        // 1:1; 6:22 y 7:27 están en hebreo: la nota no los presenta como parte del tramo arameo.
        body: 'Esdras 4:8–6:18 y 7:12-26 están en arameo, la lengua de la administración persa: hay cartas y también '
            + 'narración (4:24–5:5; 6:13-18). Lo teológico no es la lengua sino lo que hacen los documentos: el libro deja '
            + 'hablar a los reyes y sus archivos (6:1-12), y muestra a Dios moviéndolos (1:1; 6:22; 7:27, pasajes en hebreo).',
        sources: [ESKENAZI, WILLIAMSON, 'Esd 4:8–6:18; 7:12-26', 'Esd 6:1-12', 'Esd 1:1; 6:22; 7:27'],
        passage: { bookId: 'EZR', chapterStart: 4, verseStart: 8, chapterEnd: 6, verseEnd: 18 },
    },
    {
        id: 'ezr-7-8-no-manual',
        title: 'No es un manual de liderazgo',
        body: 'Esdras 7:10 explica el versículo anterior: la mano de Dios estaba con Esdras "porque" había preparado su '
            + 'corazón para inquirir la ley, cumplirla y enseñarla (7:9-10). El libro repite que "la mano de Dios" estaba '
            + 'sobre Esdras y sobre el pueblo (7:6, 9, 28; 8:18, 22, 31): el protagonista es Dios con su pueblo, no la '
            + 'técnica del líder. Si predicas Esdras 7–8 como lecciones de liderazgo, pierdes lo que el texto subraya.',
        sources: ['Esd 7:6, 9-10, 28', 'Esd 8:18, 22, 31', ESKENAZI, KIDNER],
        passage: { bookId: 'EZR', chapterStart: 7, verseStart: 1, chapterEnd: 8, verseEnd: 36 },
    },
    {
        id: 'ezr-neh-listas',
        title: 'Las listas van con su narración',
        // Sin `passage`: la lista de 10:18-44 ya la cubre la nota de Esdras 9–10.
        body: 'Las listas de Esdras 2 y 8:1-14 dan nombre al pueblo que regresa, y no solo a sus líderes; la del '
            + 'capítulo 2 vuelve en Nehemías 7. La de 10:18-44 es otra cosa: nombra a los culpables, empezando por los '
            + 'sacerdotes (10:18). Agrúpalas con la narración vecina en lugar de predicarlas solas.',
        sources: [ESKENAZI, 'Esd 2; 8:1-14', 'Esd 10:18-44', 'Neh 7:6-73'],
    },
    {
        id: 'ezr-9-10-matrimonios',
        title: 'Esdras 9–10 pide cuidado pastoral',
        body: 'Esdras plantea el problema como fidelidad al pacto frente a las "abominaciones" de los pueblos (9:1, 11, 14), '
            + 'con un lenguaje de "linaje santo" (9:2) cuyo peso étnico discuten los comentarios. El libro no plantea un '
            + 'rechazo racial: recibe a quienes se apartan de la impureza para buscar al Señor (6:21). En 9:11-12, Esdras '
            + 'resume varias leyes (Dt 7:1-4; 23:3-6; Lv 18:24-30) como palabra de "los profetas". Malaquías condena '
            + 'casarse con "hija de dios extraño" (Mal 2:11) y también el divorcio desleal (2:14-16): no lo cites solo a '
            + 'favor. El Nuevo Testamento mantiene casarse "en el Señor" (1 Co 7:39), pero impide divorciarse del cónyuge '
            + 'no creyente que quiere quedarse (1 Co 7:12-16). Ni Esdras 10 ni Nehemías 13 cierran con un pueblo cambiado: '
            + 'la reforma no transforma el corazón y apunta más allá (Jer 31:31-34; Ez 36:26-27). Decide tú cómo lo tratas.',
        sources: [
            'Esd 9:1-2, 11-14', 'Esd 6:21', 'Dt 7:1-4', 'Dt 23:3-6', 'Lv 18:24-30', 'Mal 2:10-16',
            '1 Co 7:39', '1 Co 7:12-16', 'Neh 13:23-27', 'Jer 31:31-34', 'Ez 36:26-27', WILLIAMSON, KIDNER, FENSHAM,
        ],
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

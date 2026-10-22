import { describe, expect, it } from 'vitest';
import {
    addAndPinSheets,
    evidenceFromReview,
    reviewCorpusByQuestion,
    type QuestionReviewSource,
} from '../corpusQuestionReview';
import type { BriefQuestion } from '../briefQuestions';

/**
 * El corpus del TP #8 (Santiago 4:1-10) como estaba ANTES de los arreglos a
 * mano del 2026-10-21. Hojas reales: la nota de Mayor sobre 4:3 es la 411; la
 * entrada de μέλος en Tuggy, 584–585; Wallace nombra Stg 4 en 569, 633 y 698.
 */
const preguntas: BriefQuestion[] = [
    { number: 1, text: '¿Qué significa el sustantivo μέλεσιν (4:1)?', verses: [{ chapter: 4, verse: 1 }] },
    { number: 2, text: '¿Por qué αἰτεῖτε en voz activa (4:3)?', verses: [{ chapter: 4, verse: 3 }] },
    { number: 3, text: '¿De dónde viene la cita de 4:5?', verses: [{ chapter: 4, verse: 5 }] },
];

const mayor: QuestionReviewSource = {
    sourceId: 'mayor',
    sourceType: 'commentary-critical',
    selected: [{ start: 407, end: 410 }, { start: 413, end: 417 }],
    pinned: [],
    verseHits: [
        { sheet: 30, count: 1, verses: [3] }, // la introducción
        { sheet: 407, count: 4, verses: [1, 2] },
        { sheet: 411, count: 3, verses: [2, 3] },
        { sheet: 413, count: 2, verses: [4, 5] },
        { sheet: 415, count: 5, verses: [5] },
    ],
    printedPages: 'resolved',
};

const tuggy: QuestionReviewSource = {
    sourceId: 'tuggy',
    sourceType: 'lexicon-technical',
    selected: [{ start: 585, end: 585 }],
    pinned: [],
    verseHits: [{ sheet: 585, count: 1, verses: [1] }],
    lemmaEntries: [{ question: 1, lemma: 'μέλος', term: 'μέλεσιν', entry: { start: 584, end: 585 } }],
    printedPages: 'resolved',
};

const wallace: QuestionReviewSource = {
    sourceId: 'wallace',
    sourceType: 'grammar-syntax',
    selected: [{ start: 560, end: 575 }, { start: 690, end: 700 }],
    pinned: [{ start: 698, end: 698 }],
    verseHits: [
        { sheet: 569, count: 1, verses: [5] },
        { sheet: 633, count: 1, verses: [3] },
        { sheet: 698, count: 1, verses: [1] },
    ],
    printedPages: 'resolved',
};

const na28: QuestionReviewSource = {
    sourceId: 'na28',
    sourceType: 'biblical-text-edition',
    selected: [{ start: 690, end: 692 }],
    pinned: [],
    verseHits: [],
    printedPages: 'resolved',
};

const runge: QuestionReviewSource = {
    sourceId: 'runge',
    sourceType: 'grammar-syntax',
    selected: [{ start: 100, end: 110 }],
    pinned: [],
    verseHits: [],
    printedPages: 'unresolved',
};

const revisar = (sources: QuestionReviewSource[]) =>
    reviewCorpusByQuestion({ questions: preguntas, chapter: 4, sources });

describe('reviewCorpusByQuestion (TP #8, A4)', () => {
    it('avisa que la nota de Mayor sobre 4:3 (h. 411) no está en el corpus', () => {
        const { warnings } = revisar([mayor]);
        // La introducción (h. 30) también nombra 4:3, al pasar: se muestra, no se sugiere.
        expect(warnings).toContainEqual({ kind: 'missing-sheets', sourceId: 'mayor', questions: [2], sheets: [411] });
        // 4:1 y 4:5 sí tienen hojas de Mayor en el corpus: no se avisa por la introducción.
        expect(warnings.filter(w => w.kind === 'missing-sheets' && !w.questions.includes(2))).toEqual([]);
    });

    it('muestra primero las hojas del corpus y después las de afuera, de más menciones a menos', () => {
        const fila = revisar([mayor]).rows.find(r => r.number === 3)!;
        expect(fila.sources).toEqual([{
            sourceId: 'mayor',
            via: 'verse',
            sheets: [{ sheet: 415, state: 'in-corpus' }, { sheet: 413, state: 'in-corpus' }],
        }]);
    });

    it('avisa la hoja que quedó en un hueco de la sección aunque otra hoja del corpus nombre el versículo', () => {
        // Medido con el TP #8: sin la 411, la 413 («IV 3–5] NOTES») también
        // nombra 4:3, y «sólo si no hay nada» no avisaba.
        const conLa413 = {
            ...mayor,
            verseHits: [...mayor.verseHits!.filter(h => h.sheet !== 413), { sheet: 413, count: 2, verses: [3, 4, 5] }],
        };
        expect(revisar([conLa413]).warnings).toContainEqual({ kind: 'missing-sheets', sourceId: 'mayor', questions: [2], sheets: [411] });
    });

    it('la hoja que sigue al final de la sección no es un hueco', () => {
        // Medido con el TP #8: Mayor 419 nombra 4:5 y la sección elegida termina en 418.
        const despues = { ...mayor, verseHits: [...mayor.verseHits!, { sheet: 419, count: 9, verses: [5] }] };
        expect(revisar([despues]).warnings.filter(w => w.kind === 'missing-sheets' && w.questions.includes(3))).toEqual([]);
    });

    it('entre dos secciones lejanas no hay hueco', () => {
        const lejos = {
            ...mayor,
            selected: [{ start: 400, end: 410 }, { start: 416, end: 420 }],
            verseHits: [{ sheet: 405, count: 1, verses: [5] }, { sheet: 413, count: 4, verses: [5] }],
        };
        // 413 queda a 3 de la 410 y a 3 de la 416: hueco. Con la sección siguiente en la 420, no.
        expect(revisar([lejos]).warnings).toContainEqual({ kind: 'missing-sheets', sourceId: 'mayor', questions: [3], sheets: [413] });
        const masLejos = { ...lejos, selected: [{ start: 400, end: 410 }, { start: 420, end: 425 }] };
        expect(revisar([masLejos]).warnings.filter(w => w.kind === 'missing-sheets')).toEqual([]);
        const lejosAntes = { ...lejos, selected: [{ start: 400, end: 405 }, { start: 416, end: 420 }] };
        expect(revisar([lejosAntes]).warnings.filter(w => w.kind === 'missing-sheets')).toEqual([]);
    });

    it('una hoja que trata dos preguntas da un solo aviso', () => {
        // «IV 2, 3] NOTES»: la 411 trata 4:2 y 4:3.
        const dos: BriefQuestion[] = [
            { number: 2, text: '¿Qué denota φονεύετε (4:2)?', verses: [{ chapter: 4, verse: 2 }] },
            { number: 3, text: '¿Y αἰτεῖτε (4:3)?', verses: [{ chapter: 4, verse: 3 }] },
        ];
        const soloLa411 = { ...mayor, selected: [{ start: 413, end: 417 }], verseHits: [{ sheet: 411, count: 3, verses: [2, 3] }] };
        const { warnings } = reviewCorpusByQuestion({ questions: dos, chapter: 4, sources: [soloLa411] });
        expect(warnings.filter(w => w.kind === 'missing-sheets')).toEqual([{ kind: 'missing-sheets', sourceId: 'mayor', questions: [2, 3], sheets: [411] }]);
    });

    it('en un léxico con la entrada de la pregunta en el corpus, otra hoja que cita el versículo no falta', () => {
        // Medido con el TP #8: Tuggy 209 (δαπανάω) cita Stg 4:3 y la entrada de αἰτέω ya estaba.
        const conEntrada = {
            ...tuggy,
            selected: [{ start: 37, end: 38 }],
            verseHits: [{ sheet: 209, count: 1, verses: [3] }],
            lemmaEntries: [{ question: 2, lemma: 'αἰτέω', term: 'αἰτεῖτε', entry: { start: 37, end: 38 } }],
        };
        const { warnings } = revisar([conEntrada]);
        expect(warnings.filter(w => w.kind !== 'question-uncovered')).toEqual([]);
        // La pregunta 2 queda cubierta por la entrada.
        expect(warnings).not.toContainEqual({ kind: 'question-uncovered', question: 2 });
    });

    it('no avisa una mención lejos de la sección elegida si la fuente ya trae la pregunta', () => {
        const conIntro = { ...mayor, verseHits: [...mayor.verseHits!, { sheet: 30, count: 1, verses: [1] }] };
        expect(revisar([conIntro]).warnings.filter(w => w.kind === 'missing-sheets' && w.questions.includes(1))).toEqual([]);
    });

    it('un comentario del libro no se da por inútil aunque el índice no lo vea nombrar versículos', () => {
        // Mayor antes de rellenar sus refs: escribe «iv. 3».
        expect(revisar([{ ...mayor, verseHits: [] }]).warnings.filter(w => w.kind === 'unrelated')).toEqual([]);
    });

    it('avisa la entrada de μέλος incompleta en Tuggy: falta la 584', () => {
        const { warnings, rows } = revisar([tuggy]);
        expect(warnings).toContainEqual({ kind: 'missing-entry', sourceId: 'tuggy', question: 1, term: 'μέλεσιν', sheets: [584], whole: false });
        expect(rows[0]!.sources).toContainEqual({
            sourceId: 'tuggy', via: 'lemma', term: 'μέλεσιν',
            sheets: [{ sheet: 584, state: 'outside' }, { sheet: 585, state: 'in-corpus' }],
        });
    });

    it('distingue la entrada que falta entera de la que falta a medias', () => {
        const sinNada = { ...tuggy, selected: [{ start: 1, end: 2 }] };
        expect(revisar([sinNada]).warnings).toContainEqual({ kind: 'missing-entry', sourceId: 'tuggy', question: 1, term: 'μέλεσιν', sheets: [584, 585], whole: true });
    });

    it('distingue fijada, en el corpus y afuera en la gramática del curso', () => {
        const { rows, warnings } = revisar([wallace]);
        expect(rows[0]!.sources[0]!.sheets).toEqual([{ sheet: 698, state: 'pinned' }]);
        expect(rows[2]!.sources[0]!.sheets).toEqual([{ sheet: 569, state: 'in-corpus' }]);
        expect(warnings).toContainEqual({ kind: 'missing-sheets', sourceId: 'wallace', questions: [2], sheets: [633] });
    });

    it('Runge no nombra ningún versículo con pregunta y sus citas no se podrán comprobar', () => {
        const { warnings } = revisar([runge]);
        expect(warnings).toContainEqual({ kind: 'unrelated', sourceId: 'runge' });
        expect(warnings).toContainEqual({ kind: 'no-printed-pages', sourceId: 'runge' });
    });

    it('no juzga al texto base por no nombrar versículos', () => {
        const { warnings } = revisar([na28, mayor]);
        expect(warnings.filter(w => 'sourceId' in w && w.sourceId === 'na28')).toEqual([]);
    });

    it('un léxico con la entrada afuera avisa la entrada, no la hoja más citada de otra palabra (revisión de 8a)', () => {
        const sinLaEntrada = { ...tuggy, selected: [{ start: 1, end: 2 }], verseHits: [{ sheet: 209, count: 3, verses: [1] }] };
        const { warnings } = revisar([sinLaEntrada]);
        expect(warnings.filter(w => w.kind === 'missing-sheets')).toEqual([]);
        expect(warnings.some(w => w.kind === 'missing-entry')).toBe(true);
    });

    it('no juzga a un léxico cuando la consigna no trae lemas', () => {
        const sinLemas = { ...tuggy, verseHits: [], lemmaEntries: [] };
        expect(revisar([sinLemas]).warnings.filter(w => w.kind === 'unrelated')).toEqual([]);
    });

    it('sí juzga a un léxico que no tiene entrada para ningún lema de la consigna', () => {
        const sinEntrada = { ...tuggy, verseHits: [], lemmaEntries: [{ ...tuggy.lemmaEntries![0]!, entry: null }] };
        expect(revisar([sinEntrada]).warnings).toContainEqual({ kind: 'unrelated', sourceId: 'tuggy' });
    });

    it('no juzga a un léxico donde el lema aparece aunque no se detectó su entrada', () => {
        const sinEntradaDetectada = { ...tuggy, verseHits: [], lemmaEntries: [{ ...tuggy.lemmaEntries![0]!, entry: null, appears: true }] };
        expect(revisar([sinEntradaDetectada]).warnings.filter(w => w.kind === 'unrelated')).toEqual([]);
    });

    it('avisa la pregunta que ninguna hoja del corpus nombra', () => {
        const { warnings } = revisar([mayor, wallace]);
        // 4:3: Mayor la tiene en 411 y Wallace en 633, las dos afuera.
        expect(warnings).toContainEqual({ kind: 'question-uncovered', question: 2 });
        expect(warnings.filter(w => w.kind === 'question-uncovered')).toHaveLength(1);
    });

    it('una entrada de léxico en el corpus cubre la pregunta', () => {
        const completa = { ...tuggy, verseHits: [], selected: [{ start: 584, end: 585 }] };
        expect(revisar([completa]).warnings.filter(w => w.kind === 'question-uncovered' && w.question === 1)).toEqual([]);
    });

    it('una fuente sin datos queda pendiente y no se juzga', () => {
        const cargando = { ...mayor, verseHits: null };
        const review = revisar([cargando]);
        expect(review.pending).toEqual(['mayor']);
        expect(review.warnings).toEqual([]);
    });

    it('un léxico cuyas entradas todavía cargan queda pendiente', () => {
        expect(revisar([{ ...tuggy, lemmaEntries: null }]).pending).toEqual(['tuggy']);
    });

    it('el documento entero cuenta como en el corpus', () => {
        const entero = { ...mayor, selected: null };
        expect(revisar([entero]).warnings.filter(w => w.kind === 'missing-sheets')).toEqual([]);
    });

    it('ignora las preguntas sin versículos del capítulo del pasaje', () => {
        const otra: BriefQuestion = { number: 9, text: '¿Y 3:6?', verses: [{ chapter: 3, verse: 6 }] };
        const review = reviewCorpusByQuestion({ questions: [otra], chapter: 4, sources: [mayor] });
        expect(review.rows).toEqual([]);
        expect(review.warnings).toEqual([]);
    });

    it('sugiere la nota entera cuando corre varias hojas', () => {
        const sinLaNota = {
            ...mayor,
            selected: [{ start: 407, end: 410 }],
            verseHits: [
                { sheet: 30, count: 1, verses: [5] },
                { sheet: 414, count: 1, verses: [5] },
                { sheet: 415, count: 5, verses: [5] },
                { sheet: 416, count: 2, verses: [5] },
                { sheet: 418, count: 3, verses: [5] },
            ],
        };
        expect(revisar([sinLaNota]).warnings).toContainEqual({ kind: 'missing-sheets', sourceId: 'mayor', questions: [3], sheets: [414, 415, 416] });
    });

    it('limita las hojas mostradas por fuente y pregunta', () => {
        const muchas = { ...mayor, selected: [], verseHits: Array.from({ length: 9 }, (_, i) => ({ sheet: 100 + i, count: i, verses: [5] })) };
        const fila = revisar([muchas]).rows.find(r => r.number === 3)!;
        expect(fila.sources[0]!.sheets.map(s => s.sheet)).toEqual([108, 107, 106, 105]);
    });
});

describe('addAndPinSheets', () => {
    it('suma la hoja a los tramos y la fija sin fijar el tramo entero', () => {
        expect(addAndPinSheets([{ start: 407, end: 410 }, { start: 413, end: 417 }], [], [411])).toEqual({
            sheetRanges: [{ start: 407, end: 411 }, { start: 413, end: 417 }],
            pinnedRanges: [{ start: 411, end: 411 }],
        });
    });
});

/** B1–B2 (TP #8): lo que el plan de uso recibe de la revisión. */
describe('evidenceFromReview', () => {
    it('sólo las hojas del corpus, con sus renglones', () => {
        const conRenglon = {
            ...mayor,
            verseHits: [
                { sheet: 407, count: 4, verses: [1, 2], snippet: 'IV 1] NOTES πόθεν πόλεμοι' },
                { sheet: 411, count: 3, verses: [2, 3] },
            ],
        };
        const ev = evidenceFromReview(revisar([conRenglon]));
        expect(ev).toEqual([
            { question: 1, sourceId: 'mayor', via: 'verse', sheets: [407], snippets: ['IV 1] NOTES πόθεν πόλεμοι'] },
        ]);
        // La 411 está afuera: la pregunta 2 no tiene evidencia de Mayor.
        expect(ev.some(e => e.question === 2)).toBe(false);
    });

    it('la entrada del léxico entra con su palabra', () => {
        const completa = { ...tuggy, verseHits: [], selected: [{ start: 584, end: 585 }] };
        expect(evidenceFromReview(revisar([completa]))).toEqual([
            { question: 1, sourceId: 'tuggy', via: 'lemma', term: 'μέλεσιν', sheets: [584, 585], snippets: [] },
        ]);
    });

    it('sin revisión, nada', () => {
        expect(evidenceFromReview(null)).toEqual([]);
    });
});

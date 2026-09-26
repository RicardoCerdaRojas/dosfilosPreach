import { describe, it, expect } from 'vitest';
import type { AnalyzeVerseInput } from '@dosfilos/domain';
import { buildAnalyzerPrompt } from '../analyzerPrompts';

/**
 * El plan de corpus decide, fuente por fuente, cuál ancla el paso, cuál aporta
 * contraste y cuál entra como técnica. Lo persistía y sólo lo leía la interfaz
 * para pintar insignias, mientras al analizador se le pedía clasificar a cada
 * comentarista en esos MISMOS tres roles desde cero.
 *
 * Medido en producción: 79 pasos con roles asignados, 168 asignaciones —79
 * anclas, 56 contrastes, 33 técnicas—, y 108 de 108 pasos con una nota escrita
 * que decía por qué. Nada de eso llegaba a la generación.
 */
const REF = { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 1, verseEnd: 1 } as const;

const entrada = (over: Partial<AnalyzeVerseInput>): AnalyzeVerseInput => ({
    paperPassage: { ...REF, verseEnd: 13 },
    verseRef: REF,
    language: 'es',
    originalLanguageText: null,
    pericopeContext: null,
    assignmentBrief: null,
    stepEmphasis: null,
    styleGuideContent: '',
    sources: [],
    priorAcceptedAnalyses: [],
    regenerationHint: null,
    missingSourceTypes: [],
    ...over,
} as unknown as AnalyzeVerseInput);

const fuente = (over: Record<string, unknown>) => ({
    corpusId: 'c1', sourceType: 'commentary-critical', displayLabel: 'The Epistle of St. James',
    citationKey: 'Mayor', textContent: 'texto', priority: 'primary', ...over,
});

describe('el rol que decidió el plan llega al analizador', () => {
    /** La ficha de cada fuente y la guía de campos van en el mensaje. */
    const fichaDe = (sources: unknown[]) =>
        buildAnalyzerPrompt(entrada({ sources: sources as never })).userMessage;

    it('la ficha de la fuente dice qué rol le asignó el plan', () => {
        const ficha = fichaDe([fuente({ plannedRole: 'anchor' })]);
        expect(ficha).toContain('rol asignado por el plan: **ancla**');
    });

    it('cada rol sale con el nombre que el autor lee en pantalla', () => {
        expect(fichaDe([fuente({ plannedRole: 'contrast' })])).toContain('**contraste**');
        expect(fichaDe([fuente({ plannedRole: 'technical' })])).toContain('**técnica**');
    });

    it('una fuente sin rol asignado no lo lleva en su ficha', () => {
        // Ahí el analizador sí decide, que es lo que hacía siempre. La frase
        // sigue estando en la guía de campos, que es otra cosa.
        const ficha = fichaDe([fuente({})]);
        expect(ficha).not.toContain('rol asignado por el plan: **');
    });

    it('la guía de campos manda COPIAR el rol asignado, no volver a decidirlo', () => {
        expect(buildAnalyzerPrompt(entrada({})).userMessage).toContain('COPIÁ ese rol');
    });

    it('en inglés también', () => {
        expect(buildAnalyzerPrompt(entrada({ language: 'en' })).userMessage).toContain('COPY that role');
    });
});

describe('la nota del plan llega como contexto, no como tesis', () => {
    const NOTA = 'Ancla: Mayor ofrece una perspectiva sintética y crítica del argumento.';

    it('la nota aparece en el prompt', () => {
        const { userMessage, systemInstruction } = buildAnalyzerPrompt(entrada({ planNote: NOTA }));
        expect(`${systemInstruction}\n${userMessage}`).toContain(NOTA);
    });

    it('y aparece rotulada para que no se lea como una tesis a defender', () => {
        // Sin el rótulo, «Mayor ofrece la perspectiva correcta» se lee como
        // una conclusión ya tomada sobre el contenido.
        const { userMessage, systemInstruction } = buildAnalyzerPrompt(entrada({ planNote: NOTA }));
        expect(`${systemInstruction}\n${userMessage}`).toContain('NO una tesis a defender');
    });

    it('sin nota no se agrega un bloque vacío', () => {
        const sin = buildAnalyzerPrompt(entrada({ planNote: null }));
        const vacia = buildAnalyzerPrompt(entrada({ planNote: '   ' }));
        expect(sin.systemInstruction).toBe(vacia.systemInstruction);
        expect(sin.systemInstruction).not.toContain('Por qué este corpus');
    });
});

/**
 * Santiago 2:2–3 tiene CINCO subjuntivos —εἰσέλθῃ dos veces, ἐπιβλέψητε,
 * εἴπητε dos veces— y el análisis del trabajo enumeró cuatro. No fue una
 * invención: se verificó que las 983 formas que enumeran los 115 análisis de
 * producción están todas en su propio versículo. El defecto es de recuento, y
 * un recuento no se arregla pidiendo más cuidado sino entregando la cuenta.
 */
const verbo = (text: string, tag: Record<string, string>) =>
    ({ text, lemma: text, pos: 'V', tag, transliteration: '' });

const MORFOLOGIA = {
    reference: { chapter: 2, verse: 2 },
    text: '',
    tokens: [
        verbo('εἰσέλθῃ', { tense: 'A', voice: 'A', mood: 'S', person: '3', number: 'S' }),
        verbo('εἰσέλθῃ', { tense: 'A', voice: 'A', mood: 'S', person: '3', number: 'S' }),
        verbo('ἐπιβλέψητε', { tense: 'A', voice: 'A', mood: 'S', person: '2', number: 'P' }),
        verbo('εἴπητε', { tense: 'A', voice: 'A', mood: 'S', person: '2', number: 'P' }),
        verbo('εἴπητε', { tense: 'A', voice: 'A', mood: 'S', person: '2', number: 'P' }),
    ],
};

describe('la morfología tabulada llega al analizador', () => {
    const prompt = (over: Record<string, unknown> = {}) =>
        buildAnalyzerPrompt(entrada({ verseMorphology: MORFOLOGIA, ...over } as never));

    it('el recuento de subjuntivos viaja en el prompt', () => {
        const { systemInstruction } = prompt();
        expect(systemInstruction).toContain('5 subjuntivos');
    });

    it('cada forma va con su parsing, para que no haya que deducirlo', () => {
        expect(prompt().systemInstruction).toContain('ἐπιβλέψητε');
        expect(prompt().systemInstruction).toContain('aoristo activa subjuntivo');
    });

    it('va junto al texto base y no en la guía de campos', () => {
        // Es parte de lo que el analizador LEE, no de lo que produce.
        const { systemInstruction, userMessage } = prompt();
        expect(systemInstruction).toContain('Morfología de este versículo');
        expect(userMessage).not.toContain('Morfología de este versículo');
    });

    it('sin morfología el prompt queda como estaba', () => {
        // El hebreo y los libros fuera de MorphGNT pasan por acá sin bloque.
        const sin = buildAnalyzerPrompt(entrada({ verseMorphology: null } as never));
        expect(sin.systemInstruction).not.toContain('Morfología de este versículo');
    });
});

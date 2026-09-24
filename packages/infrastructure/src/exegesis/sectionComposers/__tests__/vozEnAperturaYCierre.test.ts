import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';
import type { ComposeConclusionInput, ComposeIntroductionInput, PassageReference } from '@dosfilos/domain';
import { buildIntroductionPrompt } from '../GeminiIntroductionComposer';
import { buildConclusionPrompt } from '../GeminiConclusionComposer';

/**
 * La voz del autor llegaba al compositor de VERSÍCULOS y a ninguno de los
 * otros dos. Medido antes de este cambio: cero menciones de voz en
 * `GeminiIntroductionComposer`, `GeminiConclusionComposer` y sus dos casos de
 * uso. El cuerpo del trabajo salía con el registro del autor y las dos partes
 * que un profesor lee con más atención —cómo abre y cómo cierra— salían con
 * el del modelo.
 */
const PASSAGE: PassageReference = { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 1, verseEnd: 13 };

const MUESTRA = 'Se adopta la aposición, y de ahí que el título no sea ornamental sino la premisa del argumento.';

function base(voiceSamples?: ReadonlyArray<{ excerpt: string; position: number }>, wordBudget?: number | null) {
    return {
        paperPassage: PASSAGE,
        language: 'es' as const,
        assignmentBrief: 'encuadre',
        verseAnalyses: [buildEmptyCanonicalVerseAnalysis({ ...PASSAGE, verseStart: 1, verseEnd: 1 })],
        styleGuideContent: '',
        styleGuideManifest: null,
        sources: [],
        pinnedSourceKeys: [],
        paperRubric: null,
        exegeticalStrategy: null,
        regenerationHint: null,
        voiceSamples,
        wordBudget,
    };
}

const construir = {
    introducción: (v?: ReadonlyArray<{ excerpt: string; position: number }>, w?: number | null) => buildIntroductionPrompt(
        { ...base(v, w), acceptedConclusionMarkdown: null } as unknown as ComposeIntroductionInput),
    conclusión: (v?: ReadonlyArray<{ excerpt: string; position: number }>, w?: number | null) => buildConclusionPrompt(
        base(v, w) as unknown as ComposeConclusionInput),
};

describe.each(Object.entries(construir))('%s — la voz del autor', (_nombre, build) => {
    it('las muestras del autor llegan a la instrucción del modelo', () => {
        const { systemInstruction } = build([{ excerpt: MUESTRA, position: 0 }]);
        expect(systemInstruction).toContain(MUESTRA);
    });

    it('sin perfil de voz la instrucción no cambia: componer sin registro es molesto, no componer es peor', () => {
        expect(build([]).systemInstruction).toBe(build(undefined).systemInstruction);
    });

    it('la voz va en la instrucción de sistema y no mezclada con los briefings', () => {
        // Es una regla de REGISTRO, no material del pasaje. En el mensaje de
        // usuario competiría con el contenido que el modelo debe analizar.
        const { userMessage } = build([{ excerpt: MUESTRA, position: 0 }]);
        expect(userMessage).not.toContain(MUESTRA);
    });
});

import { buildComposerPrompt } from '../../composer/composerPrompts';
import type { ComposeAcademicPaperInput } from '@dosfilos/domain';

/**
 * El tercer camino: componer el trabajo ENTERO de una vez, que es lo que hace
 * el diálogo de composición académica. Tenía el mismo hueco, y ahí no salía
 * sin voz sólo la apertura y el cierre: salía sin voz el documento completo.
 */
describe('trabajo completo — la voz del autor', () => {
    const entrada = (voiceSamples?: ReadonlyArray<{ excerpt: string; position: number }>) => ({
        paperPassage: PASSAGE,
        language: 'es' as const,
        verseAnalyses: [buildEmptyCanonicalVerseAnalysis({ ...PASSAGE, verseStart: 1, verseEnd: 1 })],
        sources: [],
        pinnedSourceKeys: [],
        voiceSamples,
    } as unknown as ComposeAcademicPaperInput);

    it('las muestras llegan a la instrucción del modelo', () => {
        expect(buildComposerPrompt(entrada([{ excerpt: MUESTRA, position: 0 }])).systemInstruction)
            .toContain(MUESTRA);
    });

    it('sin perfil de voz la instrucción no cambia', () => {
        expect(buildComposerPrompt(entrada([]).valueOf() as ComposeAcademicPaperInput).systemInstruction)
            .toBe(buildComposerPrompt(entrada(undefined)).systemInstruction);
    });
});

/**
 * El presupuesto de extensión, que existía en dominio y no salía de la
 * pantalla. Un trabajo que pedía 2-3 páginas salió de 16.
 */
describe.each(Object.entries(construir))('%s — el presupuesto de extensión', (_nombre, build) => {
    const conPresupuesto = (wordBudget: number | null) =>
        build(undefined, wordBudget).systemInstruction;

    it('el número llega a la instrucción del modelo', () => {
        expect(conPresupuesto(400)).toContain('400 palabras');
    });

    it('sin extensión declarada no se inventa un objetivo', () => {
        expect(conPresupuesto(null)).not.toContain('palabras para esta sección');
    });

    it('dice que se recorte amplitud y no rigor', () => {
        // La instrucción tiene que decir POR DÓNDE cortar. «Escribí menos» sin
        // eso invita a citar menos, que es exactamente lo que no se quiere.
        expect(conPresupuesto(400)).toContain('nunca rigor');
    });
});

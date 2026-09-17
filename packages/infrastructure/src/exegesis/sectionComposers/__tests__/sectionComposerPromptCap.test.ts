import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';
import type { ComposeConclusionInput, ComposeIntroductionInput, PassageReference } from '@dosfilos/domain';
import { buildIntroductionPrompt } from '../GeminiIntroductionComposer';
import { buildConclusionPrompt } from '../GeminiConclusionComposer';
import { MAX_PROMPT_CHARS } from '../../../llm/promptBudget';

/**
 * La introducción y la conclusión daban a CADA fuente asignada hasta 80.000
 * caracteres, sin mirar el tope del servidor. Con dos fuentes asignadas a la
 * introducción (Ross y Craigie, Sal 23:1–3, 2026-09-16) el mensaje pasó de
 * 200.000 y el paso falló con «prompt excede 200000 caracteres». El compositor
 * del paper completo ya estaba arreglado (`composerPromptCap.test.ts`); estos
 * dos eran la misma regla copiada sin el arreglo.
 */
const PASSAGE: PassageReference = { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 1, verseEnd: 3 };

const analysisFor = (verse: number) => ({
    ...buildEmptyCanonicalVerseAnalysis({ ...PASSAGE, verseStart: verse, verseEnd: verse }),
    argumentativeRole: 'r'.repeat(15_000),
});

// Texto con muchas líneas: la sangría del bloque suma dos caracteres por línea.
const libro = (chars: number) => ('línea de comentario\n').repeat(Math.ceil(chars / 20)).slice(0, chars);

function base(pinned: number, contentChars: number) {
    return {
        paperPassage: PASSAGE,
        language: 'es' as const,
        assignmentBrief: 'e'.repeat(1_800),
        verseAnalyses: [1, 2, 3].map(analysisFor),
        styleGuideContent: 'g'.repeat(15_000),
        styleGuideManifest: null,
        sources: Array.from({ length: pinned }, (_, i) => ({
            citationKey: `Fuente${i}`,
            author: `Autor${i}`,
            title: `Obra ${i}`,
            isPinned: true,
            textContent: libro(contentChars),
        })),
        pinnedSourceKeys: Array.from({ length: pinned }, (_, i) => `Fuente${i}`),
        paperRubric: null,
        exegeticalStrategy: null,
        regenerationHint: 'HINT-DEL-USUARIO',
    };
}

const introduccion = (pinned: number, chars: number) =>
    buildIntroductionPrompt({ ...base(pinned, chars), acceptedConclusionMarkdown: '## Conclusión\n\ntexto' } as unknown as ComposeIntroductionInput);
const conclusion = (pinned: number, chars: number) =>
    buildConclusionPrompt(base(pinned, chars) as unknown as ComposeConclusionInput);

describe.each([
    ['introducción', introduccion, 'Ahora producí la introducción'],
    ['conclusión', conclusion, 'Ahora producí la conclusión'],
] as const)('%s — tope del servidor', (_nombre, build, instruccionFinal) => {
    it('no pasa el tope con dos fuentes asignadas que traen libros enteros (el caso real)', () => {
        const { userMessage } = build(2, 900_000);
        expect(userMessage.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    });

    it('recorta las fuentes, no el final: la instrucción y el hint del usuario siguen ahí', () => {
        // Si el bloque se pasara de su presupuesto, la red de seguridad corta
        // el mensaje por el final y se pierde justo la instrucción de salida.
        const { userMessage } = build(3, 900_000);
        expect(userMessage).toContain(instruccionFinal);
        expect(userMessage).toContain('HINT-DEL-USUARIO');
    });

    it('conserva los análisis de los tres versos', () => {
        const { userMessage } = build(2, 900_000);
        for (const v of [1, 2, 3]) expect(userMessage).toContain(`Salmos 23:${v}`);
    });

    it('reparte el presupuesto: cada fuente asignada aparece con contenido', () => {
        const { userMessage } = build(2, 900_000);
        expect(userMessage).toContain('Fuente0');
        expect(userMessage).toContain('Fuente1');
        expect(userMessage.split('línea de comentario').length - 1).toBeGreaterThan(1_000);
    });

    it('deja pasar el contenido completo cuando cabe', () => {
        const { userMessage } = build(1, 2_000);
        expect(userMessage).not.toContain('content truncated');
    });
});

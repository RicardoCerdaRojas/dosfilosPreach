import {
    buildGreekInsightPrompt,
    parseGreekInsight,
    type GreekVerseInsight,
    type GreekWordToken,
} from '@dosfilos/domain';
import { runLlmPrompt } from '../llm/callableLlm';
import { LONG_GENERATION_TIMEOUT_MS } from '../llm/llmTimeouts';

/**
 * El aporte del modelo al analizador griego: rango semántico, función
 * sintáctica y traducciones. LA MORFOLOGÍA NO SE LE PIDE — viaja resuelta en
 * el prompt (MorphGNT) y el parser descarta cualquier respuesta desalineada
 * con los tokens: mejor sin análisis que con el análisis corrido.
 */
export class GreekInsightService {
    async analyzeVerse(input: {
        reference: string;
        tokens: readonly GreekWordToken[];
        /** Contexto para detectar la anáfora del artículo. */
        previousVerse?: { reference: string; text: string };
    }): Promise<GreekVerseInsight> {
        const raw = await runLlmPrompt({
            feature: 'greekTutor.analyzeVerse',
            prompt: buildGreekInsightPrompt(input),
            responseMimeType: 'application/json',
            // Baja: el rango semántico es dato de léxico, no creatividad.
            temperature: 0.2,
            // Un versículo largo (30+ palabras con rango y función cada una)
            // necesita espacio; 16k cubre el peor caso del NT con margen.
            maxOutputTokens: 16384,
        }, { timeoutMs: LONG_GENERATION_TIMEOUT_MS });
        const parsed = parseGreekInsight(raw ?? '', {
            reference: input.reference,
            expectedWordCount: input.tokens.length,
            cases: input.tokens.map((t) => t.tag.case),
        });
        if (!parsed) {
            throw new Error('greek-insight: respuesta del modelo inválida o desalineada');
        }
        return parsed;
    }
}

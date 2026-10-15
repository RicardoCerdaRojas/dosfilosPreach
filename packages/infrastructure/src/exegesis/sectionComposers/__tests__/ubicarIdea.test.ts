import { describe, it, expect } from 'vitest';
import { buildIdeaPlacementPrompt, parseIdeaPlacement } from '../ideaPlacementPrompt';

/** «Agregar una idea» (TP #6, #22): el asistente redacta la idea y dice dónde va. */
describe('GeminiIdeaPlacer — prompt y respuesta', () => {
    it('numera los párrafos, conserva la cita del estudiante y no reescribe la sección', () => {
        const { systemInstruction, userMessage } = buildIdeaPlacementPrompt({
            paragraphs: ['Primero.', 'Segundo.'], idea: 'Mayor lo confirma (Mayor, 14)', language: 'es',
        });
        expect(userMessage).toContain('[0] Primero.');
        expect(userMessage).toContain('[1] Segundo.');
        expect(userMessage).toContain('Mayor lo confirma (Mayor, 14)');
        expect(systemInstruction).toContain('NO reescribes la sección');
        expect(systemInstruction).toContain('TAL CUAL');
        expect(systemInstruction).toContain('Tercera persona impersonal');
    });

    it('lee la respuesta, con o sin cerco de código; sin oración, falla', () => {
        expect(parseIdeaPlacement('```json\n{"paragraphIndex":1,"afterSentence":"","sentence":" X (Mayor, 14). "}\n```'))
            .toEqual({ paragraphIndex: 1, afterSentence: '', sentence: 'X (Mayor, 14).', alreadyStated: '' });
        expect(() => parseIdeaPlacement('{"paragraphIndex":0,"afterSentence":"","sentence":""}')).toThrow();
    });
});

describe('la pregunta de cada párrafo y lo ya dicho', () => {
    it('el párrafo lleva su encabezado y el prompt pide avisar lo repetido', () => {
        const { systemInstruction, userMessage } = buildIdeaPlacementPrompt({
            paragraphs: ['Uno.'], headings: ['¿Cuál es el sujeto del versículo 15?'], idea: 'x', language: 'es',
        });
        expect(userMessage).toContain('[0] (bajo «¿Cuál es el sujeto del versículo 15?») Uno.');
        expect(systemInstruction).toContain('alreadyStated');
    });
    it('lee «alreadyStated»', () => {
        expect(parseIdeaPlacement('{"paragraphIndex":0,"afterSentence":"","sentence":"S.","alreadyStated":" Ya dicho. "}').alreadyStated).toBe('Ya dicho.');
    });
});

import { describe, it, expect } from 'vitest';
import type { ComposeVerseInput } from '@dosfilos/domain';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';
import { buildVerseProsePrompt } from '../verseProsePrompt';

const REF = { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 9, verseEnd: 9 };
const VACIO = buildEmptyCanonicalVerseAnalysis(REF);

/**
 * Recomponer y regenerar SIN indicación del autor.
 *
 * Los dos diálogos exigían escribir algo —uno diez caracteres, el otro
 * cualquier cosa— y su motivo era cierto cuando se escribieron: sin decirle
 * qué falta, el compositor devolvía lo mismo. Dejó de serlo. Hoy el prompt
 * lleva tres encargos que NO vienen del autor: la extensión que reparte la
 * rúbrica, la forma de cita que pide el encuadre y la pregunta que esta
 * sección responde. Después de cambiar cualquiera de las tres, «otra vez, sin
 * más» es exactamente lo que hay que poder pedir.
 *
 * Los diálogos ahora lo dicen en pantalla. Estas pruebas son lo que hace que
 * esa promesa siga siendo verdad: si alguien vuelve a colgar los tres encargos
 * de que haya indicación, caen acá.
 */
const entrada = (over: Partial<ComposeVerseInput>) => ({
    paperPassage: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 1, verseEnd: 13 },
    language: 'es' as const,
    verseAnalysis: {
        ...VACIO, reference: REF,
        syntacticAnalysis: { keyConstructions: [], discourseParticles: [] },
        lexicalAnalyses: [], commentatorEngagement: [], translationCruxes: [],
        historicalContext: [], oldTestamentLinks: [], footnoteExtensions: [],
        confidenceFlags: [], theologicalHooks: [],
    },
    glossary: [], assignmentBrief: null, sources: [], styleGuideContent: '',
    ...over,
} as unknown as ComposeVerseInput);

describe('componer sin indicación del autor', () => {
    it('la extensión que reparte la rúbrica llega igual', () => {
        const { systemInstruction } = buildVerseProsePrompt(entrada({ wordBudget: 250 }));
        expect(systemInstruction).toContain('250');
        expect(systemInstruction).toContain('Extensión');
    });

    it('la forma de cita de la entrega llega igual', () => {
        const parentetica = buildVerseProsePrompt(entrada({ citationForm: 'parenthetical' })).systemInstruction;
        expect(parentetica).toContain('(Apellido, p. N)');
        const nota = buildVerseProsePrompt(entrada({ citationForm: 'footnote' })).systemInstruction;
        expect(nota).toContain('(Apellido, "Título", p. N)');
    });

    it('la pregunta que responde esta sección llega igual', () => {
        const { systemInstruction } = buildVerseProsePrompt(entrada({
            sectionQuestions: [{ number: 4, text: '¿Qué función cumple ἐλεγχόμενοι?' }],
        }));
        expect(systemInstruction).toContain('ἐλεγχόμενοι');
        expect(systemInstruction).toContain('4.');
    });

    it('los tres viajan juntos en la misma pasada, sin guía ni objetivo', () => {
        const { systemInstruction, userMessage } = buildVerseProsePrompt(entrada({
            wordBudget: 250,
            citationForm: 'parenthetical',
            sectionQuestions: [{ number: 4, text: '¿Qué función cumple ἐλεγχόμενοι?' }],
        }));
        expect(systemInstruction).toContain('250');
        expect(systemInstruction).toContain('(Apellido, p. N)');
        expect(systemInstruction).toContain('ἐλεγχόμενοι');
        // Sin indicación no se inventa un bloque de correcciones vacío.
        expect(userMessage).not.toContain('QUÉ CORREGIR EN ESTA PASADA');
    });
});

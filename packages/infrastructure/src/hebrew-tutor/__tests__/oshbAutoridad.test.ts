import { describe, it, expect } from 'vitest';
import { buildVerseAnalysisPrompt } from '../knowledge/hebrew-prompt-builder';
import { selectRelevantChunks } from '../knowledge/knowledge-selector';

/** Bitácora del módulo de hebreo #1 y #3 (Rut 1:13, 1:16). */
const verse = {
    reference: 'Ruth.1.16', displayReference: 'Rut 1:16', hebrewText: 'אַל־תִּפְגְּעִי־בִי',
    words: [{ text: 'אַל', lemma: '408', oshbMorphCode: 'HTn' }, { text: 'תִּפְגְּעִי', lemma: '6293', oshbMorphCode: 'HVqj2fs' }],
};

describe('el prompt del tutor de hebreo', () => {
    it('REGRESIÓN: OSHB es autoridad para la morfología del verbo, con la lectura del código', () => {
        const prompt = buildVerseAnalysisPrompt(verse as never, selectRelevantChunks(verse.hebrewText));
        const texto = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
        expect(texto).toContain('MORFOLOGÍA DE OSHB — AUTORIDAD para el verbo');
        expect(texto).not.toContain('NO es autoridad');
        expect(texto).toContain('HVqj2fs');
        expect(texto).toMatch(/j yusivo/);
    });

    it('REGRESIÓN: siempre lleva la regla de אַל + prefijo = yusivo', () => {
        const ids = selectRelevantChunks('וַיֹּאמֶר').map(c => c.id);
        expect(ids).toContain('farfan-volitivos');
        const chunk = selectRelevantChunks('x').find(c => c.id === 'farfan-volitivos')!;
        expect(chunk.content).toMatch(/אַל \+ forma de prefijo = YUSIVO/);
    });
});

/** Bitácora del módulo de hebreo #2 (Rut 1:14) y #4 (Rut 1:16). */
describe('el prompt pide las cláusulas con su conexión', () => {
    it('REGRESIÓN: esquema, reglas de waw disyuntiva y asíndeton, y el fragmento de Farfán siempre', () => {
        const texto = buildVerseAnalysisPrompt(verse as never, selectRelevantChunks(verse.hebrewText));
        expect(texto).toContain('"clauses": [');
        expect(texto).toMatch(/וְ \+ NO VERBO .*→ WAW_DISJUNCTIVE/);
        expect(texto).toMatch(/Sin conjunción → ASYNDETIC/);
        expect(texto).toMatch(/clauses MUST cover the whole verse/);
        expect(selectRelevantChunks('x').map(c => c.id)).toContain('farfan-clausulas-conexion');
    });
});

/** G1 + G5 (opción «b» del fundador): con estructura, el asistente LEE las cláusulas de MACULA. */
describe('el prompt con las filas de «Estructura»', () => {
    const fila = {
        index: 3, depth: 0, words: [{ r: '16!1', t: 'אַל', role: 'adv' as const }, { r: '16!2', t: 'תִּפְגְּעִי', role: 'v' as const }],
        connector: null, relation: 'speech' as const, isApodosis: false, verbless: false, fronted: [],
    };

    it('pide "clauseReadings" de las filas numeradas y NO pide partir el versículo en "clauses"', () => {
        const texto = buildVerseAnalysisPrompt(verse as never, selectRelevantChunks(verse.hebrewText), [], 'es', [fila]);
        expect(texto).toContain('LA ESTRUCTURA YA ESTÁ DECIDIDA');
        expect(texto).toContain('1. [nivel 0] אַל תִּפְגְּעִי — relación: discurso directo');
        expect(texto).toContain('"clauseReadings": [');
        expect(texto).not.toContain('"clauses": [');
        expect(texto).not.toMatch(/clauses MUST cover the whole verse/);
        // Las pautas de la waw siguen para la traducción.
        expect(texto).toMatch(/waw disyuntiva de contraste →\s+«pero»/);
        // Rut 1:14 (prueba del fundador): una nota decía «waw conjuntiva» donde la fila es disyuntiva.
        expect(texto).toMatch(/"exegeticalNotes" y la función de cada palabra usan los MISMOS nombres/);
    });

    it('con quién habla (Rut 1:16), el prompt lo da como hecho decidido', () => {
        const texto = buildVerseAnalysisPrompt(verse as never, selectRelevantChunks(verse.hebrewText), [], 'es', [], [{ ordinal: 1, text: 'תִּפְגְּעִי', kind: 'verb', speaker: 'רוּת', speakerOrdinals: [0] }]);
        expect(texto).toContain('## QUIÉN HABLA');
        expect(texto).toMatch(/תִּפְגְּעִי: verbo en 2\.ª persona dentro del discurso de רוּת/);
        expect(buildVerseAnalysisPrompt(verse as never, selectRelevantChunks(verse.hebrewText))).not.toContain('## QUIÉN HABLA');
    });

    it('R4: con infinitivos, el prompt trae su sección y el campo "infinitiveFunction" en el esquema', () => {
        const inf = [{ ordinal: 3, text: 'בֹּאֲךָ', form: 'construct' as const, rule: 'adInf' as const, allowed: ['temporalUntil'] as const, status: 'medida' as const }];
        const texto = buildVerseAnalysisPrompt(verse as never, selectRelevantChunks(verse.hebrewText), [], 'es', [], [], inf as never);
        expect(texto).toContain('## INFINITIVOS: SU FUNCIÓN');
        expect(texto).toContain('"infinitiveFunction"');
        expect(buildVerseAnalysisPrompt(verse as never, selectRelevantChunks(verse.hebrewText))).not.toContain('## INFINITIVOS');
    });
});

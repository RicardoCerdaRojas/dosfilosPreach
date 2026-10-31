import { describe, expect, it } from 'vitest';
import { buildHeadingsPrompt, parseHeadings } from '../headingsPrompt';
import { deserializeSectionTitles } from '../../../firebase/FirestoreExegeticalPaperRepository';

describe('títulos temáticos — el mensaje y la respuesta (etapa 3.4)', () => {
    it('pide un título por clave, temático y con la referencia; no copiar la traducción ni el título del salmo', () => {
        const { system, user } = buildHeadingsPrompt({ passageLabel: 'Salmo 23:1–3', language: 'es', briefings: '…', thesis: 'La tesis.', verses: [{ key: 'v1', label: 'Salmo 23:1' }] });
        expect(system).toContain('«(v. N)»');
        expect(system).toContain('NO copies la traducción');
        expect(system).toContain('«Salmo de David»');
        expect(user).toContain('## Tesis aprobada\nLa tesis.');
        expect(user).toContain('- v1: Salmo 23:1');
    });
    it('solo las claves pedidas, sin vacíos ni repetidos', () => {
        const t = parseHeadings(JSON.stringify({ headings: [{ key: 'v1', title: ' A (v. 1) ' }, { key: 'v1', title: 'otra' }, { key: 'zz', title: 'B' }, { key: 'v2', title: '' }] }), ['v1', 'v2']);
        expect(t).toEqual({ v1: 'A (v. 1)' });
    });
    it('Firestore: solo textos no vacíos', () => {
        expect(deserializeSectionTitles({ v1: ' A ', v2: '', v3: 3 })).toEqual({ v1: 'A' });
        expect(deserializeSectionTitles(undefined)).toBeNull();
    });
});

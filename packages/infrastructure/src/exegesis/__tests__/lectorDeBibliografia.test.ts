import { describe, it, expect } from 'vitest';
import { buildBibliographyPrompt, parseBibliographyJson } from '../GeminiCourseBibliographyExtractor';

/** Estado del arte: el lector de bibliografías de un sílabo (caso real: NT785, Santiago). */
describe('el lector de bibliografías', () => {
    it('el prompt pide copiar sin recomendar, y cubre las convenciones de un sílabo real', () => {
        const { system, prompt } = buildBibliographyPrompt({ text: 'Davids, Peter H. La epístola de Santiago…', language: 'es' });
        expect(system).toContain('no recomiendes obras');
        expect(prompt).toContain('«———.» o «---.» repite el autor');
        expect(prompt).toContain('lectura obligatoria');
        expect(prompt).toContain('"prohibitions"');
        expect(prompt).toContain('journal-article');
        expect(prompt).not.toContain('style-template-paper');
        expect(buildBibliographyPrompt({ text: '', image: { mimeType: 'image/png', base64: 'x' }, language: 'es' }).prompt).toContain('El documento es la imagen adjunta.');
    });

    it('lee el JSON defensivamente: con bloque de código, tipos válidos, sin títulos vacíos', () => {
        const raw = '```json\n' + JSON.stringify({
            entries: [
                { title: 'La epístola de Santiago: Un comentario sobre el texto griego', author: 'Davids, Peter H.', series: 'El nuevo comentario internacional al testamento griego', year: 2015, publisher: 'Fundación Hurtado', requirement: 'required', sourceType: 'commentary-critical', note: 'Lectura semanal' },
                { title: 'Does Scripture Speak in Vain? A Reconsideration of James IV. 5', author: 'Laws, Sophie', series: 'New Testament Studies 20', year: 1973, requirement: 'otra cosa', sourceType: 'revista' },
                { title: '   ', requirement: 'required' },
                { author: 'sin título' },
            ],
            requirements: 'Mínimo 100 páginas de artículos académicos sobre Santiago.',
            prohibitions: 'No usar la misma fuente dos semanas consecutivas.',
        }) + '\n```';
        const r = parseBibliographyJson(raw);
        expect(r.entries).toHaveLength(2);
        expect(r.entries[0]).toMatchObject({ author: 'Davids, Peter H.', requirement: 'required', sourceType: 'commentary-critical', year: 2015 });
        expect(r.entries[1]).toMatchObject({ requirement: 'recommended', sourceType: null });
        expect(r.prohibitions).toContain('dos semanas consecutivas');
    });

    it('un JSON roto es un error claro', () => {
        expect(() => parseBibliographyJson('no es json')).toThrow(/invalid JSON/);
        // Cortada (lista muy larga): se marca para pedir importar por partes.
        try { parseBibliographyJson('{"entries":[{"title":"Moo"'); } catch (e) { expect((e as { code?: string }).code).toBe('truncated'); }
        try { parseBibliographyJson('no es json'); } catch (e) { expect((e as { code?: string }).code).toBeUndefined(); }
    });
});

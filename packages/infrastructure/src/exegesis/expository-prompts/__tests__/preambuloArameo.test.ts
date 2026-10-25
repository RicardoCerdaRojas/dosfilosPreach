import { describe, expect, it } from 'vitest';
import { buildSourcePreamble } from '../shared';

/**
 * El preámbulo de las pasadas expositivas decía «hebreo original (WLC)» para
 * todo el AT. Esdras y Daniel tienen secciones enteras en arameo.
 */
describe('buildSourcePreamble — el arameo de Esdras y Daniel', () => {
    const HOY_ES = '\nFuente del texto: hebreo original (WLC). Cita marcadores sintácticos directamente desde el texto provisto (waw-consecutivo, וַיְהִי, paralelismo, fórmulas tipo כֹּה אָמַר יְהוָה).\n';

    it('Esdras nombra sus dos secciones arameas', () => {
        const p = buildSourcePreamble('hebrew', 'es', 'Esdras');
        expect(p).toContain('Esdras 4:8–6:18 y 7:12–26 está en arameo bíblico');
        expect(p.startsWith(HOY_ES.slice(0, -1))).toBe(true);
    });

    it('avisa que el arameo no tiene waw-consecutivo y nombra sus marcadores, en los dos idiomas', () => {
        const es = buildSourcePreamble('hebrew', 'es', 'Esdras');
        expect(es).toContain('El arameo bíblico no tiene waw-consecutivo');
        for (const m of ['אֱדַיִן («entonces»)', 'כְּעַן («ahora»)', 'דִּי', 'fórmulas de las cartas']) expect(es).toContain(m);
        const en = buildSourcePreamble('hebrew', 'en', 'Daniel');
        expect(en).toContain('Biblical Aramaic has no waw-consecutive');
        for (const m of ['אֱדַיִן ("then")', 'כְּעַן ("now")', 'דִּי', 'letter formulas']) expect(en).toContain(m);
    });

    it('Daniel, en inglés y por id', () => {
        expect(buildSourcePreamble('hebrew', 'en', 'Daniel')).toContain('Daniel 2:4–7:28 is in Biblical Aramaic');
        expect(buildSourcePreamble('hebrew', 'es', 'DAN')).toContain('DAN 2:4–7:28');
    });

    it('otro libro del AT, o sin libro, queda BYTE A BYTE como antes', () => {
        expect(buildSourcePreamble('hebrew', 'es')).toBe(HOY_ES);
        expect(buildSourcePreamble('hebrew', 'es', 'Nehemías')).toBe(HOY_ES);
        // Gn 31:47 y Jer 10:11 son un versículo: no ameritan el aviso.
        expect(buildSourcePreamble('hebrew', 'es', 'Génesis')).toBe(HOY_ES);
    });

    it('con traducción como fuente no se agrega (el texto ya no es el original)', () => {
        expect(buildSourcePreamble('translation', 'es', 'Esdras')).not.toContain('arameo');
    });
});

describe('las pasadas del planificador pasan el libro al preámbulo', () => {
    it('el panorama de Esdras avisa del arameo; el de Nehemías no', async () => {
        const { buildPanoramaUserMessage } = await import('../panorama');
        const base = { displayLanguage: 'es' as const, sourceLanguage: 'hebrew' as const, verses: [{ chapter: 1, verse: 1, text: 'x' }] };
        expect(buildPanoramaUserMessage({ ...base, book: 'Esdras' } as never)).toContain('está en arameo bíblico');
        expect(buildPanoramaUserMessage({ ...base, book: 'Nehemías' } as never)).not.toContain('arameo');
    });
});

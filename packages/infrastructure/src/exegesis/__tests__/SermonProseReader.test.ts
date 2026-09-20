import { describe, expect, it } from 'vitest';
import { selectVoiceSamples } from '@dosfilos/domain';
import { candidatoDeSermon } from '../SermonProseReader';

/** Un sermón publicado, con la prosa larga que exige el selector. */
const sermon = (over: Record<string, unknown> = {}) => ({
    id: 's1',
    title: 'El pastor que restaura',
    content: Array.from({ length: 12 }, (_, i) =>
        `Párrafo ${i}: el salmo no describe una posesión cualquiera, sino una relación que gobierna todo lo que sigue. `
        + 'La metáfora pastoril era cotidiana para quien la escuchó por primera vez, y por eso conviene demorarse en ella.',
    ).join('\n\n'),
    publishedAt: new Date('2026-05-01'),
    authorshipSnapshot: { decisions: 12 },
    ...over,
});

describe('candidatoDeSermon', () => {
    it('un sermón armado en el taller califica: su autoría sobrevive en el snapshot', () => {
        // El defecto que esto fija: se leía `assembledFrom` del sermón
        // guardado, campo que sólo existe en el BORRADOR. Devolvía
        // `undefined` siempre y el filtro de dominio descartaba todos.
        expect(candidatoDeSermon(sermon()).assembledFrom).toBe('workshop');
    });

    it('un sermón sin snapshot no califica: la ausencia de dato no es evidencia', () => {
        expect(candidatoDeSermon(sermon({ authorshipSnapshot: undefined })).assembledFrom).toBeUndefined();
    });

    it('y el contrato de punta a punta: el del taller SÍ aporta muestras', () => {
        const delTaller = selectVoiceSamples([candidatoDeSermon(sermon()), candidatoDeSermon(sermon({ id: 's2' }))]);
        expect(delTaller.length).toBeGreaterThan(0);
    });

    it('los generados no aportan ninguna, que es la regla de la casa', () => {
        const generados = [
            candidatoDeSermon(sermon({ authorshipSnapshot: undefined })),
            candidatoDeSermon(sermon({ id: 's2', authorshipSnapshot: undefined })),
        ];
        expect(selectVoiceSamples(generados)).toEqual([]);
    });

    it('un sermón sin contenido no rompe el mapeo', () => {
        expect(candidatoDeSermon({ id: 's9' }).content).toBe('');
    });
});

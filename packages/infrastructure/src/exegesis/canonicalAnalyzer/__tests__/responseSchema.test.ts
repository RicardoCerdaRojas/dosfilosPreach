import { describe, it, expect } from 'vitest';
import { canonicalVerseAnalysisSchema } from '../responseSchema';
import { voiceFor } from '../../testamentVoice';

/**
 * El esquema tiene que decir lo mismo que el prompt.
 *
 * Sus descripciones estaban fijas en griego —«versículo del NT griego», «según
 * NA28/UBS5»— mientras el prompt del sistema ya cambiaba de testamento. En un
 * análisis de Jonás el modelo recibía dos instrucciones opuestas en la misma
 * llamada: hebreo con aparato BHS por un lado, griego con NA28 por el otro.
 *
 * En producción ganó el prompt —los análisis de Jonás no traen una sola
 * referencia a NA28— pero eso es suerte. Dos señales en conflicto se resuelven
 * por el modelo, su versión y el largo del prompt, no por diseño.
 */
const textoDe = (schema: unknown): string => JSON.stringify(schema);

describe('esquema del análisis — habla el idioma del texto', () => {
    it('un verso del AT no pide el texto en griego ni el aparato del NT', () => {
        const s = textoDe(canonicalVerseAnalysisSchema(voiceFor('JON')));
        expect(s).not.toMatch(/NA28|UBS5/);
        expect(s).not.toMatch(/Texto griego del versículo/);
    });

    it('un verso del AT nombra el hebreo y su aparato', () => {
        const s = textoDe(canonicalVerseAnalysisSchema(voiceFor('JON')));
        expect(s).toMatch(/hebre/i);
        expect(s).toMatch(/BHS|BHQ/);
    });

    it('un verso del NT sigue pidiendo griego y su aparato', () => {
        const s = textoDe(canonicalVerseAnalysisSchema(voiceFor('JAS')));
        expect(s).toMatch(/griego|griega/);
        expect(s).toMatch(/NA28/);
        expect(s).not.toMatch(/BHS|BHQ|HALOT/);
    });

    it('la forma no cambia con el testamento: sólo cambia lo que dice', () => {
        // Si los campos requeridos difirieran, el parser fallaría en un
        // testamento y no en el otro — y ese fallo aparecería recién con un
        // trabajo real del AT en marcha.
        const at = canonicalVerseAnalysisSchema(voiceFor('JON'));
        const nt = canonicalVerseAnalysisSchema(voiceFor('JAS'));
        expect(Object.keys(at.properties)).toEqual(Object.keys(nt.properties));
        expect(at.required).toEqual(nt.required);
    });

    it('un libro fuera del canon cae en el NT, igual que el prompt', () => {
        // `voiceFor` ya decide así; lo que se fija acá es que el esquema no
        // invente una tercera respuesta para el mismo caso.
        expect(textoDe(canonicalVerseAnalysisSchema(voiceFor('XYZ')))).toMatch(/NA28/);
    });
});

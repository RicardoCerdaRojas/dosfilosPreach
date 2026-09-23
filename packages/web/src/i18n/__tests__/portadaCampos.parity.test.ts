import { describe, expect, it } from 'vitest';
import { PAPER_COVER_FIELDS } from '@dosfilos/domain';
import es from '../locales/es/exegesis.json';
import en from '../locales/en/exegesis.json';

/**
 * PARIDAD entre los campos de la portada y sus textos.
 *
 * El formulario recorre `PAPER_COVER_FIELDS` y pide la etiqueta por
 * clave. Si falta la clave, i18next no falla: pinta la clave cruda y el
 * usuario lee «paperSetup.cover.fields.advisor» como nombre del campo.
 * El control de textos hardcodeados no lo ve, porque busca texto suelto
 * y no claves ausentes.
 *
 * Mismo patrón que la paridad de los encabezados del sermón.
 */
describe('los campos de la portada tienen etiqueta y ejemplo en los dos idiomas', () => {
    const esperados = [...PAPER_COVER_FIELDS].sort();

    for (const [idioma, json] of Object.entries({ es, en })) {
        it(`${idioma}: una etiqueta por campo, ni más ni menos`, () => {
            expect(Object.keys((json as typeof es).paperSetup.cover.fields).sort())
                .toEqual(esperados);
        });

        it(`${idioma}: un texto de ejemplo por campo`, () => {
            expect(Object.keys((json as typeof es).paperSetup.cover.placeholders).sort())
                .toEqual(esperados);
        });
    }
});

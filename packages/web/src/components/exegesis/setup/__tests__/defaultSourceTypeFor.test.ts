import { describe, it, expect } from 'vitest';
import type { LibraryResource, ResourceType } from '@dosfilos/domain';
import {
    defaultSourceTypeFor,
    TIPO_ACADEMICO_POR_TIPO_DE_BIBLIOTECA,
} from '../tipoAcademico';

/**
 * El diálogo le pedía al pastor clasificar en una taxonomía ACADÉMICA lo que la
 * biblioteca ya tenía clasificado. Y no por falta de datos: el mapeo conocía
 * cuatro de los once tipos de biblioteca, así que los seis MÁS PRECISOS
 * —justamente los que alguien eligió con cuidado— caían todos en «Otro».
 *
 * Caso testigo: el comentario de Sasson sobre Jonás es de la Anchor Bible, y la
 * taxonomía académica de este mismo producto pone «Anchor» entre los ejemplos
 * de comentario crítico-técnico. Se proponía como «Otro».
 */
const recurso = (type: ResourceType): LibraryResource =>
    ({ type } as unknown as LibraryResource);

describe('defaultSourceTypeFor', () => {
    it('el comentario exegético es crítico-técnico, no «Otro»', () => {
        // El caso de Sasson, que es el que destapó esto.
        expect(defaultSourceTypeFor(recurso('exegetical-commentary'))).toBe('commentary-critical');
    });

    it('el texto crítico es una edición del texto', () => {
        // BHQ, BHS, NA28: caían en «Otro» y son la fuente técnica por excelencia.
        expect(defaultSourceTypeFor(recurso('critical-text'))).toBe('biblical-text-edition');
    });

    it('un comentario corriente NO se propone como crítico-técnico', () => {
        // Antes los dos iban a `commentary-critical`, lo que le atribuye a un
        // comentario expositivo un rigor que no ofrece. La biblioteca distingue
        // los dos y la taxonomía académica también.
        expect(defaultSourceTypeFor(recurso('commentary'))).toBe('commentary-expository');
        expect(defaultSourceTypeFor(recurso('exegetical-commentary'))).toBe('commentary-critical');
    });

    it('los tipos de referencia y trasfondo dejan de caer en «Otro»', () => {
        expect(defaultSourceTypeFor(recurso('theological-dictionary'))).toBe('theological-dictionary');
        expect(defaultSourceTypeFor(recurso('bible-dictionary'))).toBe('historical-background');
        expect(defaultSourceTypeFor(recurso('biblical-survey'))).toBe('historical-background');
        expect(defaultSourceTypeFor(recurso('historical-context'))).toBe('historical-background');
    });

    /**
     * INVARIANTE. Con un `default: 'other'`, agregar un tipo de biblioteca lo
     * mandaría en silencio a «Otro» y nadie se enteraría — que es exactamente
     * cómo se llegó al defecto. El registro obliga al compilador a exigir una
     * decisión; esta prueba lo comprueba también en ejecución.
     */
    it('invariante: sólo «other» puede proponer «other»', () => {
        for (const [tipoBiblioteca, tipoAcademico] of Object.entries(TIPO_ACADEMICO_POR_TIPO_DE_BIBLIOTECA)) {
            if (tipoBiblioteca === 'other') continue;
            expect(
                tipoAcademico,
                `«${tipoBiblioteca}» propone «Otro»: o le falta su tipo académico, ` +
                `o hay que justificar por qué este sí es un catch-all.`,
            ).not.toBe('other');
        }
    });

    it('un tipo desconocido no rompe el diálogo', () => {
        expect(defaultSourceTypeFor(recurso('inventado' as ResourceType))).toBe('other');
    });
});

import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    PAPER_COVER_FIELDS,
    PAPER_COVER_FIELDS_POR_ENTREGA,
    type PaperCover,
    type PaperCoverField,
} from '@dosfilos/domain';
import { normalizeCover } from '../UpdatePaperCoverUseCase';

/**
 * EL VIAJE COMPLETO DE LA PORTADA, no solo el exportador.
 *
 * El título del trabajo se agregó a la interfaz, al formulario y al
 * documento de Word, y las pruebas del exportador pasaban porque le
 * entregaban un objeto armado a mano. Lo que había en medio —el
 * normalizador que guarda— tenía su propia lista de campos escrita a
 * mano, sin el campo nuevo, y lo descartaba: la pantalla decía «Portada
 * guardada» y el dato desaparecía sin un solo error.
 */
describe('normalizeCover', () => {
    it('conserva TODOS los campos de la portada, no una lista aparte', () => {
        const completa = Object.fromEntries(
            PAPER_COVER_FIELDS.map(campo => [campo, `valor de ${campo}`]),
        ) as PaperCover;

        expect(normalizeCover(completa)).toEqual(completa);
    });

    it('conserva el título del trabajo, que era el que se perdía', () => {
        const guardada = normalizeCover({
            institution: "The Master's Seminary",
            assignmentTitle: 'Trabajo práctico #3',
            author: 'Ricardo Cerda',
        });
        expect(guardada?.assignmentTitle).toBe('Trabajo práctico #3');
    });

    it('descarta los campos vacíos y la portada entera si no queda nada', () => {
        expect(normalizeCover({ institution: '  ', author: '' })).toBeNull();
        expect(normalizeCover(null)).toBeNull();
    });

    it('recorta lo larguísimo: una portada no lleva párrafos', () => {
        const largo = normalizeCover({ institution: 'x'.repeat(500) });
        expect(largo?.institution?.length).toBeLessThanOrEqual(120);
    });
});

describe('la lista de campos de la portada', () => {
    it('cubre todos los campos de la ficha', () => {
        // `satisfies` comprueba que cada nombre exista, no que estén
        // todos: un campo nuevo desaparecería del formulario y del
        // guardado sin que nada se quejara, que es justo lo que pasó.
        expectTypeOf<Exclude<keyof PaperCover, PaperCoverField>>().toEqualTypeOf<never>();
        expect(PAPER_COVER_FIELDS.length).toBeGreaterThan(0);
    });

    it('el título del trabajo es de la entrega, no del curso', () => {
        expect(PAPER_COVER_FIELDS_POR_ENTREGA).toContain('assignmentTitle');
        for (const campo of ['institution', 'author', 'place', 'date', 'course'] as const) {
            expect(PAPER_COVER_FIELDS_POR_ENTREGA, campo).not.toContain(campo);
        }
    });
});

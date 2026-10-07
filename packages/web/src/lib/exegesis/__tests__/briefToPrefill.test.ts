import { describe, it, expect } from 'vitest';
import type { UserAssignmentBrief } from '@dosfilos/domain';
import { briefToPrefill } from '../briefToPrefill';

/** TP #6: el perfil apuntaba a un encuadre y crear el trabajo lo ignoraba. */
const enc = (id: string, isDefault = false) => ({ id, body: `cuerpo ${id}`, isDefault }) as unknown as UserAssignmentBrief;

describe('el encuadre que se precarga al crear', () => {
    it('REGRESIÓN: el del perfil gana sobre el de defecto', () => {
        expect(briefToPrefill([enc('def', true), enc('perfil')], 'perfil', enc('def', true))?.id).toBe('perfil');
    });

    it('si el del perfil todavía no llegó, se espera en vez de poner el de defecto', () => {
        expect(briefToPrefill([enc('def', true)], 'perfil', enc('def', true))).toBeNull();
    });

    it('sin encuadre en el perfil, el de defecto', () => {
        expect(briefToPrefill([enc('def', true)], null, enc('def', true))?.id).toBe('def');
        expect(briefToPrefill([], null, null)).toBeNull();
    });
});

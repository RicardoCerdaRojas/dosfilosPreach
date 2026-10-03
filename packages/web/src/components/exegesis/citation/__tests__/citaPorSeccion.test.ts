import { describe, it, expect } from 'vitest';
import { resolveCitationSheet } from '../citationSheet';

/** Una cita por sección abre en la hoja donde empieza esa sección. */
describe('resolveCitationSheet — por sección', () => {
    const ctx = { numbering: null, offset: null, sections: [{ section: '2.2 El nominativo', sheet: 80 }, { section: '2.3 El Genitivo', sheet: 87 }] };
    it('encuentra la sección por su título, sin importar tildes ni mayúsculas', () => {
        expect(resolveCitationSheet({ page: 0, pageKind: 'section', locator: '§ 2.3 el genitivo' }, ctx)).toBe(87);
    });
    it('basta el comienzo del título', () => {
        expect(resolveCitationSheet({ page: 0, pageKind: 'section', locator: '2.3' }, ctx)).toBe(87);
    });
    it('una sección que no está: la primera hoja, no una inventada', () => {
        expect(resolveCitationSheet({ page: 0, pageKind: 'section', locator: '9.9' }, ctx)).toBe(1);
    });
});

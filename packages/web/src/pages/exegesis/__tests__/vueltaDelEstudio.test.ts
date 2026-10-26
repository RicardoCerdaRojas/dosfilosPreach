import { describe, it, expect } from 'vitest';
import { paperBackLink, safeInternalPath, PAPER_LIST_PATH } from '../paperBackLink';

/**
 * La flecha del estudio vuelve adonde se abrió (escritorio: «siempre hay
 * vuelta»): `{ from, fromLabel }` en el estado de la navegación, o `?from=`
 * en la dirección cuando el estado se perdió (otra pestaña, enlace copiado).
 */
describe('paperBackLink', () => {
    it('sin `from`, al listado de estudios', () => {
        expect(paperBackLink(null, '')).toEqual({ to: PAPER_LIST_PATH, label: null, kind: 'list' });
        expect(paperBackLink(undefined, '?x=1')).toEqual({ to: PAPER_LIST_PATH, label: null, kind: 'list' });
    });

    it('el estado manda, con su rótulo', () => {
        expect(paperBackLink({ from: '/dashboard/plans/s1', fromLabel: 'Volver a la serie' }, '?from=/dashboard/projects/p1'))
            .toEqual({ to: '/dashboard/plans/s1', label: 'Volver a la serie', kind: 'given' });
    });

    it('`?from=` vale sin estado; el rótulo lo pone la página según adónde vuelve', () => {
        expect(paperBackLink(null, `?from=${encodeURIComponent('/dashboard/projects/p1')}`)).toEqual({ to: '/dashboard/projects/p1', label: null, kind: 'project' });
        expect(paperBackLink(null, '?from=/dashboard/plans/s1')).toMatchObject({ to: '/dashboard/plans/s1', kind: 'series' });
        expect(paperBackLink({ from: '/dashboard/projects/p1' }, '')).toMatchObject({ kind: 'project', label: null });
    });

    it('un `fromLabel` sin `from` válido no viaja (no rotula una vuelta ajena)', () => {
        expect(paperBackLink({ fromLabel: 'Volver al proyecto' }, '?from=/dashboard/plans/s1')).toEqual({ to: '/dashboard/plans/s1', label: null, kind: 'series' });
    });

    it('el rótulo dice «proyecto» o «serie» solo en esas páginas, no en sus hermanas', () => {
        expect(paperBackLink(null, '?from=/dashboard/projects/p1/estado-del-arte').kind).toBe('other');
        expect(paperBackLink(null, '?from=/dashboard/projects/p1%3Fx%3D1').kind).toBe('project');
        expect(paperBackLink(null, '?from=/dashboard/plans/pericope').kind).toBe('other');
        expect(paperBackLink(null, '?from=/dashboard/plans/new').kind).toBe('other');
        expect(paperBackLink(null, '?from=/dashboard/plans/s1/edit').kind).toBe('other');
        expect(paperBackLink(null, '?from=/dashboard').kind).toBe('other');
        expect(paperBackLink(null, `?from=${PAPER_LIST_PATH}`).kind).toBe('list');
    });

    it('solo rutas internas: nada que saque de la app', () => {
        for (const malo of ['https://otro.sitio', '//otro.sitio', '/\\otro.sitio', 'javascript:alert(1)', 'dashboard/projects/p1', '']) {
            expect(safeInternalPath(malo)).toBeNull();
            expect(paperBackLink({ from: malo }, `?from=${encodeURIComponent(malo)}`).to).toBe(PAPER_LIST_PATH);
        }
        expect(safeInternalPath(42)).toBeNull();
        expect(safeInternalPath('/dashboard/projects/p1')).toBe('/dashboard/projects/p1');
    });
});

import type { SetURLSearchParams } from 'react-router-dom';
import type { VistaDeBiblioteca } from '../components/LibraryTabs';

/**
 * «Mis libros» o «Consultar» (fase «biblioteca consultable», U3). Va en la
 * URL (`?vista=consultar`) para que volver atrás desde el visor deje la
 * pestaña donde estaba.
 */
export function useVistaDeBiblioteca(searchParams: URLSearchParams, setSearchParams: SetURLSearchParams) {
    const vista: VistaDeBiblioteca = searchParams.get('vista') === 'consultar' ? 'consultar' : 'libros';
    const cambiarVista = (v: VistaDeBiblioteca) => setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (v === 'consultar') next.set('vista', 'consultar'); else next.delete('vista');
        return next;
    }, { replace: true });
    return { vista, cambiarVista };
}

/**
 * Adónde vuelve la flecha del estudio. Quien lo abre (el escritorio del
 * proyecto, la serie, el panel principal) pasa `{ from, fromLabel }` en el
 * estado de la navegación; un enlace que se copia o se abre en otra pestaña
 * pierde ese estado, así que también vale `?from=` en la dirección.
 *
 * Solo rutas internas: `//otro.sitio` o `/\otro.sitio` el navegador los
 * trata como de otro dominio, y la flecha no puede sacar al pastor de la app.
 */
export type PaperBackKind = 'given' | 'project' | 'series' | 'list' | 'other';

export interface PaperBackLink {
    to: string;
    /** El rótulo que mandó quien abrió el estudio, si mandó uno. */
    label: string | null;
    /** Sin rótulo, cuál poner según adónde vuelve. */
    kind: PaperBackKind;
}

export const PAPER_LIST_PATH = '/dashboard/exegesis';

export function safeInternalPath(path: unknown): string | null {
    if (typeof path !== 'string' || !path.startsWith('/')) return null;
    if (path.startsWith('//') || path.startsWith('/\\')) return null;
    return path;
}

export function paperBackLink(state: unknown, search: string): PaperBackLink {
    const s = (state ?? null) as { from?: unknown; fromLabel?: unknown } | null;
    const desdeEstado = safeInternalPath(s?.from);
    const to = desdeEstado ?? safeInternalPath(new URLSearchParams(search).get('from'));
    if (!to) return { to: PAPER_LIST_PATH, label: null, kind: 'list' };
    // El rótulo viaja solo con el estado: el de `?from=` lo pone la página.
    const label = desdeEstado && typeof s?.fromLabel === 'string' && s.fromLabel.trim() ? s.fromLabel : null;
    if (label) return { to, label, kind: 'given' };
    // El escritorio del proyecto (no su estado del arte) y la serie (no el
    // planificador ni su formulario): solo entonces el rótulo dice adónde.
    const ruta = to.split(/[?#]/)[0]!;
    if (/^\/dashboard\/projects\/[^/]+\/?$/.test(ruta)) return { to, label: null, kind: 'project' };
    const serie = /^\/dashboard\/plans\/([^/]+)\/?$/.exec(ruta);
    if (serie && serie[1] !== 'new' && serie[1] !== 'pericope') return { to, label: null, kind: 'series' };
    return { to, label: null, kind: to === PAPER_LIST_PATH ? 'list' : 'other' };
}

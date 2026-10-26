/**
 * Adónde vuelve la flecha del estudio. Quien lo abre (el escritorio del
 * proyecto, la serie, el panel principal) pasa `{ from, fromLabel }` en el
 * estado de la navegación; un enlace que se copia o se abre en otra pestaña
 * pierde ese estado, así que también vale `?from=` en la dirección.
 *
 * Solo rutas internas: `//otro.sitio`, `/\otro.sitio` o `/<tab>/otro.sitio`
 * el navegador los trata como de otro dominio, y la flecha no puede sacar al
 * pastor de la app.
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

/**
 * Caracteres de control y barra invertida, en cualquier lugar: el navegador
 * quita tabuladores y saltos de línea de una dirección (`/\t/otro.sitio`
 * termina en `//otro.sitio`) y trata la barra invertida como `/`.
 */
// eslint-disable-next-line no-control-regex -- buscar caracteres de control es justo lo que hace
const CONTROL_O_BARRA_INVERTIDA = /[\u0000-\u001F\u007F\\]/;
/** Una base que no existe: lo que resuelva a otro origen sale de la app. */
const BASE_INTERNA = 'https://x.invalid';

export function safeInternalPath(path: unknown): string | null {
    // Una sola `/` al comienzo: `//otro.sitio` es una dirección de otro dominio.
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
    if (CONTROL_O_BARRA_INVERTIDA.test(path)) return null;
    // Última red: lo que el analizador de direcciones resuelva fuera del origen, no.
    try {
        if (new URL(path, BASE_INTERNA).origin !== BASE_INTERNA) return null;
    } catch {
        return null;
    }
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

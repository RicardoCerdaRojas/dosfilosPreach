import { HttpsError } from 'firebase-functions/v2/https';
import type { Alcance } from './recuperarFragmentos';

/**
 * El alcance de una consulta, validado. Vive aparte para que «Buscar temas»
 * lo use sin importar el módulo de `consultarBiblioteca`, que trae el cliente
 * del asistente (y con él las claves que «Buscar temas» no lee ni declara).
 */
const MAX_LIBROS = 200;

export function leerAlcance(crudo: unknown): Alcance {
    const a = (crudo ?? {}) as { tipo?: unknown; ids?: unknown };
    if (a.tipo === 'todo') return { tipo: 'todo' };
    if (a.tipo === 'libros' && Array.isArray(a.ids)) {
        const ids = [...new Set(a.ids.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(x => x.trim()))];
        if (ids.length === 0) throw new HttpsError('invalid-argument', 'Elige al menos un libro.');
        if (ids.length > MAX_LIBROS) throw new HttpsError('invalid-argument', `Elige a lo sumo ${MAX_LIBROS} libros.`);
        return { tipo: 'libros', ids };
    }
    throw new HttpsError('invalid-argument', 'alcance inválido');
}

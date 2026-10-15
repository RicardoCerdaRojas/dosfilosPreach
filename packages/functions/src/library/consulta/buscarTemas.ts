import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../../config/appCheckOptions';
import { consumeRateLimitToken } from '../../shared/rateLimit';
import { LARGO_EXTRACTO, type FragmentoRecuperado } from './armarConsulta';
import { leerAlcance } from './consultarBiblioteca';
import { recuperarFragmentos } from './recuperarFragmentos';

/**
 * «Buscar temas» (fase «biblioteca consultable», U5): dónde se habla de algo
 * en la biblioteca, por significado y SIN respuesta redactada. Devuelve libros
 * y hojas con su extracto, agrupados por libro. No llama al asistente: es el
 * embedding de la consulta y una búsqueda vectorial, así que no cuenta como
 * consulta del plan (tiene su propio tope por hora, como Facultad).
 */

/** Fragmentos que se miran: más que en «Preguntar», porque acá no se leen enteros. */
export const FRAGMENTOS_DE_TEMAS = 30;
const MAX_CONSULTA = 300;
const POR_HORA = 120;

export interface HojaDelTema {
    hoja: number | null;
    seccion: string;
    extracto: string;
    score: number;
}

export interface LibroDelTema {
    resourceId: string;
    titulo: string;
    autor: string;
    hojas: HojaDelTema[];
}

/**
 * Agrupa por libro, en el orden del mejor fragmento de cada uno; dentro de un
 * libro, por relevancia, y una hoja aparece una sola vez (la de mejor score).
 */
export function agruparPorLibro(fragmentos: ReadonlyArray<FragmentoRecuperado>): LibroDelTema[] {
    const libros = new Map<string, LibroDelTema>();
    for (const f of [...fragmentos].sort((a, b) => b.score - a.score)) {
        let libro = libros.get(f.resourceId);
        if (!libro) {
            libro = { resourceId: f.resourceId, titulo: f.titulo, autor: f.autor, hojas: [] };
            libros.set(f.resourceId, libro);
        }
        if (libro.hojas.some(h => h.hoja === f.hoja && f.hoja !== null)) continue;
        const texto = f.texto.replace(/\s+/g, ' ').trim();
        libro.hojas.push({
            hoja: f.hoja,
            seccion: f.seccion,
            extracto: texto.length > LARGO_EXTRACTO ? `${texto.slice(0, LARGO_EXTRACTO)}…` : texto,
            score: Math.round(f.score * 1000) / 1000,
        });
    }
    return [...libros.values()];
}

export const buscarTemasEnBiblioteca = onCall(
    {
        ...appCheckCallableOptions(),
        region: 'us-central1',
        memory: '1GiB',
        timeoutSeconds: 60,
        secrets: ['GEMINI_API_KEY'],
    },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required');
        const userId = request.auth.uid;
        const data = (request.data ?? {}) as { consulta?: unknown; alcance?: unknown };
        const consulta = typeof data.consulta === 'string' ? data.consulta.trim() : '';
        if (consulta.length < 2) throw new HttpsError('invalid-argument', 'Escribe un tema.');
        if (consulta.length > MAX_CONSULTA) throw new HttpsError('invalid-argument', `El tema es muy largo (máximo ${MAX_CONSULTA} caracteres).`);
        const alcance = leerAlcance(data.alcance ?? { tipo: 'todo' });

        const permitido = await consumeRateLimitToken(getFirestore(), { bucket: 'library_topics', key: userId, windowMs: 60 * 60 * 1000, max: POR_HORA });
        if (!permitido) throw new HttpsError('resource-exhausted', 'Demasiadas búsquedas seguidas. Espera unos minutos.');

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new HttpsError('failed-precondition', 'No se pudo buscar en tu biblioteca.');
        try {
            const fragmentos = await recuperarFragmentos(consulta, userId, alcance, apiKey, FRAGMENTOS_DE_TEMAS);
            return { libros: agruparPorLibro(fragmentos) };
        } catch (err) {
            console.error('[buscarTemasEnBiblioteca] falló la búsqueda:', err);
            throw new HttpsError('unavailable', 'No se pudo buscar en tu biblioteca. Intenta de nuevo en unos minutos.');
        }
    },
);

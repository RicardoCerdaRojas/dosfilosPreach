import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../../config/appCheckOptions';
import { consumeRateLimitToken } from '../../shared/rateLimit';
import { extractoLegible, tituloDeConsulta, type FragmentoRecuperado } from './armarConsulta';
import { leerAlcance } from './alcance';
import { buscarPertinentes, type Alcance } from './recuperarFragmentos';

/**
 * «Buscar temas» (fase «biblioteca consultable», U5): dónde se habla de algo
 * en la biblioteca, por significado y SIN respuesta redactada. Devuelve libros
 * y hojas con su extracto, agrupados por libro. Desde la fase «buscador de la
 * biblioteca» los candidatos se reordenan por pertinencia (Luna, ~US$0,0014 y
 * ~4 s por búsqueda, medido) y sólo se muestra lo que pasa el corte. No cuenta
 * como consulta del plan (tiene su propio tope por hora).
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
 * Agrupa por libro CONSERVANDO el orden recibido (ya viene de mayor a menor
 * pertinencia): los libros, en el orden de su mejor fragmento; dentro de un
 * libro, en ese mismo orden, y una hoja aparece una sola vez (la primera).
 */
export function agruparPorLibro(fragmentos: ReadonlyArray<FragmentoRecuperado>): LibroDelTema[] {
    const libros = new Map<string, LibroDelTema>();
    for (const f of fragmentos) {
        let libro = libros.get(f.resourceId);
        if (!libro) {
            libro = { resourceId: f.resourceId, titulo: f.titulo, autor: f.autor, hojas: [] };
            libros.set(f.resourceId, libro);
        }
        if (libro.hojas.some(h => h.hoja === f.hoja && f.hoja !== null)) continue;
        libro.hojas.push({
            hoja: f.hoja,
            seccion: f.seccion,
            extracto: extractoLegible(f.texto),
            score: Math.round(f.score * 1000) / 1000,
        });
    }
    return [...libros.values()];
}

/**
 * La búsqueda guardada en `library_consultations`, con `tipo: 'temas'` y el
 * resultado en `temas`. Si guardar falla, la búsqueda igual se muestra: el
 * historial no puede costarle el resultado al pastor.
 */
async function guardarBusqueda(userId: string, consulta: string, alcance: Alcance, libros: LibroDelTema[], reordenado: boolean): Promise<string | null> {
    try {
        const ahora = new Date();
        const ref = getFirestore().collection('library_consultations').doc();
        await ref.set({
            userId,
            tipo: 'temas',
            titulo: tituloDeConsulta(consulta),
            alcance,
            turnos: [],
            temas: { consulta, libros, reordenado },
            creada: ahora,
            actualizada: ahora,
        });
        return ref.id;
    } catch (err) {
        console.error('[buscarTemasEnBiblioteca] no se pudo guardar en el historial:', err);
        return null;
    }
}

export const buscarTemasEnBiblioteca = onCall(
    {
        ...appCheckCallableOptions(),
        region: 'us-central1',
        memory: '1GiB',
        timeoutSeconds: 60,
        // Reordenar llama al asistente (ruta `library.rerank`), con Gemini de respaldo.
        secrets: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'],
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
            const { fragmentos, reordenado } = await buscarPertinentes(consulta, userId, alcance, apiKey, { total: FRAGMENTOS_DE_TEMAS, timeoutSeconds: 40 });
            const libros = agruparPorLibro(fragmentos);
            // Queda en el historial, como las preguntas (pedido del fundador,
            // 2026-10-16): una búsqueda útil se vuelve a abrir sin repetirla.
            const consultaId = await guardarBusqueda(userId, consulta, alcance, libros, reordenado);
            return { libros, reordenado, consultaId };
        } catch (err) {
            console.error('[buscarTemasEnBiblioteca] falló la búsqueda:', err);
            throw new HttpsError('unavailable', 'No se pudo buscar en tu biblioteca. Intenta de nuevo en unos minutos.');
        }
    },
);

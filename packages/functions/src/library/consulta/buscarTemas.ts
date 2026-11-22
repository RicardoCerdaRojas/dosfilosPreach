import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../../config/appCheckOptions';
import { consumeRateLimitToken } from '../../shared/rateLimit';
import { tituloDeConsulta } from './armarConsulta';
import { FRAGMENTOS_DE_TEMAS, MAX_CONSULTA, POR_HORA, agruparPorLibro, type LibroDelTema } from './agruparPorLibro';
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

export { FRAGMENTOS_DE_TEMAS, agruparPorLibro, type HojaDelTema, type LibroDelTema } from './agruparPorLibro';

/**
 * La búsqueda guardada en `library_consultations`, con `tipo: 'temas'` y el
 * resultado en `temas`. Si guardar falla, la búsqueda igual se muestra: el
 * historial no puede costarle el resultado al pastor.
 */
async function guardarBusqueda(userId: string, consulta: string, alcance: Alcance, libros: LibroDelTema[], reordenado: boolean): Promise<string | null> {
    try {
        const ahora = new Date();
        const db = getFirestore();
        const titulo = tituloDeConsulta(consulta);
        // La misma búsqueda (mismas palabras y mismo alcance) se ACTUALIZA: si
        // no, repetirla llenaba el historial y empujaba fuera de la lista las
        // conversaciones (revisión adversarial). Sólo igualdades: no pide índice.
        const previas = await db.collection('library_consultations').where('userId', '==', userId).where('titulo', '==', titulo).limit(20).get();
        const misma = previas.docs.find(d => d.data().tipo === 'temas'
            && d.data().temas?.consulta === consulta
            && JSON.stringify(d.data().alcance) === JSON.stringify(alcance));
        if (misma) {
            await misma.ref.update({ temas: { consulta, libros, reordenado }, actualizada: ahora });
            return misma.id;
        }
        const ref = db.collection('library_consultations').doc();
        await ref.set({
            userId,
            tipo: 'temas',
            titulo,
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

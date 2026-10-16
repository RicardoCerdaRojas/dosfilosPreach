import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../../config/appCheckOptions';
import { consumeRateLimitToken } from '../../shared/rateLimit';
import { clientePorRuta, MENSAJE_SIN_RESPUESTA } from '../../llm/clientePorRuta';
import { armarPedido, leerRespuesta, tituloDeConsulta, type FuenteCitada, type TurnoAnterior } from './armarConsulta';
import { revisarCuota, sumarConsulta } from './cuotaDeConsultas';
import { buscarPertinentes, FRAGMENTOS_POR_CONSULTA, type Alcance } from './recuperarFragmentos';
import { leerAlcance } from './alcance';

// Se reexporta: quien lo importaba de acá sigue igual.
export { leerAlcance };

/**
 * «Consultar» la biblioteca (fase «biblioteca consultable», U2): una pregunta
 * a toda la biblioteca, a unos libros o a uno, respondida SOLO con lo que hay
 * en ellos y con citas por fragmento. La conversación se guarda en
 * `library_consultations/{id}` (la escribe sólo el servidor).
 */

const COLECCION = 'library_consultations';
const TIMEOUT_S = 120;
const MAX_PREGUNTA = 2000;
/** Una consulta muy larga se vuelve lenta de leer y pesada de guardar: se empieza otra. */
export const MAX_TURNOS = 40;
/**
 * Tope por tamaño, además de por turnos: un documento de Firestore admite
 * 1 MiB, y 40 respuestas largas con sus extractos pueden pasarlo (revisión
 * adversarial, U2). Con margen para el turno que se agrega.
 */
export const MAX_BYTES_DE_CONSULTA = 700_000;
/** Tope por hora, aparte de la cuota del mes: los planes ilimitados también lo tienen. */
const POR_HORA = 60;
/** Lo que se le deja al asistente para cerrar: guardar y contar. */
const MARGEN_S = 10;

/** Lo que se responde si no hubo fragmentos: no se llama al asistente ni se cuenta la consulta. */
export const SIN_FRAGMENTOS = 'No encontré nada en tus libros que responda esta pregunta. Prueba con otras palabras, o amplía la consulta a más libros.';

interface Entrada {
    pregunta?: unknown;
    alcance?: unknown;
    consultaId?: unknown;
}

export interface TurnoGuardado {
    pregunta: string;
    respuesta: string;
    fuentes: FuenteCitada[];
    creado: Date;
}

/**
 * Lo que se busca: la pregunta y, si sigue una conversación, la pregunta
 * anterior, para que «¿y Moo qué dice?» busque de lo mismo.
 */
export function consultaDeBusqueda(pregunta: string, anteriores: ReadonlyArray<TurnoAnterior>): string {
    const previa = anteriores[anteriores.length - 1]?.pregunta;
    return previa ? `${previa}\n${pregunta}` : pregunta;
}

export const consultarBiblioteca = onCall(
    {
        ...appCheckCallableOptions(),
        region: 'us-central1',
        memory: '1GiB',
        timeoutSeconds: TIMEOUT_S,
        secrets: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'],
    },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign-in required');
        const userId = request.auth.uid;
        const entrada = (request.data ?? {}) as Entrada;
        const pregunta = typeof entrada.pregunta === 'string' ? entrada.pregunta.trim() : '';
        if (!pregunta) throw new HttpsError('invalid-argument', 'Escribe una pregunta.');
        if (pregunta.length > MAX_PREGUNTA) throw new HttpsError('invalid-argument', `La pregunta es muy larga (máximo ${MAX_PREGUNTA} caracteres).`);
        const consultaId = typeof entrada.consultaId === 'string' && entrada.consultaId.trim() ? entrada.consultaId.trim() : null;

        const db = getFirestore();
        let alcance: Alcance;
        let anteriores: TurnoAnterior[] = [];
        if (consultaId) {
            // Una consulta que sigue conserva su alcance: el de la primera pregunta.
            const snap = await db.collection(COLECCION).doc(consultaId).get();
            if (!snap.exists || snap.data()?.userId !== userId) throw new HttpsError('not-found', 'No se encontró la consulta.');
            const turnos = (snap.data()?.turnos ?? []) as TurnoAnterior[];
            if (turnos.length >= MAX_TURNOS || JSON.stringify(turnos).length > MAX_BYTES_DE_CONSULTA) throw new HttpsError('failed-precondition', 'Esta consulta ya es muy larga. Empieza una nueva.');
            alcance = leerAlcance(snap.data()?.alcance);
            anteriores = turnos.map(t => ({ pregunta: t.pregunta, respuesta: t.respuesta }));
        } else {
            alcance = leerAlcance(entrada.alcance);
        }

        const sinCuota = await revisarCuota(userId);
        if (sinCuota) throw new HttpsError('resource-exhausted', sinCuota);
        const permitido = await consumeRateLimitToken(db, { bucket: 'library_consult', key: userId, windowMs: 60 * 60 * 1000, max: POR_HORA });
        if (!permitido) throw new HttpsError('resource-exhausted', 'Demasiadas preguntas seguidas. Espera unos minutos.');
        const inicio = Date.now();

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new HttpsError('failed-precondition', MENSAJE_SIN_RESPUESTA);
        let fragmentos;
        try {
            // Candidatos por vectores, reordenados por pertinencia y cortados
            // (fase «buscador de la biblioteca»). Si nada pasa el corte, la
            // respuesta dice que no encontró: mejor que responder con lo que no trata el tema.
            ({ fragmentos } = await buscarPertinentes(consultaDeBusqueda(pregunta, anteriores), userId, alcance, apiKey, { total: FRAGMENTOS_POR_CONSULTA, timeoutSeconds: 30 }));
        } catch (err) {
            console.error('[consultarBiblioteca] no se pudieron recuperar fragmentos:', err);
            throw new HttpsError('unavailable', 'No se pudo buscar en tu biblioteca. Intenta de nuevo en unos minutos.');
        }

        let respuesta: string;
        let fuentes: FuenteCitada[] = [];
        if (fragmentos.length === 0) {
            respuesta = SIN_FRAGMENTOS;
        } else {
            const { system, prompt } = armarPedido(pregunta, fragmentos, anteriores);
            // El reloj del asistente (y de su respaldo) es lo que le QUEDA a la
            // función, no los 120 s enteros: la recuperación ya gastó una parte.
            const quedan = Math.max(20, TIMEOUT_S - Math.ceil((Date.now() - inicio) / 1000) - MARGEN_S);
            const llm = await clientePorRuta({
                usage: { feature: 'library.consult', userId },
                timeoutSeconds: quedan,
                maxOutputTokens: 6000,
            });
            let crudo: string;
            try {
                crudo = await llm.generate({ system, prompt, temperature: 0.2, maxOutputTokens: 6000 });
            } catch (err) {
                console.error('[consultarBiblioteca] el asistente no respondió:', err);
                throw new HttpsError('unavailable', MENSAJE_SIN_RESPUESTA);
            }
            ({ respuesta, fuentes } = leerRespuesta(crudo, fragmentos));
            if (!respuesta) throw new HttpsError('unavailable', MENSAJE_SIN_RESPUESTA);
        }

        const turno: TurnoGuardado = { pregunta, respuesta, fuentes, creado: new Date() };
        const ref = consultaId ? db.collection(COLECCION).doc(consultaId) : db.collection(COLECCION).doc();
        // Primero se guarda y DESPUÉS se cuenta: si guardar falla (la consulta
        // se borró mientras se esperaba), no se cobra una respuesta que el
        // pastor no va a poder ver (revisión adversarial, U2).
        if (consultaId) {
            try {
                await ref.update({ turnos: FieldValue.arrayUnion(turno), actualizada: turno.creado });
            } catch (err) {
                console.error('[consultarBiblioteca] no se pudo guardar el turno:', err);
                throw new HttpsError('not-found', 'La consulta ya no existe. Empieza una nueva.');
            }
        } else {
            await ref.set({
                userId,
                titulo: tituloDeConsulta(pregunta),
                alcance,
                turnos: [turno],
                creada: turno.creado,
                actualizada: turno.creado,
            });
        }
        if (fragmentos.length > 0) await sumarConsulta(userId);
        console.log(`[consultarBiblioteca] ${userId.slice(0, 8)} ${alcance.tipo}${alcance.tipo === 'libros' ? `(${alcance.ids.length})` : ''}: ${fragmentos.length} fragmentos, ${fuentes.length} citados`);
        return { consultaId: ref.id, turno: { ...turno, creado: turno.creado.toISOString() } };
    },
);

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../../config/appCheckOptions';
import { clientePorRuta, MENSAJE_SIN_RESPUESTA } from '../../llm/clientePorRuta';
import { armarPedido, leerRespuesta, tituloDeConsulta, type FuenteCitada, type TurnoAnterior } from './armarConsulta';
import { revisarCuota, sumarConsulta } from './cuotaDeConsultas';
import { recuperarFragmentos, type Alcance } from './recuperarFragmentos';

/**
 * «Consultar» la biblioteca (fase «biblioteca consultable», U2): una pregunta
 * a toda la biblioteca, a unos libros o a uno, respondida SOLO con lo que hay
 * en ellos y con citas por fragmento. La conversación se guarda en
 * `library_consultations/{id}` (la escribe sólo el servidor).
 */

const COLECCION = 'library_consultations';
const TIMEOUT_S = 120;
const MAX_PREGUNTA = 2000;
const MAX_LIBROS = 200;
/** Una consulta muy larga se vuelve lenta de leer y pesada de guardar: se empieza otra. */
export const MAX_TURNOS = 40;

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
            if (turnos.length >= MAX_TURNOS) throw new HttpsError('failed-precondition', 'Esta consulta ya es muy larga. Empieza una nueva.');
            alcance = leerAlcance(snap.data()?.alcance);
            anteriores = turnos.map(t => ({ pregunta: t.pregunta, respuesta: t.respuesta }));
        } else {
            alcance = leerAlcance(entrada.alcance);
        }

        const sinCuota = await revisarCuota(userId);
        if (sinCuota) throw new HttpsError('resource-exhausted', sinCuota);

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new HttpsError('failed-precondition', MENSAJE_SIN_RESPUESTA);
        let fragmentos;
        try {
            fragmentos = await recuperarFragmentos(consultaDeBusqueda(pregunta, anteriores), userId, alcance, apiKey);
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
            const llm = await clientePorRuta({
                usage: { feature: 'library.consult', userId },
                timeoutSeconds: TIMEOUT_S,
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
            await sumarConsulta(userId);
        }

        const turno: TurnoGuardado = { pregunta, respuesta, fuentes, creado: new Date() };
        const ref = consultaId ? db.collection(COLECCION).doc(consultaId) : db.collection(COLECCION).doc();
        if (consultaId) {
            await ref.update({ turnos: FieldValue.arrayUnion(turno), actualizada: turno.creado });
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
        console.log(`[consultarBiblioteca] ${userId.slice(0, 8)} ${alcance.tipo}${alcance.tipo === 'libros' ? `(${alcance.ids.length})` : ''}: ${fragmentos.length} fragmentos, ${fuentes.length} citados`);
        return { consultaId: ref.id, turno: { ...turno, creado: turno.creado.toISOString() } };
    },
);

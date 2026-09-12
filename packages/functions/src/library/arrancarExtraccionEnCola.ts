/**
 * Marca la corrida, deja el recurso en curso y encola su primer rango.
 *
 * Vive en su propio módulo porque lo usan LOS DOS caminos que extraen por
 * visión: el disparador de subida y el callable de «reextraer por imágenes».
 * Tener una copia en cada uno es exactamente la forma de defecto que este
 * módulo lleva días corrigiendo — dos reglas que deberían coincidir y viven
 * aparte terminan no coincidiendo.
 *
 * Devuelve `null` si no se pudo encolar, para que el llamador degrade a extraer
 * en línea. La cola quita el techo de tiempo, pero no puede ser un punto único
 * de fallo: lo peor que puede pasar es volver al comportamiento anterior, donde
 * un libro chico entra igual y uno grande queda como estaba — nunca peor.
 */

import { randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { TANDA_INICIAL } from './calibrarTanda';
import { primerRango, planDeRangos } from './planDeRangos';
import { encolarRango } from './extractRangeTask';

export interface ArranqueEnCola {
    runId: string;
    pageCount: number;
    rangosEstimados: number;
}

export async function arrancarExtraccionEnCola(
    resourceRef: FirebaseFirestore.DocumentReference,
    resourceId: string,
    totalPaginas: number,
    tamanoConocido: number | undefined,
): Promise<ArranqueEnCola | null> {
    // Si este archivo ya se extrajo antes se reusa el tamaño medido entonces, y
    // el primer rango deja de ser una apuesta conservadora.
    const tamano = tamanoConocido ?? TANDA_INICIAL;
    const primero = primerRango(tamano, totalPaginas);
    if (!primero) return null;

    const rangosEstimados = planDeRangos(totalPaginas, tamano).length;
    const runId = randomUUID();

    try {
        await resourceRef.update({
            textExtractionStatus: 'processing',
            extractionRunId: runId,
            extractionHeartbeatAt: FieldValue.serverTimestamp(),
            processingStartedAt: FieldValue.serverTimestamp(),
            extractionProgress: {
                paginasHechas: 0,
                totalPaginas,
                porcentaje: 0,
                ultimoRango: null,
                rangosEstimados,
            },
            // El motivo de un intento anterior se limpia al arrancar: mientras
            // esta corrida avanza, mostrar el fallo viejo sería mentir.
            extractionError: null,
            extractionFailureReason: null,
            updatedAt: new Date(),
        });

        await encolarRango({
            resourceId, runId,
            desde: primero.desde, hasta: primero.hasta,
            tamano,
            // Sin densidad conocida todavía: la mide el primer rango y de ahí en
            // más viaja con la cadena, quedándose siempre con el tramo más denso.
            densidadMaxima: null,
        });
    } catch (err) {
        console.error(`[Cola] ${resourceId}: no se pudo encolar; se extrae en línea`, err);
        return null;
    }

    console.log(
        `⛓️ [Cola] ${resourceId}: ${totalPaginas} páginas en cola (~${rangosEstimados} rangos), corrida ${runId}`,
    );
    return { runId, pageCount: totalPaginas, rangosEstimados };
}

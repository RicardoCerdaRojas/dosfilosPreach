import { GoogleGenAI } from '@google/genai';
import { MODEL_VISION } from '../llm/modelCatalog';
import { pedidoDeTramo } from './loteDeExtraccion';
import type { ArchivoSubido, RespuestaCruda } from './estadoDelLote';

/**
 * Lo que el reproceso en lote necesita de Gemini (Files API y Batch API),
 * detrás de una interfaz para que la orquestación se pruebe sin red.
 */
export interface GeminiDelLote {
    subirPdf(bytes: Uint8Array): Promise<ArchivoSubido>;
    /** Cada pedido lleva `metadata.tramo` = el índice del tramo, para emparejar la respuesta. */
    crearJob(nombre: string, pedidos: ReadonlyArray<{ indice: number; uri: string }>): Promise<string>;
    /** Un job con ese nombre que quedó sin anotar (la tarea murió después de crearlo). */
    buscarJob(nombre: string): Promise<string | null>;
    verJob(job: string): Promise<{ estado: string; respuestas: RespuestaCruda[] | null }>;
    cancelarJob(job: string): Promise<void>;
    borrarArchivo(nombre: string): Promise<void>;
}

/** Cuántos jobs recientes se miran al buscar uno huérfano por su nombre. */
const JOBS_A_REVISAR = 200;

export function geminiDelLote(apiKey: string): GeminiDelLote {
    const ai = new GoogleGenAI({ apiKey });
    return {
        async subirPdf(bytes) {
            const subido = await ai.files.upload({
                file: new Blob([bytes], { type: 'application/pdf' }),
                config: { mimeType: 'application/pdf' },
            });
            if (!subido.name || !subido.uri) throw new Error('la Files API no devolvió el archivo');
            return { name: subido.name, uri: subido.uri };
        },
        async crearJob(nombre, pedidos) {
            const job = await ai.batches.create({
                model: MODEL_VISION,
                src: pedidos.map(p => ({ ...pedidoDeTramo(p.uri), metadata: { tramo: String(p.indice) } })),
                config: { displayName: nombre },
            });
            if (!job.name) throw new Error('la Batch API no devolvió el job');
            return job.name;
        },
        async buscarJob(nombre) {
            let vistos = 0;
            for await (const job of await ai.batches.list({ config: { pageSize: 50 } })) {
                if (job.displayName === nombre && job.name) return job.name;
                if (++vistos >= JOBS_A_REVISAR) break;
            }
            return null;
        },
        async verJob(nombre) {
            const job = await ai.batches.get({ name: nombre });
            const estado = String(job.state ?? 'JOB_STATE_UNSPECIFIED');
            if (estado !== 'JOB_STATE_SUCCEEDED') return { estado, respuestas: null };
            // Supuesto (no medido): con pedidos en línea, las respuestas vuelven
            // en línea. Si vinieran en un archivo, no se leen: cada tramo queda
            // «sin respuesta» y se reintenta, en vez de leer mal.
            const respuestas = (job.dest?.inlinedResponses ?? []).map((r): RespuestaCruda => {
                const cand = r.response?.candidates?.[0];
                const u = r.response?.usageMetadata;
                return {
                    metadata: r.metadata ?? null,
                    text: cand?.content?.parts?.map(p => p.text ?? '').join('') ?? '',
                    finishReason: cand?.finishReason ? String(cand.finishReason) : null,
                    error: r.error ?? null,
                    entrada: u?.promptTokenCount ?? 0,
                    salida: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
                };
            });
            return { estado, respuestas };
        },
        async cancelarJob(nombre) {
            await ai.batches.cancel({ name: nombre });
        },
        async borrarArchivo(nombre) {
            await ai.files.delete({ name: nombre }).catch(() => undefined);
        },
    };
}

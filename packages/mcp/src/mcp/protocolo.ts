import { ErrorDeHerramienta, type Contexto, type Herramienta, type Resultado } from '../herramientas/tipos';

/**
 * El protocolo MCP sobre HTTP, sin estado (transporte «Streamable HTTP» con
 * respuestas JSON, sin SSE): `initialize`, `ping`, `tools/list` y
 * `tools/call`. Las notificaciones no llevan respuesta. Escrito a mano y no
 * con el SDK: son cuatro métodos, y así no entra una dependencia más al
 * servidor que lee los libros del usuario.
 */

export const VERSIONES = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;

export interface Mensaje {
    jsonrpc?: unknown;
    id?: unknown;
    method?: unknown;
    params?: unknown;
}

type Respuesta = { jsonrpc: '2.0'; id: unknown; result?: unknown; error?: { code: number; message: string } };

const error = (id: unknown, code: number, message: string): Respuesta => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const ok = (id: unknown, result: unknown): Respuesta => ({ jsonrpc: '2.0', id, result });

export interface Dependencias {
    herramientas: ReadonlyArray<Herramienta>;
    ctx: Contexto;
    auditar: (e: { herramienta: string; args: Record<string, unknown>; ok: boolean; error?: string; leido?: Resultado['leido'] }) => Promise<void>;
}

/** Responde un mensaje; null si es una notificación (sin `id`). */
export async function atender(m: Mensaje, deps: Dependencias): Promise<Respuesta | null> {
    if (m === null || typeof m !== 'object' || m.jsonrpc !== '2.0' || typeof m.method !== 'string') {
        return error((m as Mensaje | null)?.id, -32600, 'Petición inválida');
    }
    const esNotificacion = m.id === undefined;
    if (esNotificacion) return null;
    const params = (m.params && typeof m.params === 'object' ? m.params : {}) as Record<string, unknown>;

    switch (m.method) {
        case 'initialize': {
            const pedida = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
            return ok(m.id, {
                protocolVersion: (VERSIONES as readonly string[]).includes(pedida) ? pedida : VERSIONES[0],
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: 'dosfilos-preach-corpus', version: '0.1.0' },
                instructions: 'Lectura de la biblioteca y los trabajos exegéticos del usuario en Dos Filos Preach. Cita siempre con la cita que devuelve cada herramienta; no atribuyas a un libro lo que no está en un texto leído con leer_hoja o en un extracto de buscar_biblioteca.',
            });
        }
        case 'ping':
            return ok(m.id, {});
        case 'tools/list':
            return ok(m.id, {
                tools: deps.herramientas.map(h => ({
                    name: h.nombre,
                    description: h.descripcion,
                    inputSchema: h.esquema,
                    annotations: { readOnlyHint: true, openWorldHint: false },
                })),
            });
        case 'tools/call': {
            const nombre = typeof params.name === 'string' ? params.name : '';
            const h = deps.herramientas.find(x => x.nombre === nombre);
            if (!h) return error(m.id, -32602, `Herramienta desconocida: ${nombre}`);
            const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<string, unknown>;
            try {
                const r = await h.ejecutar(args, deps.ctx);
                await deps.auditar({ herramienta: h.nombre, args, ok: true, leido: r.leido });
                return ok(m.id, { content: [{ type: 'text', text: r.texto }], isError: false });
            } catch (err) {
                const mensaje = err instanceof ErrorDeHerramienta ? err.message : 'No se pudo completar la herramienta. Intenta de nuevo en unos minutos.';
                if (!(err instanceof ErrorDeHerramienta)) console.error(`[mcp] ${h.nombre} falló`, err);
                await deps.auditar({ herramienta: h.nombre, args, ok: false, error: err instanceof Error ? err.message : String(err) });
                // Un error de herramienta va como resultado, para que el modelo lo lea y corrija.
                return ok(m.id, { content: [{ type: 'text', text: mensaje }], isError: true });
            }
        }
        default:
            return error(m.id, -32601, `Método no soportado: ${m.method}`);
    }
}

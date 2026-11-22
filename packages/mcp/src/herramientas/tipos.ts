import type { Firestore } from 'firebase-admin/firestore';

/**
 * La capa de herramientas del corpus (diseño §2.6). Cada herramienta declara
 * si lee o escribe y qué alcance de OAuth exige; el servidor MCP solo publica
 * las que el token autoriza. En A9 todas leen (`corpus:read`).
 */
export interface Contexto {
    /** El usuario dueño del token: toda lectura es de SU biblioteca y SUS trabajos. */
    uid: string;
    /** El cliente OAuth que llama (Claude Desktop), para la auditoría. */
    clienteId: string;
    db: Firestore;
    /** La clave de Gemini para los vectores de la búsqueda. */
    geminiKey: string | null;
}

export type Alcance = 'corpus:read';

export interface Herramienta {
    nombre: string;
    /** Lo que lee el cliente MCP para decidir cuándo usarla. */
    descripcion: string;
    /** JSON Schema de los argumentos. */
    esquema: Record<string, unknown>;
    modo: 'lee';
    alcance: Alcance;
    ejecutar(args: Record<string, unknown>, ctx: Contexto): Promise<Resultado>;
}

export interface Resultado {
    /** Lo que se devuelve al cliente (JSON legible o texto). */
    texto: string;
    /** Para la auditoría: los libros y las hojas que se leyeron. */
    leido?: { resourceId: string; hojas?: number[]; seccion?: string }[];
}

/** Un error que se le puede decir al usuario tal cual (argumento malo, cupo, no encontrado). */
export class ErrorDeHerramienta extends Error {
    constructor(mensaje: string) {
        super(mensaje);
        this.name = 'ErrorDeHerramienta';
    }
}

/** JSON legible para el cliente. */
export function comoJson(datos: unknown): string {
    return JSON.stringify(datos, null, 2);
}

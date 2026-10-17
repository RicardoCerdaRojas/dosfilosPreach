import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, where, type Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * «Consultar» la biblioteca (fase «biblioteca consultable», U3): el
 * transporte del callable `consultarBiblioteca` y el historial guardado en
 * `library_consultations`. La capa web no importa Firebase directamente.
 */

export type AlcanceDeConsulta =
    | { tipo: 'todo' }
    | { tipo: 'libros'; ids: string[] };

/** Una fuente citada en una respuesta: la marca `[F3]` del texto apunta a la de `n: 3`. */
export interface FuenteDeConsulta {
    n: number;
    resourceId: string;
    titulo: string;
    autor: string;
    /** La hoja del PDF; la página impresa la pone la pantalla con la numeración del libro. */
    hoja: number | null;
    seccion: string;
    extracto: string;
}

export interface TurnoDeConsulta {
    pregunta: string;
    respuesta: string;
    fuentes: FuenteDeConsulta[];
    creado: Date;
    /** U6: el pasaje que nombra la pregunta («Santiago 3:13»): la respuesta va por autor. */
    pasaje?: string;
}

export interface ConsultaGuardada {
    id: string;
    /** Una conversación («Preguntar») o una búsqueda de temas guardada. */
    tipo: 'preguntar' | 'temas';
    titulo: string;
    alcance: AlcanceDeConsulta;
    turnos: TurnoDeConsulta[];
    /** Sólo en una búsqueda de temas: lo que se buscó y lo que se encontró. */
    temas?: { consulta: string; libros: LibroDelTema[]; reordenado: boolean };
    actualizada: Date;
}

/** El asistente tarda: el callable tiene 120 s, más el viaje. */
const TIMEOUT_MS = 130_000;
/** Las consultas que se muestran en el historial. */
const HISTORIAL = 50;

export async function consultarBiblioteca(entrada: {
    pregunta: string;
    alcance?: AlcanceDeConsulta;
    consultaId?: string | null;
}): Promise<{ consultaId: string; turno: TurnoDeConsulta }> {
    const callable = httpsCallable<
        { pregunta: string; alcance?: AlcanceDeConsulta; consultaId?: string },
        { consultaId: string; turno: Omit<TurnoDeConsulta, 'creado'> & { creado: string } }
    >(getFunctions(), 'consultarBiblioteca', { timeout: TIMEOUT_MS });
    const res = await callable({
        pregunta: entrada.pregunta,
        ...(entrada.consultaId ? { consultaId: entrada.consultaId } : { alcance: entrada.alcance }),
    });
    return { consultaId: res.data.consultaId, turno: { ...res.data.turno, creado: new Date(res.data.turno.creado) } };
}

const fecha = (v: unknown): Date => (v && typeof (v as Timestamp).toDate === 'function' ? (v as Timestamp).toDate() : new Date(String(v ?? 0)));

function aConsulta(id: string, d: Record<string, unknown>): ConsultaGuardada {
    const turnos = Array.isArray(d.turnos) ? d.turnos as Array<Record<string, unknown>> : [];
    const temas = d.temas as { consulta?: unknown; libros?: unknown; reordenado?: unknown } | undefined;
    return {
        id,
        tipo: d.tipo === 'temas' ? 'temas' : 'preguntar',
        titulo: String(d.titulo ?? ''),
        alcance: (d.alcance as AlcanceDeConsulta) ?? { tipo: 'todo' },
        turnos: turnos.map(t => ({
            pregunta: String(t.pregunta ?? ''),
            respuesta: String(t.respuesta ?? ''),
            fuentes: Array.isArray(t.fuentes) ? t.fuentes as FuenteDeConsulta[] : [],
            creado: fecha(t.creado),
            ...(typeof t.pasaje === 'string' && t.pasaje ? { pasaje: t.pasaje } : {}),
        })),
        ...(d.tipo === 'temas' && temas ? {
            temas: {
                consulta: String(temas.consulta ?? ''),
                libros: Array.isArray(temas.libros) ? temas.libros as LibroDelTema[] : [],
                reordenado: temas.reordenado !== false,
            },
        } : {}),
        actualizada: fecha(d.actualizada),
    };
}

/** El historial del usuario, de la más reciente a la más vieja, en vivo. */
export function escucharConsultas(
    userId: string,
    alCambiar: (consultas: ConsultaGuardada[]) => void,
    alFallar?: (err: Error) => void,
): () => void {
    const q = query(
        collection(db, 'library_consultations'),
        where('userId', '==', userId),
        orderBy('actualizada', 'desc'),
        limit(HISTORIAL),
    );
    return onSnapshot(
        q,
        snap => alCambiar(snap.docs.map(s => aConsulta(s.id, s.data()))),
        err => alFallar?.(err),
    );
}

export async function borrarConsulta(id: string): Promise<void> {
    await deleteDoc(doc(db, 'library_consultations', id));
}

/** Una hoja donde se habla del tema buscado (U5). */
export interface HojaDelTema {
    hoja: number | null;
    seccion: string;
    extracto: string;
    score: number;
    /** 0–10, del reordenador; ausente en búsquedas guardadas antes del rediseño. */
    pertinencia?: number | null;
}

export interface LibroDelTema {
    resourceId: string;
    titulo: string;
    autor: string;
    hojas: HojaDelTema[];
}

/**
 * «Buscar temas»: dónde se habla de algo en la biblioteca, sin respuesta
 * redactada. `reordenado: false` cuando no se pudo ordenar por pertinencia y
 * queda el orden aproximado de los vectores.
 */
export async function buscarTemasEnBiblioteca(consulta: string, alcance: AlcanceDeConsulta): Promise<{ libros: LibroDelTema[]; reordenado: boolean; consultaId: string | null }> {
    const callable = httpsCallable<{ consulta: string; alcance: AlcanceDeConsulta }, { libros: LibroDelTema[]; reordenado?: boolean; consultaId?: string | null }>(
        getFunctions(), 'buscarTemasEnBiblioteca', { timeout: 70_000 },
    );
    const r = (await callable({ consulta, alcance })).data;
    return { libros: r.libros, reordenado: r.reordenado !== false, consultaId: r.consultaId ?? null };
}

// ── U7: resúmenes breves ──

/**
 * Qué resumir: el mapa del libro (sin leerlo entero), el capítulo donde está
 * una hoja, o un tramo de hasta 60 hojas.
 */
export type PedidoDeResumen =
    | { resourceId: string; tipo: 'mapa' }
    | { resourceId: string; tipo: 'seccion'; hoja: number }
    | { resourceId: string; tipo: 'paginas'; desde: number; hasta: number };

export interface ResumenDeLibro {
    tipo: 'mapa' | 'seccion' | 'paginas';
    desde: number | null;
    hasta: number | null;
    /** El título de la sección resumida, si es una. */
    titulo: string | null;
    resumen: string;
    /** Temas (mapa) o ideas principales (tramo), con sus hojas. */
    puntos: Array<{ texto: string; hojas: number[] }>;
    /** Ya estaba guardado: no costó ni contó. */
    guardado: boolean;
    /** Contó, pero no se pudo guardar: volver a pedirlo cuesta otra vez. */
    sinGuardar?: boolean;
}

/** U7: el resumen breve de un libro o de un tramo (cada uno nuevo cuenta como una consulta). */
export async function resumirEnBiblioteca(pedido: PedidoDeResumen): Promise<ResumenDeLibro> {
    // El mismo pedido en curso no sale dos veces: cerrar y volver a abrir el
    // mapa mientras se arma cobraba dos resúmenes (revisión adversarial).
    const clave = JSON.stringify(pedido);
    const enCurso = resumenesEnCurso.get(clave);
    if (enCurso) return enCurso;
    const callable = httpsCallable<PedidoDeResumen, ResumenDeLibro>(getFunctions(), 'resumirEnBiblioteca', { timeout: TIMEOUT_MS });
    const promesa = callable(pedido).then(r => r.data).finally(() => resumenesEnCurso.delete(clave));
    resumenesEnCurso.set(clave, promesa);
    return promesa;
}

const resumenesEnCurso = new Map<string, Promise<ResumenDeLibro>>();

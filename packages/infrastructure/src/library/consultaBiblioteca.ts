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
}

export interface ConsultaGuardada {
    id: string;
    titulo: string;
    alcance: AlcanceDeConsulta;
    turnos: TurnoDeConsulta[];
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
    return {
        id,
        titulo: String(d.titulo ?? ''),
        alcance: (d.alcance as AlcanceDeConsulta) ?? { tipo: 'todo' },
        turnos: turnos.map(t => ({
            pregunta: String(t.pregunta ?? ''),
            respuesta: String(t.respuesta ?? ''),
            fuentes: Array.isArray(t.fuentes) ? t.fuentes as FuenteDeConsulta[] : [],
            creado: fecha(t.creado),
        })),
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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    borrarConsulta,
    consultarBiblioteca,
    escucharConsultas,
    type AlcanceDeConsulta,
    type ConsultaGuardada,
} from '@dosfilos/infrastructure';

/** Lo que se está preguntando: se muestra mientras el asistente responde. */
export interface PreguntaEnCurso {
    consultaId: string | null;
    pregunta: string;
}

/**
 * El historial de consultas (en vivo) y el envío de preguntas (fase
 * «biblioteca consultable», U3). La respuesta llega por el callable y también
 * por el historial; se muestra la del callable al instante para no esperar
 * al snapshot.
 */
export function useConsultas(userId: string | null | undefined) {
    const [consultas, setConsultas] = useState<ConsultaGuardada[]>([]);
    const [cargando, setCargando] = useState(true);
    const [enCurso, setEnCurso] = useState<PreguntaEnCurso | null>(null);
    const [error, setError] = useState<string | null>(null);
    /** El historial no se pudo leer (p. ej. el índice todavía se está creando): se dice. */
    const [errorHistorial, setErrorHistorial] = useState(false);
    const enviando = useRef(false);
    /**
     * Consultas NUEVAS que ya respondió el callable y todavía no llegaron por
     * el historial. El servidor guarda antes de responder, así que es un
     * instante; sin esto, la pantalla quedaría en blanco ese instante.
     */
    const [recientes, setRecientes] = useState<Record<string, ConsultaGuardada>>({});

    useEffect(() => {
        if (!userId) { setConsultas([]); setCargando(false); return; }
        setCargando(true);
        return escucharConsultas(userId, lista => {
            setConsultas(lista);
            setCargando(false);
            setErrorHistorial(false);
            // Una consulta nueva que ya llegó por el historial deja de ser «reciente».
            setRecientes(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => !lista.some(c => c.id === id))));
        }, () => { setCargando(false); setErrorHistorial(true); });
    }, [userId]);

    const preguntar = useCallback(async (pregunta: string, destino: { consultaId: string } | { alcance: AlcanceDeConsulta }): Promise<string | null> => {
        // Una pregunta a la vez: el botón se deshabilita, pero un Enter doble no.
        if (enviando.current) return null;
        enviando.current = true;
        const consultaId = 'consultaId' in destino ? destino.consultaId : null;
        setEnCurso({ consultaId, pregunta });
        setError(null);
        try {
            const r = await consultarBiblioteca({ pregunta, ...('alcance' in destino ? { alcance: destino.alcance } : { consultaId }) });
            // Una consulta nueva puede llegar antes por el callable que por el historial.
            if (!consultaId && 'alcance' in destino) {
                setRecientes(prev => ({ ...prev, [r.consultaId]: {
                    id: r.consultaId, tipo: 'preguntar', titulo: pregunta, alcance: destino.alcance, turnos: [r.turno], actualizada: r.turno.creado,
                } }));
            }
            return r.consultaId;
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : String(err);
            setError(mensaje);
            return null;
        } finally {
            enviando.current = false;
            setEnCurso(null);
        }
    }, []);

    const borrar = useCallback(async (id: string) => {
        await borrarConsulta(id);
    }, []);

    return { consultas, cargando, errorHistorial, enCurso, error, limpiarError: () => setError(null), recientes, preguntar, borrar };
}

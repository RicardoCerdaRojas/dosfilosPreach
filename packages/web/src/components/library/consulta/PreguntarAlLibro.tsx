import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Loader2, SendHorizontal } from 'lucide-react';
import { consultarBiblioteca, type FuenteDeConsulta, type TurnoDeConsulta } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { RespuestaConCitas } from './RespuestaConCitas';
import type { EtiquetarFuente } from './citasDeRespuesta';

/**
 * «Preguntar a este libro» dentro del visor ampliado (fase «biblioteca
 * consultable», U4). El mismo motor de la pestaña «Consultar», con el libro
 * abierto como alcance; las citas llevan el visor a su hoja sin cerrarlo. La
 * conversación queda en el historial de la Biblioteca.
 */
export function PreguntarAlLibro({ resourceId, etiquetar, onIrAHoja }: {
    resourceId: string;
    /** Cómo se cita una fuente: la regla del «Copiar la cita» del visor. */
    etiquetar: EtiquetarFuente;
    onIrAHoja: (hoja: number) => void;
}) {
    const { t } = useTranslation('library');
    const [consultaId, setConsultaId] = useState<string | null>(null);
    const [turnos, setTurnos] = useState<TurnoDeConsulta[]>([]);
    const [texto, setTexto] = useState('');
    const [enCurso, setEnCurso] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const finRef = useRef<HTMLDivElement>(null);

    // Otro libro, otra conversación.
    useEffect(() => { setConsultaId(null); setTurnos([]); setTexto(''); setError(null); }, [resourceId]);
    useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turnos.length, enCurso]);

    const enviar = async (e?: FormEvent) => {
        e?.preventDefault();
        const pregunta = texto.trim();
        if (!pregunta || enCurso) return;
        setTexto('');
        setEnCurso(pregunta);
        setError(null);
        try {
            const r = await consultarBiblioteca(consultaId
                ? { pregunta, consultaId }
                : { pregunta, alcance: { tipo: 'libros', ids: [resourceId] } });
            setConsultaId(r.consultaId);
            setTurnos(prev => [...prev, r.turno]);
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : String(err);
            // Los errores del servidor vienen en español; los de transporte («internal»), no.
            setError(/\s/.test(mensaje) ? mensaje : t('consult.errorGeneric'));
            setTexto(pregunta);
        } finally {
            setEnCurso(null);
        }
    };
    const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Las flechas del visor hojean: acá se escribe.
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); }
    };
    const ir = (f: FuenteDeConsulta) => { if (f.hoja) onIrAHoja(f.hoja); };

    return (
        <div className="flex h-full min-h-0 flex-col" data-testid="preguntar-al-libro">
            <div className="flex-1 space-y-6 overflow-y-auto p-3">
                {turnos.length === 0 && !enCurso && (
                    <p className="text-sm text-muted-foreground">{t('consult.bookIntro')}</p>
                )}
                {turnos.map((turno, i) => (
                    <article key={i} className="space-y-2">
                        <h3 className="text-sm font-semibold text-foreground">{turno.pregunta}</h3>
                        <RespuestaConCitas turno={turno} etiquetar={etiquetar} onAbrirFuente={ir} compacta />
                    </article>
                ))}
                {enCurso && (
                    <article className="space-y-2" aria-live="polite">
                        <h3 className="text-sm font-semibold text-foreground">{enCurso}</h3>
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t('consult.searchingBook')}
                        </p>
                    </article>
                )}
                {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
                <div ref={finRef} />
            </div>
            <form onSubmit={e => void enviar(e)} className="border-t border-border p-2">
                <div className="flex items-end gap-2 rounded-md border border-border bg-card p-1.5 focus-within:ring-2 focus-within:ring-ring">
                    <label htmlFor={`pregunta-libro-${resourceId}`} className="sr-only">{t('consult.placeholderBook')}</label>
                    <textarea
                        id={`pregunta-libro-${resourceId}`}
                        value={texto}
                        onChange={e => setTexto(e.target.value)}
                        onKeyDown={alTeclear}
                        rows={2}
                        maxLength={2000}
                        placeholder={turnos.length > 0 ? t('consult.placeholderFollowUp') : t('consult.placeholderBook')}
                        className="min-h-[2.75rem] flex-1 resize-none bg-transparent px-1.5 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={!texto.trim() || !!enCurso}
                        aria-label={t('consult.send')}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {enCurso ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                    </button>
                </div>
            </form>
        </div>
    );
}

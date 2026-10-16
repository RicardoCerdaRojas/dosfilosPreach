import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Loader2, MessageSquarePlus, Search, SendHorizontal, Trash2 } from 'lucide-react';
import type { LibraryResourceEntity } from '@dosfilos/domain';
import type { AlcanceDeConsulta, ConsultaGuardada, FuenteDeConsulta } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { useFirebase } from '@/context/firebase-context';
import { useSourceViewer } from '@/components/exegesis/citation/SourceViewerProvider';
import { cn } from '@/lib/utils';
import { apellidoDelAutor } from '@/components/library/apellidoDelAutor';
import { RespuestaConCitas } from '@/components/library/consulta/RespuestaConCitas';
import { etiquetaDeFuente, type LibroParaCitar } from '@/components/library/consulta/etiquetaDeFuente';
import { SelectorDeAlcance, type LibroElegible } from './SelectorDeAlcance';
import { BuscarTemas } from './BuscarTemas';
import { ResultadosDeTemas } from './ResultadosDeTemas';
import { useConsultas } from './useConsultas';

/**
 * La pestaña «Consultar» de la Biblioteca (fase «biblioteca consultable»,
 * U3): preguntarle a toda la biblioteca o a unos libros, con las respuestas
 * citadas y guardadas en un historial.
 */
export function ConsultarBiblioteca({ resources, indexStatus }: {
    resources: ReadonlyArray<LibraryResourceEntity>;
    /** El estado del índice de cada libro: sólo los indexados se pueden consultar. */
    indexStatus: Readonly<Record<string, string>>;
}) {
    const { t } = useTranslation('library');
    const { user } = useFirebase();
    const visor = useSourceViewer();
    const { consultas, cargando, errorHistorial, enCurso, error, limpiarError, recientes, preguntar, borrar } = useConsultas(user?.uid);
    const [abiertaId, setAbiertaId] = useState<string | null>(null);
    // La consulta que se mira AHORA: si el pastor abre otra mientras responde,
    // la respuesta no lo saca de ahí (revisión adversarial, U3).
    const abiertaRef = useRef<string | null>(null);
    abiertaRef.current = abiertaId;
    const [alcance, setAlcance] = useState<AlcanceDeConsulta>({ tipo: 'todo' });
    const [texto, setTexto] = useState('');
    /** «Preguntar» (respuesta redactada y guardada) o «Buscar temas» (U5: dónde se habla de algo). */
    const [modo, setModo] = useState<'preguntar' | 'temas'>('preguntar');
    const finRef = useRef<HTMLDivElement>(null);

    const libros = useMemo(() => new Map<string, LibroParaCitar>(
        resources.map(r => [r.id, { author: r.author, title: r.title, pageNumbering: r.pageNumbering ?? null }]),
    ), [resources]);
    const etiquetar = useCallback((f: FuenteDeConsulta) => etiquetaDeFuente(f, libros.get(f.resourceId)), [libros]);
    const tituloDe = useCallback((f: FuenteDeConsulta) => libros.get(f.resourceId)?.title ?? f.titulo, [libros]);
    const elegibles: LibroElegible[] = useMemo(() => resources
        .filter(r => indexStatus[r.id] === 'indexed')
        .map(r => ({ id: r.id, title: r.title, author: r.author ?? '' }))
        .sort((a, b) => a.title.localeCompare(b.title)), [resources, indexStatus]);

    const abierta: ConsultaGuardada | null = abiertaId
        ? consultas.find(c => c.id === abiertaId) ?? recientes[abiertaId] ?? null
        : null;
    const esperandoAqui = !!enCurso && enCurso.consultaId === (abierta?.id ?? null);

    useEffect(() => {
        finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [abierta?.turnos.length, esperandoAqui]);

    const enviar = async (e?: FormEvent) => {
        e?.preventDefault();
        const pregunta = texto.trim();
        if (!pregunta || enCurso) return;
        setTexto('');
        const origen = abierta?.id ?? null;
        const id = await preguntar(pregunta, abierta ? { consultaId: abierta.id } : { alcance });
        if (!id) { if (abiertaRef.current === origen) setTexto(pregunta); return; }   // falló: la pregunta vuelve a la caja
        if (abiertaRef.current === origen) setAbiertaId(id);
    };
    const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); }
    };

    const abrirFuente = (f: FuenteDeConsulta) => {
        const libro = libros.get(f.resourceId);
        visor.open({
            paperId: null,
            citation: {
                sourceKey: apellidoDelAutor(libro?.author ?? f.autor) || libro?.title || f.titulo,
                page: f.hoja ?? 1,
                resourceId: f.resourceId,
                label: libro?.title ?? f.titulo,
            },
        }, 'full');
    };

    const nueva = () => { setAbiertaId(null); setTexto(''); setModo('preguntar'); limpiarError(); };
    const rotuloDeAlcance = (a: AlcanceDeConsulta) => a.tipo === 'todo'
        ? t('consult.scopeAll')
        : a.ids.length === 1 ? (libros.get(a.ids[0]!)?.title ?? t('consult.scopeBooks', { count: 1 })) : t('consult.scopeBooks', { count: a.ids.length });
    // Los errores del servidor vienen en español; los de transporte («internal»), no.
    const mensajeDeError = error && /\s/.test(error) ? error : error ? t('consult.errorGeneric') : null;

    return (
        <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
            {/* Historial */}
            <aside className="space-y-3 md:border-r md:border-border md:pr-4" aria-label={t('consult.history')}>
                <button
                    type="button"
                    onClick={nueva}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    <MessageSquarePlus className="h-4 w-4" />
                    {t('consult.new')}
                </button>
                <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('consult.history')}</h2>
                {cargando ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : errorHistorial ? (
                    <p className="text-sm text-muted-foreground">{t('consult.historyError')}</p>
                ) : consultas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('consult.historyEmpty')}</p>
                ) : (
                    <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
                        {consultas.map(c => (
                            <li key={c.id} className="group relative">
                                <button
                                    type="button"
                                    onClick={() => { setAbiertaId(c.id); setModo('preguntar'); limpiarError(); }}
                                    aria-current={c.id === abiertaId ? 'true' : undefined}
                                    className={cn(
                                        'w-full rounded-md px-2 py-2 pr-8 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        c.id === abiertaId ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                    )}
                                >
                                    <span className="line-clamp-2">
                                        {c.tipo === 'temas' && <Search className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-label={t('consult.savedTopic')} />}
                                        {c.titulo}
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{rotuloDeAlcance(c.alcance)}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { if (window.confirm(t('consult.deleteConfirm'))) { void borrar(c.id); if (c.id === abiertaId) nueva(); } }}
                                    aria-label={t('consult.delete')}
                                    className="absolute right-1 top-1.5 rounded p-1.5 text-muted-foreground hover:bg-background hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </aside>

            {/* Conversación */}
            <section className="flex min-h-[60vh] flex-col gap-6">
                {abierta?.tipo === 'temas' ? (
                    // Una búsqueda de temas guardada: se vuelve a ver tal cual, sin repetirla.
                    <div className="space-y-4" data-testid="temas-guardados">
                        <p className="text-sm text-muted-foreground">
                            {t('consult.topicSavedIn')} <span className="font-medium text-foreground">{rotuloDeAlcance(abierta.alcance)}</span>
                        </p>
                        <h3 className="text-base font-semibold text-foreground">{abierta.temas?.consulta ?? abierta.titulo}</h3>
                        {abierta.temas && !abierta.temas.reordenado && <p className="text-sm text-muted-foreground">{t('consult.topicApproximate')}</p>}
                        {abierta.temas && abierta.temas.libros.length > 0
                            ? <ResultadosDeTemas libros={abierta.temas.libros} etiquetar={etiquetar} onAbrir={abrirFuente} />
                            : <p className="text-sm text-muted-foreground">{t('consult.topicNone')}</p>}
                    </div>
                ) : abierta ? (
                    <p className="text-sm text-muted-foreground">
                        {t('consult.askingIn')} <span className="font-medium text-foreground">{rotuloDeAlcance(abierta.alcance)}</span>
                    </p>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <h2 className="font-serif text-2xl font-semibold text-foreground">{t('consult.title')}</h2>
                            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('consult.subtitle')}</p>
                        </div>
                        <div role="group" aria-label={t('consult.modeLabel')} className="inline-flex rounded-md border border-border p-0.5">
                            {(['preguntar', 'temas'] as const).map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    aria-pressed={modo === m}
                                    onClick={() => setModo(m)}
                                    className={cn(
                                        'min-h-9 rounded px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        modo === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {m === 'preguntar' ? t('consult.modeAsk') : t('consult.modeTopics')}
                                </button>
                            ))}
                        </div>
                        <SelectorDeAlcance libros={elegibles} alcance={alcance} onCambiar={setAlcance} />
                        {modo === 'temas' && <BuscarTemas alcance={alcance} etiquetar={etiquetar} onAbrir={abrirFuente} />}
                        {modo === 'preguntar' && !enCurso && (
                            <div className="flex flex-wrap gap-2">
                                {(['example1', 'example2', 'example3'] as const).map(k => (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => setTexto(t(`consult.${k}`))}
                                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-left text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <Search className="h-3.5 w-3.5 shrink-0" />
                                        {t(`consult.${k}`)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {((modo === 'preguntar' && !abierta) || (abierta && abierta.tipo !== 'temas')) && (<>
                <div className="flex-1 space-y-8">
                    {abierta?.turnos.map((turno, i) => (
                        <article key={`${abierta.id}-${i}`} className="space-y-3">
                            <h3 className="text-base font-semibold text-foreground">{turno.pregunta}</h3>
                            <RespuestaConCitas turno={turno} etiquetar={etiquetar} tituloDe={tituloDe} onAbrirFuente={abrirFuente} />
                        </article>
                    ))}
                    {esperandoAqui && enCurso && (
                        <article className="space-y-3" aria-live="polite">
                            <h3 className="text-base font-semibold text-foreground">{enCurso.pregunta}</h3>
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('consult.searching')}
                            </p>
                        </article>
                    )}
                    {mensajeDeError && (
                        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                            {mensajeDeError}
                        </p>
                    )}
                    <div ref={finRef} />
                </div>

                <form onSubmit={e => void enviar(e)} className="sticky bottom-0 bg-background pb-2 pt-2">
                    <div className="flex items-end gap-2 rounded-lg border border-border bg-card p-2 focus-within:ring-2 focus-within:ring-ring">
                        <label htmlFor="pregunta-biblioteca" className="sr-only">{t('consult.placeholder')}</label>
                        <textarea
                            id="pregunta-biblioteca"
                            value={texto}
                            onChange={e => setTexto(e.target.value)}
                            onKeyDown={alTeclear}
                            rows={2}
                            maxLength={2000}
                            placeholder={abierta ? t('consult.placeholderFollowUp') : t('consult.placeholder')}
                            className="min-h-[3rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                        <button
                            type="submit"
                            disabled={!texto.trim() || !!enCurso}
                            aria-label={t('consult.send')}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {enCurso ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                        </button>
                    </div>
                    <p className="mt-1 px-1 text-xs text-muted-foreground">{t('consult.footnote')}</p>
                </form>
                </>)}
            </section>
        </div>
    );
}

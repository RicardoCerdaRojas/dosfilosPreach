import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
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
import { BarraDeConsulta } from './BarraDeConsulta';
import { HistorialDeConsultas } from './HistorialDeConsultas';
import { FuentesDeLaConsulta } from './FuentesDeLaConsulta';
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
    /** La búsqueda de temas que se está viendo recién hecha: se marca en el historial. */
    const [temaReciente, setTemaReciente] = useState<string | null>(null);
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
        if (abiertaRef.current === origen) {
            setAbiertaId(id);
            // La caja se mueve abajo (fija) al abrirse la conversación: el foco la sigue.
            if (!origen) requestAnimationFrame(() => document.getElementById('pregunta-biblioteca')?.focus());
        }
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

    const borrarConsulta = (id: string) => {
        if (window.confirm(t('consult.deleteConfirm'))) { void borrar(id); if (id === abiertaId) nueva(); }
    };
    const abrirConsulta = (id: string) => { setAbiertaId(id); setModo('preguntar'); limpiarError(); };
    const selectorDeAlcance = <SelectorDeAlcance libros={elegibles} alcance={alcance} onCambiar={setAlcance} />;
    const caja = (
        <CajaDePregunta
            texto={texto}
            onTexto={setTexto}
            onEnviar={() => void enviar()}
            onTeclear={alTeclear}
            enviando={!!enCurso}
            placeholder={abierta ? t('consult.placeholderFollowUp') : t('consult.placeholder')}
        />
    );
    const mostrarConversacion = (modo === 'preguntar' && !abierta) || (!!abierta && abierta.tipo !== 'temas');

    return (
        <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_17rem]">
            <div className="order-last lg:order-none">
            <HistorialDeConsultas
                consultas={consultas}
                cargando={cargando}
                error={errorHistorial}
                actualId={abiertaId ?? (modo === 'temas' ? temaReciente : null)}
                rotuloDeAlcance={rotuloDeAlcance}
                onAbrir={abrirConsulta}
                onNueva={nueva}
                onBorrar={borrarConsulta}
            />
            </div>

            <section className="flex min-h-[60vh] min-w-0 flex-col gap-7">
                {abierta?.tipo === 'temas' ? (
                    // Una búsqueda de temas guardada: se vuelve a ver tal cual, sin repetirla.
                    <div className="flex flex-col gap-5" data-testid="temas-guardados">
                        <p className="m-0 text-[13px] text-muted-foreground">
                            {t('consult.topicSavedIn')} <span className="font-medium text-foreground">{rotuloDeAlcance(abierta.alcance)}</span>
                        </p>
                        <h3 className="m-0 font-serif text-[28px] font-bold leading-tight text-foreground">{abierta.temas?.consulta ?? abierta.titulo}</h3>
                        {abierta.temas && abierta.temas.libros.length > 0
                            // `key`: el filtro por libro es de ESTA búsqueda; otra empieza sin filtro.
                            ? <ResultadosDeTemas key={abierta.id} libros={abierta.temas.libros} etiquetar={etiquetar} onAbrir={abrirFuente} aproximado={!abierta.temas.reordenado} />
                            : <p className="text-sm text-muted-foreground">{t('consult.topicNone')}</p>}
                    </div>
                ) : abierta ? (
                    <p className="m-0 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                        {t('consult.askingIn')}
                        <span className="rounded-full border border-border bg-card px-2.5 py-0.5 font-medium text-foreground">{rotuloDeAlcance(abierta.alcance)}</span>
                    </p>
                ) : (
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <h2 className="m-0 font-serif text-[32px] font-bold leading-tight tracking-tight text-foreground">{t('consult.title')}</h2>
                            <p className="m-0 max-w-2xl font-serif text-[15px] leading-relaxed text-muted-foreground">{t('consult.subtitle')}</p>
                        </div>
                        {modo === 'temas' ? (
                            <BuscarTemas
                                alcance={alcance}
                                etiquetar={etiquetar}
                                onAbrir={abrirFuente}
                                onGuardada={setTemaReciente}
                                envoltorio={contenido => <BarraDeConsulta modo={modo} onModo={setModo} alcance={selectorDeAlcance}>{contenido}</BarraDeConsulta>}
                            />
                        ) : (
                            <div className="flex flex-col gap-3">
                                <BarraDeConsulta modo={modo} onModo={setModo} alcance={selectorDeAlcance}>{caja}</BarraDeConsulta>
                                <p className="m-0 px-1 text-xs text-muted-foreground">{t('consult.footnote')}</p>
                                {!enCurso && (
                                    <div className="flex flex-col gap-2 pt-2">
                                        <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t('consult.examplesTitle')}</span>
                                        <div className="grid gap-2 sm:grid-cols-3">
                                            {(['example1', 'example2', 'example3'] as const).map(k => (
                                                <button
                                                    key={k}
                                                    type="button"
                                                    onClick={() => setTexto(t(`consult.${k}`))}
                                                    className="rounded-xl border border-border bg-card p-3.5 text-left font-serif text-sm leading-snug text-foreground/80 transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                >
                                                    {t(`consult.${k}`)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {mostrarConversacion && (<>
                    <div className="flex flex-1 flex-col gap-9">
                        {abierta?.turnos.map((turno, i) => (
                            <article key={`${abierta.id}-${i}`} className="flex flex-col gap-3 border-b border-border/60 pb-8 last:border-0">
                                <h3 className={cn('m-0 font-serif font-bold leading-tight text-foreground', i === 0 ? 'text-[28px]' : 'text-[22px]')}>{turno.pregunta}</h3>
                                <RespuestaConCitas turno={turno} etiquetar={etiquetar} tituloDe={tituloDe} onAbrirFuente={abrirFuente} />
                            </article>
                        ))}
                        {esperandoAqui && enCurso && (
                            <article className="flex flex-col gap-3" aria-live="polite">
                                <h3 className="m-0 font-serif text-[22px] font-bold leading-tight text-foreground">{enCurso.pregunta}</h3>
                                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t('consult.searching')}
                                </p>
                            </article>
                        )}
                        {mensajeDeError && (
                            <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                                {mensajeDeError}
                            </p>
                        )}
                        <div ref={finRef} />
                    </div>

                    {abierta && (
                        <div className="sticky bottom-4 flex flex-col gap-1">
                            <div className="rounded-2xl border border-border bg-card p-1.5 shadow-[0_12px_32px_-16px_rgba(15,23,42,0.25)]">{caja}</div>
                            <p className="m-0 px-2 text-xs text-muted-foreground">{t('consult.footnote')}</p>
                        </div>
                    )}
                </>)}
            </section>

            {abierta && abierta.tipo !== 'temas' && (
                <div className="hidden xl:block">
                    <div className="sticky top-6">
                        <FuentesDeLaConsulta turnos={abierta.turnos} etiquetar={etiquetar} tituloDe={tituloDe} onAbrir={abrirFuente} />
                    </div>
                </div>
            )}
        </div>
    );
}

/** La caja de la pregunta: serif, Enter envía, Mayús + Enter salta de línea. */
function CajaDePregunta({ texto, onTexto, onEnviar, onTeclear, enviando, placeholder }: {
    texto: string;
    onTexto: (t: string) => void;
    onEnviar: () => void;
    onTeclear: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
    enviando: boolean;
    placeholder: string;
}) {
    const { t } = useTranslation('library');
    return (
        <form onSubmit={e => { e.preventDefault(); onEnviar(); }} className="flex items-end gap-2 p-1">
            <label htmlFor="pregunta-biblioteca" className="sr-only">{t('consult.placeholder')}</label>
            <textarea
                id="pregunta-biblioteca"
                value={texto}
                onChange={e => onTexto(e.target.value)}
                onKeyDown={onTeclear}
                rows={2}
                maxLength={2000}
                placeholder={placeholder}
                className="min-h-[3.25rem] flex-1 resize-none bg-transparent px-3 py-2 font-serif text-[17px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
                type="submit"
                disabled={!texto.trim() || enviando}
                aria-label={t('consult.send')}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
            </button>
        </form>
    );
}

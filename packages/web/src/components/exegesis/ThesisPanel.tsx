import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleSlash, Lightbulb, Loader2, Pencil, SearchCheck, Target, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { exegesisService } from '@dosfilos/application';
import { approvedThesisOf, type ExegeticalPaper, type PaperThesis, type ThesisProposal, type ThesisReview } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';

/** Los criterios del curso para una tesis (bitácora del TI #2, §2). */
const CRITERIOS = ['interpretive', 'covers', 'supported', 'distinguishes', 'connects', 'answers'] as const;

/**
 * La tesis del trabajo (fase «Lecciones del TI #2», etapa 3.2; B63).
 *
 * Va entre la conclusión y la introducción, que es su lugar en el orden del
 * trabajo: se formula DESPUÉS de aceptar los análisis —el método va de la
 * observación a la síntesis— y la introducción termina con ella. La escribe
 * el estudiante y la aprueba; aprobada, la conclusión la retoma y la
 * introducción la enuncia, en vez de adivinarla.
 */
export function ThesisPanel({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const guardada = paper.thesis?.text ?? '';
    const aprobada = approvedThesisOf(paper);
    const [editando, setEditando] = useState(!aprobada);
    const [texto, setTexto] = useState(guardada);
    /** De dónde salió lo que está en el campo: una propuesta elegida, o lo escrito. */
    const [origen, setOrigen] = useState<PaperThesis['origin'] | undefined>(undefined);
    const [propuestas, setPropuestas] = useState<ThesisProposal[] | null>(null);
    const [revision, setRevision] = useState<{ thesis: string; result: ThesisReview } | null>(null);
    // Solo cuando cambia lo guardado: no pisar lo que se está escribiendo.
    useEffect(() => {
        setTexto(guardada);
        setEditando(!aprobada);
    }, [guardada, aprobada]);

    const versos = paper.steps.filter(s => s.kind === 'verse');
    const aceptados = versos.filter(s => s.accepted?.canonicalAnalysis).length;
    const pendientes = versos.length - aceptados;
    const seccionesYaAceptadas = paper.steps.some(s => (s.kind === 'conclusion' || s.kind === 'introduction') && s.accepted?.markdown?.trim());

    /** Sin saldo, el servidor responde con este código: se dice así, no como un fallo cualquiera. */
    const avisarError = (err: unknown, clave: string) => {
        console.error('[exegesis] thesis advisor failed:', err);
        const sinSaldo = err instanceof Error && (err as { code?: string }).code === 'insufficient-exegesis-credits';
        toast.error(t(sinSaldo ? 'thesis.noCredits' : clave));
    };
    const proponer = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.proposeThesis.execute({ ownerId: user.uid, paperId: paper.id });
        },
        onSuccess: r => setPropuestas(r.proposals),
        onError: err => avisarError(err, 'thesis.proposeFailed'),
    });
    const revisar = useMutation({
        mutationFn: async (thesis: string) => {
            if (!user) throw new Error('No authenticated user');
            return { thesis, result: await exegesisService.reviewThesis.execute({ ownerId: user.uid, paperId: paper.id, thesis }) };
        },
        onSuccess: r => setRevision(r),
        onError: err => avisarError(err, 'thesis.reviewFailed'),
    });

    const guardar = useMutation({
        mutationFn: async ({ text, approve }: { text: string; approve: boolean }) => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.setPaperThesis.execute({ ownerId: user.uid, paperId: paper.id, text, approve, ...(origen ? { origin: origen } : {}) });
        },
        onSuccess: (_r, { approve }) => {
            setOrigen(undefined);
            if (approve) { setEditando(false); setPropuestas(null); setRevision(null); }
            toast.success(t(approve ? 'thesis.approvedToast' : 'thesis.savedToast'));
            return queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
        onError: err => {
            console.error('[exegesis] save thesis failed:', err);
            toast.error(t('thesis.saveFailed'));
        },
    });

    return (
        <section aria-labelledby={`thesis-${paper.id}`} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                    <Target className="h-4 w-4 mt-0.5 text-primary" aria-hidden="true" />
                    <div>
                        <h3 id={`thesis-${paper.id}`} className="text-sm font-semibold text-foreground">{t('thesis.title')}</h3>
                        <p className="text-xs text-muted-foreground">{t('thesis.subtitle')}</p>
                    </div>
                </div>
                {aprobada && !editando && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-subtle-foreground">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />{t('thesis.approvedBadge')}
                    </span>
                )}
            </header>

            {pendientes > 0 && (
                <p className="rounded-md bg-info-subtle px-3 py-2 text-xs text-info-subtle-foreground">
                    {t('thesis.pendingVerses', { count: pendientes })}
                </p>
            )}

            {aprobada && !editando ? (
                <div className="space-y-2">
                    <blockquote className="border-l-2 border-primary pl-3 text-sm leading-relaxed text-foreground">{aprobada}</blockquote>
                    {seccionesYaAceptadas && (
                        <p className="text-xs text-muted-foreground">{t('thesis.regenerateNote')}</p>
                    )}
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditando(true)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />{t('thesis.edit')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-2">
                    <label htmlFor={`thesis-text-${paper.id}`} className="sr-only">{t('thesis.title')}</label>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button" size="sm" variant="outline"
                            disabled={proponer.isPending || aceptados === 0}
                            onClick={() => proponer.mutate()}
                        >
                            {proponer.isPending
                                ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                                : <Lightbulb className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />}
                            {t(proponer.isPending ? 'thesis.proposing' : 'thesis.propose')}
                        </Button>
                        <Button
                            type="button" size="sm" variant="outline"
                            disabled={revisar.isPending || !texto.trim() || aceptados === 0}
                            onClick={() => revisar.mutate(texto.trim())}
                        >
                            {revisar.isPending
                                ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                                : <SearchCheck className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />}
                            {t(revisar.isPending ? 'thesis.reviewing' : 'thesis.review')}
                        </Button>
                    </div>
                    {propuestas && propuestas.length > 0 && (
                        <ol className="space-y-2" aria-label={t('thesis.proposalsTitle')}>
                            {propuestas.map((p, i) => (
                                <li key={i} className="rounded-lg border border-border px-3 py-2 space-y-1.5">
                                    <p className="text-sm leading-relaxed text-foreground">{p.thesis}</p>
                                    {p.support.length > 0 && (
                                        <details className="text-xs text-muted-foreground">
                                            <summary className="cursor-pointer select-none">{t('thesis.support')}</summary>
                                            <ul className="mt-1 space-y-1 pl-3">
                                                {p.support.map((s, j) => <li key={j}><span className="font-medium text-foreground">{s.verse}:</span> {s.evidence}</li>)}
                                            </ul>
                                        </details>
                                    )}
                                    <Button type="button" size="sm" variant="ghost" onClick={() => { setTexto(p.thesis); setOrigen('proposed'); setRevision(null); }}>
                                        {t('thesis.useProposal')}
                                    </Button>
                                </li>
                            ))}
                        </ol>
                    )}
                    <textarea
                        id={`thesis-text-${paper.id}`}
                        value={texto}
                        onChange={e => { setTexto(e.target.value); if (origen === 'proposed') setOrigen('edited'); }}
                        rows={3}
                        maxLength={800}
                        placeholder={t('thesis.placeholder')}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    />
                    {revision && revision.thesis === texto.trim() && (
                        <div className="space-y-2 rounded-lg border border-border px-3 py-2" role="status">
                            <p className="text-xs font-semibold text-foreground">{t('thesis.reviewTitle')}</p>
                            <ul className="space-y-1">
                                {revision.result.criteria.map(c => (
                                    <li key={c.criterion} className="flex items-start gap-2 text-xs">
                                        {c.verdict === 'cumple'
                                            ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-success" aria-label={t('thesis.verdict.cumple')} />
                                            : c.verdict === 'no-cumple'
                                                ? <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" aria-label={t('thesis.verdict.no-cumple')} />
                                                : <CircleSlash className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" aria-label={t('thesis.verdict.no-aplica')} />}
                                        <span>
                                            <span className="font-medium text-foreground">{t(`thesis.criteria.${c.criterion}`)}</span>
                                            {c.reason && <span className="block text-muted-foreground">{c.reason}</span>}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            {revision.result.suggestion && (
                                <div className="space-y-1 rounded-md bg-info-subtle px-3 py-2">
                                    <p className="text-xs font-medium text-info-subtle-foreground">{t('thesis.suggestion')}</p>
                                    <p className="text-sm leading-relaxed text-foreground">{revision.result.suggestion}</p>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => { setTexto(revision.result.suggestion!); setOrigen('proposed'); setRevision(null); }}>
                                        {t('thesis.useSuggestion')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                    <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer select-none">{t('thesis.criteriaTitle')}</summary>
                        <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
                            {CRITERIOS.map(c => <li key={c}>{t(`thesis.criteria.${c}`)}</li>)}
                        </ol>
                    </details>
                    <div className="flex flex-wrap justify-end gap-2">
                        {aprobada && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => { setTexto(guardada); setEditando(false); }}>
                                {t('thesis.cancel')}
                            </Button>
                        )}
                        <Button
                            type="button" size="sm" variant="outline"
                            disabled={guardar.isPending || texto.trim() === guardada.trim()}
                            onClick={() => guardar.mutate({ text: texto, approve: false })}
                        >
                            {t('thesis.saveDraft')}
                        </Button>
                        <Button
                            type="button" size="sm"
                            disabled={guardar.isPending || !texto.trim()}
                            onClick={() => guardar.mutate({ text: texto, approve: true })}
                        >
                            {guardar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />}
                            {t('thesis.approve')}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    extractedBibliographyCandidates,
    sameWork,
    type BibleBookId,
    type ExtractedCourseBibliography,
    type ProjectBibliographyEntry,
    type SourceType,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { campo } from './BibliographyEntryEditor';
import type { ImportPlan } from './useProjectBibliography';

type RecursoLike = { id: string; title: string; author?: string | null; exegeticalType?: SourceType | null; coversBibleBooks?: ReadonlyArray<BibleBookId>; scope?: string | null };

/** Lo que la revisión necesita saber del proyecto para ordenar lo leído. */
export interface ImportReviewContext {
    library: ReadonlyArray<RecursoLike>;
    existing: ReadonlyArray<ProjectBibliographyEntry>;
    /** Los capítulos de los estudios que nombra un título. */
    mentions: (title: string) => Array<{ bookId: BibleBookId; chapter: number }>;
    /** Los tipos de fuente que algún requisito pide y todavía no se cumplen. */
    unmetTypes: ReadonlySet<SourceType>;
}

type Grupo = 'required' | 'gap' | 'passage' | 'library' | 'rest' | 'already';
const GRUPOS: Grupo[] = ['required', 'gap', 'passage', 'library', 'rest', 'already'];

interface BibliographyImportReviewProps {
    result: ExtractedCourseBibliography;
    label: string;
    local: boolean;
    context: ImportReviewContext;
    onCancel: () => void;
    onConfirm: (plan: ImportPlan) => Promise<void>;
}

/**
 * La revisión de una importación (etapa 2b): no una lista, el PLAN.
 *   1. Lo que pide el curso (si era un encargo): sus requisitos.
 *   2. Lo que manda leer: las obligatorias.
 *   3. El repertorio ordenado por prioridad de conseguir: lo que llena un
 *      requisito que falta, lo que nombra los pasajes de tus estudios, lo
 *      que ya tienes, el resto.
 *   4. Lo que ya está en tu lista, al final y desmarcado: marcarlo solo
 *      completa esa ficha (origen, peso, páginas), no agrega otra.
 * Lo demás viene marcado y se puede desmarcar. Nada se guarda hasta confirmar.
 */
export function BibliographyImportReview({ result, label, local, context, onCancel, onConfirm }: BibliographyImportReviewProps) {
    const { t } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    const encargo = result.documentKind !== 'bibliography';
    const [reqFuera, setReqFuera] = useState<ReadonlySet<number>>(new Set());
    const [textos, setTextos] = useState({ requirements: true, prohibitions: true });
    const [citadaPor, setCitadaPor] = useState('');
    const [guardando, setGuardando] = useState(false);

    const filas = useMemo(() => {
        const candidatas = extractedBibliographyCandidates(result.entries, context.library as never);
        return result.entries.map((e, i) => {
            const c = candidatas[i]!;
            const tipo = c.sourceType ?? e.sourceType ?? null;
            // El mismo criterio que la mezcla: la candidata, con su libro si lo tiene.
            const yaEsta = context.existing.some(x => (c.resourceId && x.resourceId === c.resourceId) || sameWork(x, c));
            const pasajes = context.mentions(e.title);
            const llena = !!tipo && context.unmetTypes.has(tipo);
            const grupo: Grupo = yaEsta ? 'already' : encargo && e.requirement === 'required' ? 'required' : llena ? 'gap' : pasajes.length ? 'passage' : c.resourceId ? 'library' : 'rest';
            return { i, e, tipo, enBiblioteca: !!c.resourceId, yaEsta, pasajes, llena, grupo, obligatoria: encargo && e.requirement === 'required' };
        });
    }, [result.entries, context, encargo]);
    // Lo que ya está en la lista empieza desmarcado.
    const [fuera, setFuera] = useState<ReadonlySet<number>>(() => new Set(filas.filter(f => f.yaEsta).map(f => f.i)));

    const alternar = (set: (f: (s: ReadonlySet<number>) => ReadonlySet<number>) => void, i: number) =>
        set(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

    const elegidas = filas.filter(f => !fuera.has(f.i));
    const requisitos = encargo ? (result.requirementItems ?? []).filter((_, i) => !reqFuera.has(i)) : [];
    const nuevas = elegidas.filter(f => !f.yaEsta).length;
    const completan = elegidas.length - nuevas;
    const conTextos = {
        requirements: encargo && textos.requirements ? result.requirements : null,
        prohibitions: encargo && textos.prohibitions ? result.prohibitions : null,
    };
    const hayAlgo = elegidas.length > 0 || requisitos.length > 0 || !!conTextos.requirements?.trim() || !!conTextos.prohibitions?.trim();
    const cuenta = (pred: (f: typeof filas[number]) => boolean) => filas.filter(pred).length;

    const confirmar = async () => {
        setGuardando(true);
        try {
            const origen: ImportPlan['origin'] = encargo
                ? { kind: 'syllabus' }
                : citadaPor.trim() ? { kind: 'citation', citedBy: citadaPor.trim() } : { kind: 'import' };
            await onConfirm({
                entries: elegidas.map(f => f.e),
                requirementItems: requisitos,
                requirementsText: conTextos.requirements,
                prohibitionsText: conTextos.prohibitions,
                origin: origen,
                logKind: encargo ? 'syllabus' : local ? 'file' : 'bibliography',
                label,
                found: filas.length,
            });
        } catch (err) {
            console.error('[projects] apply import failed:', err);
            toast.error(t('stateOfArt.saveFailed'));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <section className="rounded-lg border border-border bg-card p-3 space-y-4" aria-labelledby="bib-review-title">
            <header className="space-y-1">
                <h3 id="bib-review-title" className="text-sm font-semibold text-foreground">
                    {t(encargo ? 'stateOfArt.review.titleAssignment' : 'stateOfArt.review.titleBibliography', { label })}
                </h3>
                <p className="text-xs text-foreground">
                    {t('stateOfArt.review.summary', {
                        count: filas.length,
                        required: cuenta(f => f.grupo === 'required'),
                        library: cuenta(f => f.enBiblioteca),
                        already: cuenta(f => f.yaEsta),
                        gap: cuenta(f => f.llena),
                    })}
                </p>
                {/* El documento era tan largo que la respuesta se cortó: se
                    rescató lo que entró entero y se dice desde dónde seguir. */}
                {result.truncated && (
                    <p role="status" className="rounded-md border border-warning-subtle-foreground/40 bg-warning-subtle px-2 py-1.5 text-xs text-warning-subtle-foreground">
                        {t('stateOfArt.review.truncated', { count: filas.length, after: result.truncatedAfter ?? '—' })}
                    </p>
                )}
            </header>

            {encargo && (result.requirementItems?.length ?? 0) > 0 && (
                <fieldset className="space-y-1">
                    <legend className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{t('stateOfArt.review.requirements')}</legend>
                    {result.requirementItems!.map((r, i) => (
                        <label key={i} className="flex items-start gap-2 text-sm text-foreground">
                            <input type="checkbox" className="mt-1" checked={!reqFuera.has(i)} onChange={() => alternar(setReqFuera, i)} />
                            <span>{r.text}<span className="block text-[11px] text-muted-foreground">{t(`stateOfArt.requirement.kind.${r.kind}`)}</span></span>
                        </label>
                    ))}
                </fieldset>
            )}

            {encargo && (result.requirements?.trim() || result.prohibitions?.trim()) && (
                <fieldset className="space-y-1">
                    <legend className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{t('stateOfArt.review.courseTexts')}</legend>
                    {(['requirements', 'prohibitions'] as const).filter(k => result[k]?.trim()).map(k => (
                        <label key={k} className="flex items-start gap-2 text-sm text-foreground">
                            <input type="checkbox" className="mt-1" checked={textos[k]} onChange={() => setTextos(x => ({ ...x, [k]: !x[k] }))} />
                            <span>
                                <span className="block text-[11px] text-muted-foreground">{t(`stateOfArt.review.${k}Text`)}</span>
                                <span className="block whitespace-pre-line">{result[k]}</span>
                            </span>
                        </label>
                    ))}
                </fieldset>
            )}

            {!encargo && (
                <label className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{t('stateOfArt.review.citedBy')}</span>
                    <input className={campo} value={citadaPor} onChange={e => setCitadaPor(e.target.value)} placeholder={t('stateOfArt.review.citedByPlaceholder')} />
                </label>
            )}

            {GRUPOS.map(g => {
                const del = filas.filter(f => f.grupo === g);
                if (del.length === 0) return null;
                return (
                    <fieldset key={g} className="space-y-1">
                        <legend className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{t(`stateOfArt.review.group.${g}`)} · {del.length}</legend>
                        <ul className="space-y-1">
                            {del.map(f => (
                                <li key={f.i}>
                                    <label className="flex items-start gap-2 text-sm text-foreground">
                                        <input type="checkbox" className="mt-1" checked={!fuera.has(f.i)} onChange={() => alternar(setFuera, f.i)} />
                                        <span className="min-w-0">
                                            <span className="block">{f.e.title}</span>
                                            <span className="block text-[11px] text-muted-foreground">
                                                {[f.e.author, f.e.year, f.tipo ? tx(`sourceTypes.${f.tipo}.label`) : null].filter(Boolean).join(' · ')}
                                            </span>
                                            <span className="flex flex-wrap gap-1 pt-0.5">
                                                {f.obligatoria && f.grupo !== 'required' && <Etiqueta>{t('stateOfArt.weight.required')}</Etiqueta>}
                                                {f.enBiblioteca && <Etiqueta>{t('stateOfArt.availability.in-library')}</Etiqueta>}
                                                {f.yaEsta && <Etiqueta>{t('stateOfArt.review.already')}</Etiqueta>}
                                                {f.pasajes.map(p => <Etiqueta key={`${p.bookId}${p.chapter}`}>{t('stateOfArt.review.mentions', { chapter: p.chapter })}</Etiqueta>)}
                                                {f.llena && <Etiqueta>{t('stateOfArt.review.fillsGap')}</Etiqueta>}
                                            </span>
                                        </span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </fieldset>
                );
            })}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button size="sm" onClick={confirmar} disabled={guardando || !hayAlgo}>
                    {guardando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {t('stateOfArt.review.confirm')}
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancel} disabled={guardando}>{t('stateOfArt.review.cancel')}</Button>
                <span className="text-xs text-foreground" aria-live="polite">
                    {[
                        t('stateOfArt.review.willAddWorks', { count: nuevas }),
                        completan > 0 ? t('stateOfArt.review.willUpdate', { count: completan }) : null,
                        encargo ? t('stateOfArt.review.willAddRequirements', { count: requisitos.length }) : null,
                    ].filter(Boolean).join(' · ')}
                </span>
                <span className="text-[11px] text-muted-foreground">{t('stateOfArt.review.saveHint')}</span>
            </div>
        </section>
    );
}

function Etiqueta({ children }: { children: React.ReactNode }) {
    return <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-foreground">{children}</span>;
}

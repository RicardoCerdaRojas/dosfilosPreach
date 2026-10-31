import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heading, Lightbulb, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { exegesisService } from '@dosfilos/application';
import { formatPassageReference, type ExegeticalPaper } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';

/**
 * Los títulos temáticos de los versículos (fase «Lecciones del TI #2», etapa
 * 3.4; B68e): uno por versículo, como el TI #1 entregado —«El pastor que
 * restaura y guía (v. 3)»—. «Proponer títulos» los sugiere desde la tesis
 * aprobada y los análisis; el estudiante los edita y los guarda. El Word los
 * imprime donde el ensamble dice la referencia.
 */
export function SectionTitlesPanel({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const versos = useMemo(
        () => paper.steps.filter(s => s.kind === 'verse' && s.verseRef).sort((a, b) => a.order - b.order),
        [paper.steps],
    );
    const guardados = paper.sectionTitles ?? {};
    const claveGuardados = JSON.stringify(guardados);
    const [borrador, setBorrador] = useState<Record<string, string>>(guardados);
    // Solo cuando cambia lo guardado: no pisar lo que se está escribiendo.
    useEffect(() => { setBorrador(JSON.parse(claveGuardados) as Record<string, string>); }, [claveGuardados]);
    const aceptados = versos.filter(s => s.accepted?.canonicalAnalysis).length;
    const sinCambios = versos.every(s => (borrador[s.id] ?? '').trim() === (guardados[s.id] ?? '').trim());

    const proponer = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.proposeHeadings.execute({ ownerId: user.uid, paperId: paper.id });
        },
        // La propuesta llena los campos vacíos y los que no se tocaron; lo escrito a mano se respeta.
        onSuccess: r => setBorrador(b => {
            const nuevo = { ...b };
            for (const [id, titulo] of Object.entries(r.headings)) {
                if (!(b[id] ?? '').trim() || (b[id] ?? '').trim() === (guardados[id] ?? '').trim()) nuevo[id] = titulo;
            }
            return nuevo;
        }),
        onError: err => {
            console.error('[exegesis] propose headings failed:', err);
            const sinSaldo = err instanceof Error && (err as { code?: string }).code === 'insufficient-exegesis-credits';
            toast.error(t(sinSaldo ? 'thesis.noCredits' : 'sectionTitles.proposeFailed'));
        },
    });
    const guardar = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.setSectionTitles.execute({ ownerId: user.uid, paperId: paper.id, titles: borrador });
        },
        onSuccess: () => {
            toast.success(t('sectionTitles.savedToast'));
            return queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
        onError: err => {
            console.error('[exegesis] save section titles failed:', err);
            toast.error(t('sectionTitles.saveFailed'));
        },
    });

    if (versos.length === 0) return null;
    return (
        <section aria-labelledby={`titles-${paper.id}`} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <header className="flex items-start gap-2">
                <Heading className="h-4 w-4 mt-0.5 text-primary" aria-hidden="true" />
                <div>
                    <h3 id={`titles-${paper.id}`} className="text-sm font-semibold text-foreground">{t('sectionTitles.title')}</h3>
                    <p className="text-xs text-muted-foreground">{t('sectionTitles.subtitle')}</p>
                </div>
            </header>
            <ul className="space-y-2">
                {versos.map(s => {
                    const etiqueta = formatPassageReference(s.verseRef!, paper.displayLanguage);
                    return (
                        <li key={s.id} className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:items-center">
                            <label htmlFor={`title-${s.id}`} className="text-xs font-medium text-muted-foreground">{etiqueta}</label>
                            <input
                                id={`title-${s.id}`}
                                value={borrador[s.id] ?? ''}
                                onChange={e => setBorrador(b => ({ ...b, [s.id]: e.target.value }))}
                                maxLength={160}
                                placeholder={t('sectionTitles.placeholder', { label: etiqueta })}
                                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                            />
                        </li>
                    );
                })}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" size="sm" variant="outline" disabled={proponer.isPending || aceptados === 0} onClick={() => proponer.mutate()}>
                    {proponer.isPending
                        ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                        : <Lightbulb className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />}
                    {t(proponer.isPending ? 'sectionTitles.proposing' : 'sectionTitles.propose')}
                </Button>
                <Button type="button" size="sm" disabled={guardar.isPending || sinCambios} onClick={() => guardar.mutate()}>
                    {guardar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />}
                    {t('sectionTitles.save')}
                </Button>
            </div>
        </section>
    );
}

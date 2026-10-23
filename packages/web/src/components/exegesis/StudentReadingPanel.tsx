import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { exegesisService } from '@dosfilos/application';
import { observationCitationAlerts, type CanonicalVerseAnalysis, type ExegeticalMethod, type ProjectSource } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/context/firebase-context';
import { useTranslation } from '@/i18n';

interface StudentReadingPanelProps {
    paperId: string;
    stepId: string;
    initial: string | null | undefined;
    method: ExegeticalMethod | null | undefined;
}

/**
 * «Mi lectura» (etapa 2, capa 3): la observación propia del estudiante,
 * escrita ANTES de generar. Opcional. Entra en la misma llamada del análisis,
 * y el diálogo con los comentarios tiene que decir quién la confirma y quién
 * la discute. Es donde el orden de Fee —primero tu exégesis— se cumple en
 * quien estudia.
 */
export function StudentReadingPanel({ paperId, stepId, initial, method }: StudentReadingPanelProps) {
    const { t } = useTranslation('exegesis');
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const guardada = (initial ?? '').trim();
    const [texto, setTexto] = useState(guardada);
    useEffect(() => setTexto(guardada), [guardada]);
    const guardar = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.updateStepStudentReading.execute({ ownerId: user.uid, paperId, stepId, studentReading: texto });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] }),
        onError: err => {
            console.error('[exegesis] save student reading failed:', err);
            toast.error(t('studentReading.saveFailed'));
        },
    });
    const sinCambios = texto.trim() === guardada;
    const id = `student-reading-${stepId}`;
    // Abierta al entrar si ya hay una lectura; después la abre y cierra quien estudia.
    const [abierta] = useState(!!guardada);

    return (
        <details className="mb-3 rounded-lg border border-border bg-card px-3 py-2" open={abierta || undefined}>
            <summary className="cursor-pointer text-sm font-medium text-foreground">
                <span className="inline-flex items-center gap-1.5 align-middle"><PenLine className="h-3.5 w-3.5 text-muted-foreground" />{t('studentReading.title')}</span>
            </summary>
            <div className="mt-2 space-y-2">
                <label htmlFor={id} className="block text-xs text-muted-foreground">
                    {t(method === 'exegetical' || method === 'mixed' ? 'studentReading.hintMethod' : 'studentReading.hint')}
                </label>
                <textarea
                    id={id}
                    rows={3}
                    value={texto}
                    maxLength={2000}
                    onChange={e => setTexto(e.target.value)}
                    // Se guarda también al salir del campo: si no, quien escribe y
                    // pulsa «Analizar» genera sin su lectura.
                    onBlur={() => { if (!sinCambios && !guardar.isPending) guardar.mutate(); }}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => guardar.mutate()} disabled={sinCambios || guardar.isPending}>
                        {guardar.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{t('studentReading.save')}
                    </Button>
                    {!sinCambios && !guardar.isPending && <span className="text-[11px] text-warning-subtle-foreground">{t('studentReading.unsaved')}</span>}
                </div>
            </div>
        </details>
    );
}

/**
 * El control fijo del método: comentarios citados en las piezas de la
 * observación. Informa; no bloquea ni cambia nada.
 */
export function ObservationCitationNotice({ analysis, sources, method }: {
    analysis: CanonicalVerseAnalysis;
    sources: ReadonlyArray<Pick<ProjectSource, 'citationKey' | 'sourceType'>>;
    method: ExegeticalMethod | null | undefined;
}) {
    const { t } = useTranslation('exegesis');
    const alertas = observationCitationAlerts(analysis, sources, method);
    if (alertas.length === 0) return null;
    return (
        <div className="mb-3 rounded-lg border border-warning/40 bg-warning-subtle px-3 py-2" role="status">
            <p className="text-xs font-medium text-warning-subtle-foreground">{t('observationCheck.title')}</p>
            <ul className="mt-1 space-y-0.5">
                {alertas.map(a => (
                    <li key={`${a.field}-${a.sourceKey}`} className="text-xs text-warning-subtle-foreground">
                        {t('observationCheck.item', { source: a.sourceKey, field: t(`observationCheck.field.${a.field}`) })}
                    </li>
                ))}
            </ul>
            <p className="mt-1 text-[11px] text-warning-subtle-foreground">{t('observationCheck.hint')}</p>
        </div>
    );
}

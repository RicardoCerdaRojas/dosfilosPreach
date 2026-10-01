import { useMemo, useState } from 'react';
import { Lightbulb, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
    ASSIGNMENT_BRIEF_MAX_CHARS,
    briefGaps,
    buildPreachingBrief,
    buildSourcesAndFormatBlock,
    parseBriefQuestions,
    previousDelivery,
    type ExegeticalPaper,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { AssignmentBriefPicker } from './AssignmentBriefPicker';
import { evaluarEdicionDelEncuadre } from './edicionDelEncuadre';

/**
 * El encuadre del trabajo, a la vista desde cualquier pestaña de la
 * configuración, y editable.
 *
 * Antes solo existía en la página de creación: después de crear el trabajo no
 * había dónde leerlo ni corregirlo, aunque el asistente lo usa en cada paso
 * (el caso de uso `updatePaperBrief` existía desde #76 sin ninguna pantalla
 * que lo llamara). Vive fuera de las pestañas para que un borrador a medio
 * escribir sobreviva al cambio de pestaña.
 *
 * Es un botón del encabezado, como la portada, que abre un modal amplio para
 * leerlo entero y editarlo. Se probó como panel lateral (columna angosta con
 * su propio scroll) y como tarjeta sobre las pestañas (empujaba el contenido):
 * el botón dice cuántas preguntas trae, que es lo que se consulta de un
 * vistazo, y deja la página entera para la configuración.
 */
interface PaperBriefButtonProps {
    paper: ExegeticalPaper;
}

export function PaperBriefButton({ paper }: PaperBriefButtonProps) {
    const { t } = useTranslation('exegesis');
    const { updatePaperBrief, papers } = useExegesisPapers();
    const [abierto, setAbierto] = useState(false);
    const [borrador, setBorrador] = useState<string | null>(null);

    const editando = borrador !== null;
    const actual = paper.assignmentBrief?.trim() ?? '';
    /**
     * Qué le falta al encuadre para que el sistema pueda trabajar con él.
     *
     * Se mira el borrador mientras se edita y el guardado cuando no: la
     * carencia importa en los dos momentos, y esperar a guardar para avisar es
     * avisar tarde.
     */
    const carencias = useMemo(() => briefGaps(editando ? borrador : actual), [editando, borrador, actual]);
    const edicion = editando ? evaluarEdicionDelEncuadre(paper.assignmentBrief, borrador) : null;
    const guardando = updatePaperBrief.isPending;

    const guardar = async () => {
        if (edicion?.tipo !== 'listo') return;
        try {
            await updatePaperBrief.mutateAsync({ paperId: paper.id, assignmentBrief: edicion.valor });
            toast.success(t('paperSetup.brief.saved'));
            setBorrador(null);
            setAbierto(false);
        } catch (err) {
            console.error('[exegesis] no se pudo guardar el encuadre:', err);
            toast.error(t('paperSetup.brief.saveFailed'));
        }
    };

    const preguntas = useMemo(() => parseBriefQuestions(actual).length, [actual]);
    const abrir = () => {
        setAbierto(true);
        // Sin encuadre no hay nada que leer: se abre directo para escribirlo.
        if (!actual) setBorrador('');
    };
    const cerrar = () => {
        if (guardando) return;
        setAbierto(false);
        setBorrador(null);
    };

    return (
        <>
            <Button type="button" size="sm" variant="outline" onClick={abrir} className="gap-1.5">
                <Lightbulb className="h-3.5 w-3.5" />
                {t('paperSetup.brief.button')}
                {!actual
                    ? <span className="text-[11px] text-warning-subtle-foreground">· {t('paperSetup.brief.missing')}</span>
                    : preguntas > 0
                        ? <span className="text-[11px] text-muted-foreground">· {t('paperSetup.brief.questionCount', { count: preguntas })}</span>
                        : null}
            </Button>
            <Dialog open={abierto} onOpenChange={(v) => { if (!v) cerrar(); }}>
                <DialogContent
                    className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"
                    // Editando, un clic fuera no descarta un borrador de mil caracteres.
                    onInteractOutside={(e) => { if (editando) e.preventDefault(); }}
                >
                    <DialogHeader>
                        <DialogTitle>{t('paperSetup.brief.heading')}</DialogTitle>
                        <DialogDescription>{t('paperSetup.brief.description')}</DialogDescription>
                    </DialogHeader>
                    {!editando && (
                        <div className="space-y-3">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{actual}</p>
                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setBorrador(paper.assignmentBrief ?? '')}
                                    className="gap-1.5 text-xs"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    {t('paperSetup.brief.edit')}
                                </Button>
                            </div>
                        </div>
                    )}
                    {editando && (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <AssignmentBriefPicker currentBody={borrador} onApply={setBorrador} />
                                {/* La plantilla del sistema para una serie expositiva.
                                    El bloque de fuentes llega ESCRITO —qué libro
                                    translitera, cuál se citó la vez pasada, qué tipo
                                    ancla— porque son cosas que el sistema ya midió y
                                    pedirlas a mano es hacerle al autor el trabajo de la
                                    máquina. En blanco queda sólo el bloque de
                                    preguntas, que es el acto exegético.
                                    Se ofrece sobre lienzo vacío para no pisar nada. */}
                                {!borrador?.trim() && (
                                    <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]"
                                        onClick={() => setBorrador(buildPreachingBrief(
                                            buildSourcesAndFormatBlock(paper, previousDelivery(papers, paper.id)),
                                        ))}>
                                        {t('paperSetup.brief.gaps.usePreachingTemplate')}
                                    </Button>
                                )}
                            </div>
                            <label htmlFor="paper-brief-editor" className="sr-only">{t('paperSetup.brief.heading')}</label>
                            <textarea
                                id="paper-brief-editor"
                                value={borrador}
                                onChange={e => setBorrador(e.target.value)}
                                rows={18}
                                disabled={guardando}
                                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                <span className={edicion?.tipo === 'excedido' ? 'text-destructive' : 'text-muted-foreground'}>
                                    {edicion?.tipo === 'excedido'
                                        ? t('paperSetup.brief.tooLong', { count: edicion.sobran })
                                        : t('create.brief.characterCount', { count: borrador.trim().length, max: ASSIGNMENT_BRIEF_MAX_CHARS })}
                                </span>
                                {paper.steps.length > 0 && (
                                    <span className="text-muted-foreground">{t('paperSetup.brief.appliesFromNow')}</span>
                                )}
                            </div>
                            {/* Cada carencia nombra una pieza que sin ella trabaja a
                                medias y en silencio. No es revisión de estilo. */}
                            {carencias.length > 0 && (
                                <div className="rounded-md border border-warning/30 bg-warning-subtle/40 px-3 py-2 space-y-1">
                                    <p className="text-[11px] font-medium text-warning-subtle-foreground">
                                        {t('paperSetup.brief.gaps.gapTitle')}
                                    </p>
                                    {carencias.map(g => (
                                        <p key={g} className="text-[11px] text-warning-subtle-foreground">
                                            {t(`paperSetup.brief.gaps.${g}`)}
                                        </p>
                                    ))}
                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <Button type="button" size="sm" variant="ghost" onClick={() => (actual ? setBorrador(null) : cerrar())} disabled={guardando}>
                                    {t('paperSetup.brief.cancel')}
                                </Button>
                                <Button type="button" size="sm" onClick={guardar} disabled={edicion?.tipo !== 'listo' || guardando}>
                                    {guardando && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                    {t('paperSetup.brief.save')}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

import { useEffect, useState } from 'react';
import { courseGuideCandidates, GUIDE_RULE_TEXT_MAX, projectWorkTypes, type AIProject, type DeskPatternRow } from '@dosfilos/domain';
import type { AddRuleToStyleGuideErrorCode } from '@dosfilos/application';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { useCourseRecordActions } from '@/hooks/faculty/useCourseRecordActions';
import { useUserStyleGuides } from '@/hooks/exegesis/useUserStyleGuides';
import { FIELD, TOUCH } from './courseDeskFormat';

interface CourseGuideRuleDialogProps {
    project: AIProject;
    pattern: DeskPatternRow | null;
    /** Los tipos de trabajo de las entregas donde aparece el patrón (para ofrecer su guía). */
    workTypeIds: ReadonlyArray<string>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * «Pasar a tu guía» (§9.1): la corrección que se repite pasa a la guía que
 * leen el analizador y el revisor de prosa del trabajo siguiente. El texto
 * de la regla lo escribe o lo confirma el estudiante (empieza con el nombre
 * que él le dio al patrón; aquí no se redacta por él). La guía destino: la
 * del tipo de trabajo o la del curso.
 */
export function CourseGuideRuleDialog({ project, pattern, workTypeIds, open, onOpenChange }: CourseGuideRuleDialogProps) {
    const { t } = useTranslation('projectDeskCourse');
    const { guides } = useUserStyleGuides();
    const { addRuleToGuide } = useCourseRecordActions();
    const candidatas = courseGuideCandidates(project, workTypeIds.length ? workTypeIds : undefined);
    // Sin candidatas para esos tipos (otra guía por tipo), se ofrecen todas las del curso.
    const opciones = candidatas.length ? candidatas : courseGuideCandidates(project);
    const tipos = new Map(projectWorkTypes(project).map(w => [w.id, w.label]));
    const [ruleText, setRuleText] = useState('');
    const [guideId, setGuideId] = useState('');

    useEffect(() => {
        if (!open || !pattern) return;
        setRuleText(pattern.name);
        setGuideId(opciones[0]?.guideId ?? '');
        // Solo al abrir.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, pattern?.patternId]);

    if (!pattern) return null;
    const nombreGuia = (id: string) => guides.find(g => g.id === id)?.displayName ?? t('guideRule.unnamedGuide');
    const rotulo = (c: (typeof opciones)[number]) => {
        const para = c.workTypeIds.map(id => tipos.get(id)).filter(Boolean).join(', ');
        return c.source === 'course'
            ? t('guideRule.optionCourse', { name: nombreGuia(c.guideId) })
            : t('guideRule.optionWorkType', { name: nombreGuia(c.guideId), types: para });
    };

    const confirmar = async () => {
        try {
            const r = await addRuleToGuide.mutateAsync({ projectId: project.id, patternId: pattern.patternId, guideId, ruleText: ruleText.trim() });
            toast.success(t(r.added ? 'guideRule.added' : 'guideRule.already'));
            onOpenChange(false);
        } catch (err) {
            console.error('[projects] add rule to guide failed:', err);
            const code = errorCode(err);
            toast.error(t(code ? `guideRule.errors.${code}` : 'toast.saveFailed'));
        }
    };
    const pending = addRuleToGuide.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-reading">{t('guideRule.title', { name: pattern.name })}</DialogTitle>
                    <DialogDescription>{t('guideRule.hint')}</DialogDescription>
                </DialogHeader>
                {opciones.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('guideRule.noGuide')}</p>
                ) : (
                    <div className="space-y-3">
                        <label className="block space-y-1">
                            <span className="text-xs text-muted-foreground">{t('guideRule.ruleText')}</span>
                            <textarea
                                className={`${FIELD} min-h-24 resize-y`}
                                rows={4}
                                value={ruleText}
                                maxLength={GUIDE_RULE_TEXT_MAX}
                                onChange={e => setRuleText(e.target.value)}
                            />
                            <span className="block text-[11px] text-muted-foreground">{t('guideRule.ruleTextHint')}</span>
                        </label>
                        <label className="block space-y-1">
                            <span className="text-xs text-muted-foreground">{t('guideRule.guide')}</span>
                            <select className={FIELD} value={guideId} onChange={e => setGuideId(e.target.value)}>
                                {opciones.map(c => <option key={c.guideId} value={c.guideId}>{rotulo(c)}</option>)}
                            </select>
                        </label>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="ghost" className={TOUCH} onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
                    {opciones.length > 0 && (
                        <Button className={TOUCH} onClick={() => void confirmar()} disabled={pending || !ruleText.trim() || !guideId}>
                            {t('guideRule.confirm')}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const CODIGOS: ReadonlySet<AddRuleToStyleGuideErrorCode> = new Set([
    'empty-rule', 'rule-too-long', 'project-unavailable', 'pattern-not-found', 'guide-not-found', 'guide-without-manifest', 'guide-full',
]);

/**
 * El código estable de `AddRuleToStyleGuideError`, leído por forma y no con
 * `instanceof`: importar la clase arrastraría todos los servicios de la capa
 * de aplicación a este componente.
 */
function errorCode(err: unknown): AddRuleToStyleGuideErrorCode | null {
    const code = (err as { code?: unknown } | null)?.code;
    return typeof code === 'string' && CODIGOS.has(code as AddRuleToStyleGuideErrorCode) ? code as AddRuleToStyleGuideErrorCode : null;
}

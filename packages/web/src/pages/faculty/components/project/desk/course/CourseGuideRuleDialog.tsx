import { useEffect, useId, useState } from 'react';
import { courseGuideCandidates, GUIDE_RULE_TEXT_MAX, normalizeGuideRule, projectWorkTypes, type AIProject, type DeskPatternRow } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { useUserStyleGuides } from '@/hooks/exegesis/useUserStyleGuides';
import { cn } from '@/lib/utils';
import { DIALOG, DIALOG_BODY, DIALOG_FOOTER, DIALOG_HEADER, FIELD, TOUCH } from './courseDeskFormat';
import type { AddRuleInput } from './useCourseOps';

interface CourseGuideRuleDialogProps {
    project: AIProject;
    pattern: DeskPatternRow | null;
    /** Los tipos de trabajo de las entregas donde aparece el patrón (para ofrecer su guía). */
    workTypeIds: ReadonlyArray<string>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Escribe la regla en la guía (la espera única del escritorio); `true` si quedó. */
    onConfirm: (input: AddRuleInput) => Promise<boolean>;
    saving: boolean;
}

/**
 * «Pasar a tu guía» (§9.1): la corrección que se repite pasa a la guía que
 * leen el análisis y la revisión antes de entregar del trabajo siguiente. La
 * regla la escribe el estudiante, como instrucción para sí mismo: el nombre
 * del patrón va de ejemplo en el campo (no como valor) y una regla igual al
 * nombre no se acepta, porque «cierre doble» no dice qué hacer. La guía
 * destino: la del tipo de trabajo o la del curso.
 */
export function CourseGuideRuleDialog({ project, pattern, workTypeIds, open, onOpenChange, onConfirm, saving }: CourseGuideRuleDialogProps) {
    const { t } = useTranslation('projectDeskCourse');
    const ids = useId();
    const { guides } = useUserStyleGuides();
    const candidatas = courseGuideCandidates(project, workTypeIds.length ? workTypeIds : undefined);
    // Sin candidatas para esos tipos (otra guía por tipo), se ofrecen todas las del curso.
    const opciones = candidatas.length ? candidatas : courseGuideCandidates(project);
    const tipos = new Map(projectWorkTypes(project).map(w => [w.id, w.label]));
    const [ruleText, setRuleText] = useState('');
    const [guideId, setGuideId] = useState('');

    useEffect(() => {
        if (!open || !pattern) return;
        setRuleText('');
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
    const texto = ruleText.trim();
    const igualAlNombre = !!texto && normalizeGuideRule(texto) === normalizeGuideRule(pattern.name);

    const confirmar = async () => {
        if (await onConfirm({ patternId: pattern.patternId, guideId, ruleText: texto })) onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn(DIALOG, 'sm:max-w-lg')}>
                <DialogHeader className={DIALOG_HEADER}>
                    <DialogTitle className="font-reading">{t('guideRule.title', { name: pattern.name })}</DialogTitle>
                    <DialogDescription>{t('guideRule.hint')}</DialogDescription>
                </DialogHeader>
                <div className={cn(DIALOG_BODY, 'space-y-3')}>
                    {opciones.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('guideRule.noGuide')}</p>
                    ) : (
                        <>
                            <label className="block space-y-1">
                                <span className="text-xs text-muted-foreground">{t('guideRule.ruleText')}</span>
                                <textarea
                                    className={`${FIELD} min-h-24 resize-y`}
                                    rows={4}
                                    value={ruleText}
                                    maxLength={GUIDE_RULE_TEXT_MAX}
                                    placeholder={pattern.name}
                                    onChange={e => setRuleText(e.target.value)}
                                    aria-describedby={`${ids}-hint`}
                                    aria-invalid={igualAlNombre || undefined}
                                />
                                <span id={`${ids}-hint`} className={cn('block text-[11px]', igualAlNombre ? 'font-medium text-warning-subtle-foreground' : 'text-muted-foreground')}>
                                    {t(igualAlNombre ? 'guideRule.sameAsName' : 'guideRule.ruleTextHint')}
                                </span>
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs text-muted-foreground">{t('guideRule.guide')}</span>
                                <select className={FIELD} value={guideId} onChange={e => setGuideId(e.target.value)}>
                                    {opciones.map(c => <option key={c.guideId} value={c.guideId}>{rotulo(c)}</option>)}
                                </select>
                            </label>
                        </>
                    )}
                </div>
                <DialogFooter className={DIALOG_FOOTER}>
                    <Button variant="ghost" className={TOUCH} onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
                    {opciones.length > 0 && (
                        <Button className={TOUCH} onClick={() => void confirmar()} disabled={saving || !texto || igualAlNombre || !guideId}>
                            {t('guideRule.confirm')}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

import { useState } from 'react';
import { Bookmark, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { WORK_PROFILE_NAME_MAX_CHARS, type ExegeticalPaper } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { useSaveWorkProfile, useWorkProfiles } from '@/hooks/exegesis/useWorkProfiles';

/**
 * Guarda cómo quedó configurado este trabajo, para el siguiente del curso.
 *
 * Es un botón del encabezado que abre el formulario en un diálogo. Antes era
 * una tarjeta pegada a las pestañas del asistente, sin espacio entre ellas, y
 * el fundador no la había descubierto: nunca creó un perfil.
 *
 * Se ofrece desde el trabajo y no desde un formulario aparte porque es el
 * único momento en que la configuración existe y está probada: el
 * estudiante acaba de usarla. Pedirle que la reescriba en otro sitio es
 * pedirle que la recuerde —y un curso con tres trabajos se configura tres
 * veces, cada vez un poco distinto—.
 */
export function SaveWorkProfileButton({ paper, rubricTemplateId, briefTemplateId }: {
    paper: ExegeticalPaper;
    rubricTemplateId?: string | null;
    briefTemplateId?: string | null;
}) {
    const { t } = useTranslation('exegesis');
    const { profiles } = useWorkProfiles();
    const save = useSaveWorkProfile();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [course, setCourse] = useState('');

    const submit = async () => {
        try {
            await save.mutateAsync({
                paperId: paper.id,
                displayName: name,
                course: course.trim() || undefined,
                rubricTemplateId,
                briefTemplateId,
                makeDefault: profiles.length === 0,
            });
            toast.success(t('paperSetup.workProfile.saved'));
            setOpen(false);
            setName('');
            setCourse('');
        } catch (err) {
            console.error('[exegesis] no se pudo guardar el perfil:', err);
            toast.error(t('paperSetup.workProfile.saveFailed'));
        }
    };

    return (
        <>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
                <Bookmark className="h-3.5 w-3.5 mr-1.5" />
                {t('paperSetup.workProfile.cta')}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('paperSetup.workProfile.title')}</DialogTitle>
                        <DialogDescription>{t('paperSetup.workProfile.description')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <label className="block space-y-1">
                            <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                                {t('paperSetup.workProfile.nameLabel')}
                            </span>
                            <input
                                type="text"
                                value={name}
                                maxLength={WORK_PROFILE_NAME_MAX_CHARS}
                                onChange={e => setName(e.target.value)}
                                disabled={save.isPending}
                                placeholder={t('paperSetup.workProfile.namePlaceholder')}
                                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                            />
                        </label>
                        <label className="block space-y-1">
                            <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                                {t('paperSetup.workProfile.courseLabel')}
                            </span>
                            <input
                                type="text"
                                value={course}
                                onChange={e => setCourse(e.target.value)}
                                disabled={save.isPending}
                                placeholder={t('paperSetup.workProfile.coursePlaceholder')}
                                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                            />
                        </label>
                        <p className="text-[11px] text-muted-foreground">{t('paperSetup.workProfile.whatItSaves')}</p>
                    </div>
                    <DialogFooter>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={save.isPending}>
                            {t('paperSetup.workProfile.cancel')}
                        </Button>
                        <Button type="button" size="sm" onClick={submit} disabled={save.isPending || name.trim().length < 3}>
                            {save.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            {t('paperSetup.workProfile.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

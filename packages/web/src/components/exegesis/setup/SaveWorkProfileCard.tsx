import { useState } from 'react';
import { Bookmark, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { WORK_PROFILE_NAME_MAX_CHARS, type ExegeticalPaper } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useSaveWorkProfile, useWorkProfiles } from '@/hooks/exegesis/useWorkProfiles';

/**
 * Guarda cómo quedó configurado este trabajo, para el siguiente del curso.
 *
 * Se ofrece desde el trabajo y no desde un formulario aparte porque es el
 * único momento en que la configuración existe y está probada: el
 * estudiante acaba de usarla. Pedirle que la reescriba en otro sitio es
 * pedirle que la recuerde —y un curso con tres trabajos se configura tres
 * veces, cada vez un poco distinto—.
 */
export function SaveWorkProfileCard({ paper, rubricTemplateId, briefTemplateId }: {
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
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <header className="flex items-start gap-2">
                <Bookmark className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{t('paperSetup.workProfile.title')}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('paperSetup.workProfile.description')}</p>
                </div>
                {!open && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
                        {t('paperSetup.workProfile.cta')}
                    </Button>
                )}
            </header>

            {open && (
                <div className="space-y-3 pl-6">
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
                    <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={save.isPending}>
                            {t('paperSetup.workProfile.cancel')}
                        </Button>
                        <Button type="button" size="sm" onClick={submit} disabled={save.isPending || name.trim().length < 3}>
                            {save.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            {t('paperSetup.workProfile.save')}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}

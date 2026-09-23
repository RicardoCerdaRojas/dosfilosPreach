import { useState } from 'react';
import { FileText, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PAPER_COVER_FIELDS } from '@dosfilos/domain';
import type { ExegeticalPaper, PaperCover, PaperCoverField } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';

// La lista es del dominio: el formulario y el normalizador que guarda
// tienen que recorrer los mismos campos, o el que falte se pierde al
// guardar sin decir nada.
const FIELDS = PAPER_COVER_FIELDS;

/** Lo que la portada del seminario no lleva, pero otra guía podría pedir. */
const OPCIONALES: ReadonlySet<PaperCoverField> = new Set(['course']);
type Field = PaperCoverField;

/**
 * Los datos de la portada que exige el seminario.
 *
 * No se deducen del trabajo —el seminario, el nombre y la ciudad son del
 * estudiante— y sin ellos el .docx sale sin portada. Se piden una vez por
 * trabajo, aquí, junto al encuadre: es donde vive todo lo que el sistema
 * no puede averiguar solo.
 */
export function PaperCoverPanel({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const { updatePaperCover } = useExegesisPapers();
    const [draft, setDraft] = useState<Record<Field, string> | null>(null);

    const cover = paper.cover ?? null;
    const saving = updatePaperCover.isPending;
    const editing = draft !== null;

    const start = () => setDraft(Object.fromEntries(
        FIELDS.map(f => [f, cover?.[f] ?? '']),
    ) as Record<Field, string>);

    const save = async () => {
        if (!draft) return;
        try {
            await updatePaperCover.mutateAsync({ paperId: paper.id, cover: draft as PaperCover });
            toast.success(t('paperSetup.cover.saved'));
            setDraft(null);
        } catch (err) {
            console.error('[exegesis] no se pudo guardar la portada:', err);
            toast.error(t('paperSetup.cover.saveFailed'));
        }
    };

    const filled = FIELDS.filter(f => (cover?.[f] ?? '').trim().length > 0);

    return (
        <section className="rounded-2xl border border-border bg-card p-4 mb-6 space-y-3">
            <header className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">{t('paperSetup.cover.heading')}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('paperSetup.cover.description')}</p>
                </div>
                {!editing && (
                    <Button type="button" size="sm" variant="ghost" onClick={start}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        {filled.length > 0 ? t('paperSetup.cover.edit') : t('paperSetup.cover.add')}
                    </Button>
                )}
            </header>

            {!editing && (
                filled.length > 0 ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs pl-7">
                        {filled.map(f => (
                            <div key={f} className="contents">
                                <dt className="text-muted-foreground">{t(`paperSetup.cover.fields.${f}`)}</dt>
                                <dd className="text-foreground">{cover?.[f]}</dd>
                            </div>
                        ))}
                    </dl>
                ) : (
                    <p className="text-xs text-muted-foreground pl-7">{t('paperSetup.cover.empty')}</p>
                )
            )}

            {editing && draft && (
                <div className="space-y-3 pl-7">
                    <div className="grid gap-3 sm:grid-cols-2">
                        {FIELDS.map(f => (
                            <label key={f} className="space-y-1">
                                <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                                    {t(`paperSetup.cover.fields.${f}`)}
                                    {OPCIONALES.has(f) && (
                                        <span className="ml-1.5 normal-case tracking-normal font-normal">
                                            {t('paperSetup.cover.optional')}
                                        </span>
                                    )}
                                </span>
                                <input
                                    type="text"
                                    value={draft[f]}
                                    onChange={e => setDraft({ ...draft, [f]: e.target.value })}
                                    disabled={saving}
                                    placeholder={t(`paperSetup.cover.placeholders.${f}`)}
                                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                                />
                            </label>
                        ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t('paperSetup.cover.hint')}</p>
                    <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
                            {t('paperSetup.cover.cancel')}
                        </Button>
                        <Button type="button" size="sm" onClick={save} disabled={saving}>
                            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            {t('paperSetup.cover.save')}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}

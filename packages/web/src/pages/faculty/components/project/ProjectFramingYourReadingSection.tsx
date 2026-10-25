import { Plus, X } from 'lucide-react';
import { FRAMING_GENRES, FRAMING_MAX_MOVEMENTS, FRAMING_TITLE_MAX, type FramingGenre } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { GENRE_QUESTIONS, newMovementRow } from './ProjectFramingForm';
import { Aviso, ERROR_KEY, EvidenceField, ayuda, campo, etiqueta, legend, type SectionProps } from './ProjectFramingFields';

/**
 * «Tu lectura del libro (provisoria)»: género con sus preguntas y las
 * respuestas del pastor, ocasión, movimientos, idea central y trayectoria
 * hacia Cristo, cada uno con los versículos que lo sostienen. Nada de esto
 * llega al sermón hasta que el pastor revisa su idea central.
 */
export function ProjectFramingYourReadingSection({ form, set, errores }: SectionProps) {
    const { t } = useTranslation('projects');
    const errorMovimiento = errores.find(e => e === 'movementRange' || e === 'movementVerses');
    // Las respuestas se ven con el género elegido, o si ya hay algo escrito (no se esconde lo que se guarda).
    const conRespuestas = !!(form.genre || form.genreReading.trim() || form.genreEvidence.trim());
    const fila = (key: string, cambio: { range?: string; title?: string }) =>
        set('structure', form.structure.map(x => (x.key === key ? { ...x, ...cambio } : x)));

    return (
        <fieldset className="space-y-4">
            <legend className={legend}>{t('framing.dialog.sections.yourReading')}</legend>
            <p className={ayuda}>{t('framing.dialog.yourReadingHint')}</p>

            <div className="space-y-1.5">
                <label htmlFor="framing-genre" className={etiqueta}>{t('framing.genre.label')}</label>
                <select id="framing-genre" className={cn(campo, 'sm:max-w-xs')} value={form.genre} onChange={e => set('genre', e.target.value as FramingGenre | '')}>
                    <option value="">{t('framing.genre.placeholder')}</option>
                    {FRAMING_GENRES.map(g => <option key={g} value={g}>{t(`framing.genre.names.${g}`)}</option>)}
                </select>
                {form.genre ? (
                    <div className="rounded-md border border-border px-3 py-2" data-testid="framing-genre-questions">
                        <p className="text-xs font-medium text-foreground">{t('framing.genre.questionsTitle')}</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                            {GENRE_QUESTIONS[form.genre].map(q => <li key={q}>{t(`framing.genre.questions.${form.genre}.${q}`)}</li>)}
                        </ul>
                    </div>
                ) : (
                    <span className={ayuda}>{t('framing.genre.hint')}</span>
                )}
            </div>
            {conRespuestas && <EvidenceField id="genre-reading" k="genreReading" ke="genreEvidence" label={t('framing.genre.answers')} form={form} set={set} />}

            <EvidenceField id="occasion" k="occasion" ke="occasionEvidence" label={t('framing.dialog.occasion')} form={form} set={set} />

            <div className="space-y-1.5">
                <span className={etiqueta}>{t('framing.dialog.structure')}</span>
                <span className={ayuda}>{t('framing.dialog.structureHint')}</span>
                {form.structure.length > 0 && (
                    <ol className="space-y-1.5">
                        {form.structure.map((m, i) => (
                            <li key={m.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                                <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground" aria-hidden>{i + 1}</span>
                                <input
                                    className={cn(campo, 'w-28 shrink-0')}
                                    placeholder="1-6"
                                    aria-label={t('framing.dialog.movementRange', { number: i + 1 })}
                                    aria-invalid={!!errorMovimiento && !!(m.range.trim() || m.title.trim())}
                                    value={m.range}
                                    onChange={e => fila(m.key, { range: e.target.value })}
                                />
                                <input
                                    className={cn(campo, 'min-w-[10rem] flex-1')}
                                    maxLength={FRAMING_TITLE_MAX}
                                    aria-label={t('framing.dialog.movementTitle', { number: i + 1 })}
                                    value={m.title}
                                    onChange={e => fila(m.key, { title: e.target.value })}
                                />
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="size-11 shrink-0 sm:size-9"
                                    aria-label={t('framing.dialog.removeMovement', { number: i + 1 })}
                                    onClick={() => set('structure', form.structure.filter(x => x.key !== m.key))}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </li>
                        ))}
                    </ol>
                )}
                {errorMovimiento && <Aviso role="alert">{t(ERROR_KEY[errorMovimiento])}</Aviso>}
                {form.structure.length < FRAMING_MAX_MOVEMENTS && (
                    <Button type="button" size="sm" variant="outline" className="min-h-11 sm:min-h-0" onClick={() => set('structure', [...form.structure, newMovementRow()])}>
                        <Plus className="h-3.5 w-3.5" />{t('framing.dialog.addMovement')}
                    </Button>
                )}
            </div>

            <EvidenceField id="central-idea" k="centralIdea" ke="centralIdeaEvidence" label={t('framing.dialog.centralIdea')} form={form} set={set} />
            {/* Se pide también en «estudio personal»: es teológica, no pastoral (Greidanus). */}
            <EvidenceField id="christ" k="christTrajectory" ke="christTrajectoryEvidence" label={t('framing.dialog.christTrajectory')} hint={t('framing.dialog.christTrajectoryHint')} form={form} set={set} />
        </fieldset>
    );
}

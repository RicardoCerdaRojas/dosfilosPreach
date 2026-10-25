import { FRAMING_FREQUENCIES, FRAMING_MAX_SUNDAYS, FRAMING_TEXT_MAX, type FramingFrequency } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { Aviso, ERROR_KEY, ayuda, campo, etiqueta, legend, type SectionProps } from './ProjectFramingFields';

/**
 * El propósito pastoral (Chapell; con la pregunta de control de Stott) y el
 * ritmo. A diferencia de «Tu lectura», esto SÍ llega al borrador del sermón,
 * solo para orientar la aplicación; el ritmo da las fechas, no la división.
 */
export function ProjectFramingPastoralSection({ form, set, errores }: SectionProps) {
    const { t } = useTranslation('projects');
    const chico = 'block text-xs text-muted-foreground';
    return (
        <>
            <fieldset className="space-y-3" data-testid="framing-pastoral">
                <legend className={legend}>{t('framing.dialog.sections.pastoral')}</legend>
                <p className={ayuda}>{t('framing.dialog.pastoralHint')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                        <span className={etiqueta}>{t('framing.dialog.audience')}</span>
                        <textarea rows={2} maxLength={FRAMING_TEXT_MAX} className={campo} value={form.audience} onChange={e => set('audience', e.target.value)} />
                    </label>
                    <label className="block space-y-1">
                        <span className={etiqueta}>{t('framing.dialog.need')}</span>
                        <textarea rows={2} maxLength={FRAMING_TEXT_MAX} className={campo} value={form.need} onChange={e => set('need', e.target.value)} />
                    </label>
                </div>
                <label className="block space-y-1">
                    <span className={etiqueta}>{t('framing.dialog.needEvidence')}</span>
                    <span className={ayuda}>{t('framing.dialog.needEvidenceHint')}</span>
                    <input className={campo} maxLength={FRAMING_TEXT_MAX} placeholder={t('framing.dialog.evidencePlaceholder')} value={form.needEvidence} onChange={e => set('needEvidence', e.target.value)} />
                </label>
                <label className="block space-y-1">
                    <span className={etiqueta}>{t('framing.dialog.desiredChange')}</span>
                    <textarea rows={2} maxLength={FRAMING_TEXT_MAX} className={campo} value={form.desiredChange} onChange={e => set('desiredChange', e.target.value)} />
                </label>
            </fieldset>

            <fieldset className="space-y-2" data-testid="framing-rhythm">
                <legend className={legend}>{t('framing.dialog.sections.rhythm')}</legend>
                <p className={ayuda}>{t('framing.dialog.rhythmHint')}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block space-y-1">
                        <span className={chico}>{t('framing.dialog.sundays')}</span>
                        <input type="number" inputMode="numeric" min={1} max={FRAMING_MAX_SUNDAYS} className={campo} value={form.sundays} onChange={e => set('sundays', e.target.value)} aria-invalid={errores.includes('sundays')} />
                    </label>
                    <label className="block space-y-1">
                        <span className={chico}>{t('framing.dialog.startDate')}</span>
                        {/* `type="date"` entrega YYYY-MM-DD local, sin zona horaria. */}
                        <input type="date" className={campo} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
                    </label>
                    <label className="block space-y-1">
                        <span className={chico}>{t('framing.dialog.frequency')}</span>
                        <select className={campo} value={form.frequency} onChange={e => set('frequency', e.target.value as FramingFrequency | '')}>
                            <option value="">{t('framing.dialog.frequencyNone')}</option>
                            {FRAMING_FREQUENCIES.map(f => <option key={f} value={f}>{t(`framing.frequency.${f}`)}</option>)}
                        </select>
                    </label>
                </div>
                {errores.includes('sundays') && <Aviso role="alert">{t(ERROR_KEY.sundays, { max: FRAMING_MAX_SUNDAYS })}</Aviso>}
            </fieldset>
        </>
    );
}

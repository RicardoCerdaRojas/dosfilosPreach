import type { CitationForm, LineSpacing, PageLabelStyle } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import type { FormattingDraft } from '@/lib/exegesis/rubricFormattingDraft';

const SELECT = 'rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary';

/**
 * «Maquetación del documento» del editor de la rúbrica.
 *
 * Cada campo se elige por separado: el interlineado «como la guía» ya no
 * bloquea la forma de cita ni la línea entre párrafos (ver
 * `formattingFromDraft`). El rótulo de página sólo aparece con cita entre
 * paréntesis, que es donde el sílabo lo decide.
 */
export function RubricFormattingFields({ value, onChange }: {
    value: FormattingDraft;
    onChange: (next: FormattingDraft) => void;
}) {
    const { t } = useTranslation('exegesis');
    const set = <K extends keyof FormattingDraft>(k: K, v: FormattingDraft[K]) => onChange({ ...value, [k]: v });

    return (
        <div>
            <label htmlFor="rubric-line-spacing" className="block text-xs font-medium text-foreground mb-1">
                {t('paperSetup.subSteps.rubric.metadata.formattingLabel')}
            </label>
            <div className="flex flex-wrap items-center gap-3">
                <select
                    id="rubric-line-spacing"
                    value={value.lineSpacing}
                    onChange={(e) => set('lineSpacing', e.target.value as LineSpacing | 'default')}
                    className={SELECT}
                >
                    <option value="default">{t('paperSetup.subSteps.rubric.metadata.spacingDefault')}</option>
                    <option value="single">{t('paperSetup.subSteps.rubric.metadata.spacingSingle')}</option>
                    <option value="one-and-a-half">{t('paperSetup.subSteps.rubric.metadata.spacingOneAndAHalf')}</option>
                    <option value="double">{t('paperSetup.subSteps.rubric.metadata.spacingDouble')}</option>
                </select>
                <select
                    aria-label={t('paperSetup.subSteps.rubric.metadata.citationFormAria')}
                    value={value.citationForm}
                    onChange={(e) => set('citationForm', e.target.value as CitationForm)}
                    className={SELECT}
                >
                    <option value="footnote">{t('paperSetup.subSteps.rubric.metadata.citationFootnote')}</option>
                    <option value="parenthetical">{t('paperSetup.subSteps.rubric.metadata.citationParenthetical')}</option>
                </select>
                {value.citationForm === 'parenthetical' && (
                    <select
                        aria-label={t('paperSetup.subSteps.rubric.metadata.pageLabelAria')}
                        value={value.pageLabel}
                        onChange={(e) => set('pageLabel', e.target.value as PageLabelStyle)}
                        className={SELECT}
                    >
                        <option value="labelled">{t('paperSetup.subSteps.rubric.metadata.pageLabelLabelled')}</option>
                        <option value="bare">{t('paperSetup.subSteps.rubric.metadata.pageLabelBare')}</option>
                    </select>
                )}
                <label className="inline-flex items-center gap-1.5 text-xs text-foreground">
                    <input
                        type="checkbox"
                        checked={value.blankLine}
                        onChange={(e) => set('blankLine', e.target.checked)}
                        className="rounded border-border"
                    />
                    {t('paperSetup.subSteps.rubric.metadata.blankLineLabel')}
                </label>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 italic">
                {t('paperSetup.subSteps.rubric.metadata.formattingHint')}
            </p>
        </div>
    );
}

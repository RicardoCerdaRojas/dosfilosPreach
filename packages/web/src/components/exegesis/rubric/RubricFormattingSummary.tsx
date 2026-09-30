import type { ExegeticalPaper, PaperRubric } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { useGuideCitationStandard } from '@/hooks/exegesis/useGuideCitationStandard';

function SummaryField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</dt>
            <dd className="text-foreground">{value}</dd>
        </div>
    );
}

/**
 * Estándar de cita y maquetación, tal como quedaron guardados.
 *
 * El resumen omitía los dos: mostraba «—» cuando el estándar se hereda de la
 * guía, y la maquetación —interlineado, forma de cita, línea entre párrafos—
 * no aparecía aunque estuviera guardada. El autor no podía confirmar lo que
 * había elegido sin volver a abrir el editor.
 */
export function RubricFormattingSummary({ paper, rubric }: { paper: ExegeticalPaper; rubric: PaperRubric }) {
    const { t } = useTranslation('exegesis');
    const guideStandard = useGuideCitationStandard(paper);
    const k = (key: string) => t(`paperSetup.subSteps.rubric.${key}`);

    const standard = rubric.citationStandard?.trim()
        || (guideStandard ? t('paperSetup.subSteps.rubric.summary.citationInherited', { standard: guideStandard }) : '—');

    const f = rubric.formatting;
    const maquetacion = !f
        ? k('summary.formattingDefault')
        : [
            k({ single: 'metadata.spacingSingle', 'one-and-a-half': 'metadata.spacingOneAndAHalf', double: 'metadata.spacingDouble' }[f.lineSpacing]),
            k(f.citationForm === 'parenthetical' ? 'metadata.citationParenthetical' : 'metadata.citationFootnote'),
            ...(f.citationForm === 'parenthetical' ? [k(f.pageLabel === 'bare' ? 'metadata.pageLabelBare' : 'metadata.pageLabelLabelled')] : []),
            ...(f.blankLineBetweenParagraphs ? [k('metadata.blankLineLabel')] : []),
        ].join(' · ');

    return (
        <>
            <SummaryField label={k('metadata.citationStandardLabel')} value={standard} />
            <SummaryField label={k('summary.formattingLabel')} value={maquetacion} />
        </>
    );
}

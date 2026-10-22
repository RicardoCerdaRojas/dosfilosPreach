import { useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { diagnoseCitation, type CitationEdit, type VerifiedCitation } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

/**
 * «Diagnosticar esta cita» (TP #8, fase 8b, D4): la causa de la alarma y UN
 * remedio, con reglas fijas (`diagnoseCitation`). En el TP #8 cada alarma se
 * resolvió con alguien al lado diciendo qué pasaba; esto lo dice la
 * plataforma.
 *
 * El remedio de corregir página o quitar la cita se aplica con un clic cuando
 * la cita vive en el análisis (`onCorrect`); el de anotar deja la nota escrita
 * en la revisión para que el estudiante la confirme (`onUseNote`).
 */
export function CitationDiagnosis({
    verdict,
    knownAuthors,
    onCorrect,
    onUseNote,
    isCorrecting = false,
}: {
    verdict: VerifiedCitation;
    knownAuthors: ReadonlyArray<string>;
    onCorrect?: (edit: CitationEdit) => void;
    onUseNote: (note: string) => void;
    isCorrecting?: boolean;
}) {
    const { t, i18n } = useTranslation('exegesis');
    const [abierto, setAbierto] = useState(false);
    const lang = i18n?.language?.split('-')[0] === 'en' ? 'en' : 'es';
    const diagnostico = diagnoseCitation(verdict, lang, knownAuthors);
    const base = 'canonical.review.diagnosis';

    if (!abierto) {
        return (
            <Button type="button" size="sm" variant="outline" onClick={() => setAbierto(true)} data-testid="diagnosticar-cita">
                <Stethoscope className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                {t(`${base}.cta`)}
            </Button>
        );
    }

    if (!diagnostico) {
        return <p className="text-xs text-muted-foreground" data-testid="diagnostico">{t(`${base}.none`)}</p>;
    }

    const { cause, detail, remedy } = diagnostico;
    return (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 space-y-2" data-testid="diagnostico">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{t(`${base}.title`)}</p>
            <p className="text-sm font-medium text-foreground">{t(`${base}.cause.${cause}`)}</p>
            <p className="text-xs text-foreground/85 leading-snug">{t(`${base}.explain.${cause}`, detail)}</p>
            {remedy.kind === 'correct-page' && onCorrect && (
                <Button type="button" size="sm" disabled={isCorrecting}
                    onClick={() => onCorrect({ kind: 'page', page: remedy.page, pageKind: remedy.pageKind })}>
                    {t(`${base}.remedy.correctPage`, { page: remedy.label })}
                </Button>
            )}
            {remedy.kind === 'remove' && onCorrect && (
                <Button type="button" size="sm" variant="outline" disabled={isCorrecting} onClick={() => onCorrect({ kind: 'remove' })}>
                    {t(`${base}.remedy.remove`)}
                </Button>
            )}
            {remedy.kind === 'review-with-note' && (
                <Button type="button" size="sm" variant="outline" onClick={() => onUseNote(remedy.note)}>
                    {t(`${base}.remedy.useNote`)}
                </Button>
            )}
            {/* Sin cita en el análisis (prosa) no hay corrección de un clic: la
                nota de revisión lo deja dicho. */}
            {remedy.kind !== 'review-with-note' && !onCorrect && (
                <p className="text-[11px] text-muted-foreground">{t(`${base}.manual`)}</p>
            )}
        </div>
    );
}

import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

/**
 * Una fuente citable sin páginas elegidas ni fragmentos extraídos.
 *
 * Así llegan las fuentes heredadas de la serie, a propósito: los fragmentos se
 * extraen contra el pasaje nuevo. Pero nada lo decía, y el analizador, sin
 * páginas, lee el libro entero TRUNCADO desde la primera página —portada,
 * prólogo, introducción—. En Jonás 4:5-11 (2026-10-02) ningún versículo tuvo
 * diálogo con comentaristas y la crítica textual citó la introducción de la
 * BHQ, sin un solo aviso.
 */
export function SourceSinPaginas({ paperId, sourceId }: { paperId: string; sourceId: string }) {
    const { t } = useTranslation('exegesis');
    const navigate = useNavigate();
    return (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning-subtle/40 px-3 py-2 text-[11px] text-warning-subtle-foreground">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 min-w-0">{t('paperSetup.subSteps.corpus.sinPaginas.body')}</span>
            <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => navigate(`/dashboard/exegesis/${paperId}/fuentes/${sourceId}/paginas`)}
            >
                {t('paperSetup.subSteps.corpus.sinPaginas.cta')}
            </Button>
        </div>
    );
}

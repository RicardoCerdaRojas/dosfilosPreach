import { Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCorpusHeredado } from '@/hooks/exegesis/useCorpusHeredado';
import { useTranslation } from '@/i18n';

/**
 * «Hay N fuentes en esta serie · Traerlas», en la tarjeta lateral del corpus.
 *
 * La oferta de heredar vivía sólo en Configuración → Corpus, y la tarjeta de
 * la página del trabajo decía «Sin fuentes todavía» con once esperando en la
 * serie (Jonás 4:5-11, 2026-10-01). Lleva al corpus, donde la herencia propone
 * páginas para este pasaje: traerlas desde aquí las dejaría sin páginas.
 */
export function SeriesCorpusOffer({ paperId }: { paperId: string }) {
    const { t } = useTranslation('exegesis');
    const { propuesta } = useCorpusHeredado(paperId);
    const n = propuesta.data?.fuentes.length ?? 0;
    if (n === 0) return null;

    return (
        <Link
            to={`/dashboard/exegesis/${paperId}/setup?tab=corpus`}
            className="mb-3 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-2 text-[11.5px] text-foreground hover:bg-primary/10"
        >
            <Layers className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <span>{t('detail.sources.seriesOffer', { count: n })}</span>
        </Link>
    );
}

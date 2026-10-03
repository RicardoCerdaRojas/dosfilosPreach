import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isSourceWithoutScope, type ExegeticalPaper } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

/**
 * Las fuentes citables que no dicen qué leer, a la vista de quien va a
 * analizar.
 *
 * El aviso por fuente vivía sólo en Configuración → Corpus. En Jonás 4:5-11
 * (2026-10-02) el fundador analizó tres versículos desde la página del trabajo
 * con once fuentes heredadas sin páginas, y nada en esa página lo decía.
 * Informa y enlaza; no bloquea: un trabajo viejo sin receta tiene que poder
 * seguir analizándose.
 */
export function SourcesWithoutScopeNotice({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const sinAlcance = paper.sources.filter(isSourceWithoutScope);
    if (sinAlcance.length === 0) return null;

    return (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning-subtle/40 px-3 py-2.5 text-xs text-warning-subtle-foreground">
            <p className="flex items-start gap-1.5 font-medium">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{t('detail.sourcesWithoutScope.title', { count: sinAlcance.length })}</span>
            </p>
            <ul className="mt-1.5 ml-5 flex flex-wrap gap-x-3 gap-y-1">
                {sinAlcance.map(s => (
                    <li key={s.id}>
                        <Link
                            to={`/dashboard/exegesis/${paper.id}/fuentes/${s.id}/paginas`}
                            className="underline underline-offset-2 hover:text-foreground"
                        >
                            {t('detail.sourcesWithoutScope.choose', { label: s.displayLabel })}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

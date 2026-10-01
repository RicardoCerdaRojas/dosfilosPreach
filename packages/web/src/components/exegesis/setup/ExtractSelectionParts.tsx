import { X } from 'lucide-react';
import { suggestRoleForType, type SourceRole, type SourceType } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

const ROLES: ReadonlyArray<SourceRole> = ['anchor', 'contrast', 'technical'];

/**
 * El rol dialéctico al agregar la fuente. «Según el tipo» deja que lo deduzca
 * el tipo, como antes; antes el rol no se elegía aquí y sólo se veía como
 * «· Técnica» después de agregar.
 */
export function RoleSelect({ id, sourceType, value, onChange }: {
    id: string;
    sourceType: SourceType;
    value: SourceRole | null;
    onChange: (next: SourceRole | null) => void;
}) {
    const { t } = useTranslation('exegesis');
    const sugerido = suggestRoleForType(sourceType);
    const rol = (r: SourceRole | null) => t(`paperSetup.subSteps.corpus.roles.${r ?? 'none'}`);
    return (
        <div>
            <label htmlFor={id} className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                {t('paperSetup.subSteps.corpus.extract.roleLabel')}
            </label>
            <select
                id={id}
                value={value ?? ''}
                // Elegir el mismo rol que sugiere el tipo no es una elección:
                // se guarda como «según el tipo» y no queda marcado como
                // divergente si el tipo cambia después.
                onChange={(e) => {
                    const v = (e.target.value || null) as SourceRole | null;
                    onChange(v === sugerido ? null : v);
                }}
                className="w-full rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            >
                <option value="">{t('paperSetup.subSteps.corpus.extract.roleByType', { role: rol(sugerido) })}</option>
                {ROLES.filter(r => r !== sugerido).map(r => (
                    <option key={r} value={r}>{rol(r)}</option>
                ))}
            </select>
        </div>
    );
}

/**
 * Lo que va a agregarse, con nombre.
 *
 * El pie decía «6 recursos seleccionados · 3 reemplazarán excerpts» sin decir
 * CUÁLES, y con el buscador filtrado había selecciones que no se veían: así se
 * podía volver a agregar una fuente que se había quitado a propósito (Wallace
 * sin folios, TP Santiago 2:14-26).
 */
export function SelectedResourcesList({ items, onRemove }: {
    items: ReadonlyArray<{ id: string; label: string; willReplace: boolean }>;
    onRemove: (id: string) => void;
}) {
    const { t } = useTranslation('exegesis');
    if (items.length === 0) return null;
    return (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">
                {t('paperSetup.subSteps.corpus.extract.selectedTitle', { count: items.length })}
            </p>
            <ul className="flex flex-wrap gap-1.5">
                {items.map(it => (
                    <li key={it.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-card pl-2 pr-1 py-0.5 text-[11px] text-foreground">
                        <span className="max-w-[16rem] truncate">{it.label}</span>
                        {it.willReplace && (
                            <span className="text-warning-subtle-foreground">· {t('paperSetup.subSteps.corpus.extract.willReplace')}</span>
                        )}
                        <button
                            type="button"
                            onClick={() => onRemove(it.id)}
                            className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label={t('paperSetup.subSteps.corpus.extract.unselect', { label: it.label })}
                            title={t('paperSetup.subSteps.corpus.extract.unselect', { label: it.label })}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

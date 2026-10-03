import { useTranslation } from '@/i18n';
import { TMS_COVER_STYLE, type CoverStyle, type StyleManifestValidationIssue } from '@dosfilos/domain';
import { Switch } from '@/components/ui/switch';
import { EditorField, editorInputClasses } from './EditorField';
import { issueLabel } from './issueLabel';

interface CoverTabProps {
    /** null: la guía no dice cómo va la portada; se usa la de TMS. */
    value: CoverStyle | null;
    onChange: (next: CoverStyle | null) => void;
    issues: ReadonlyArray<StyleManifestValidationIssue>;
    disabled: boolean;
}

const RENGLONES: ReadonlyArray<keyof CoverStyle['layout']> = [
    'beforeInstitution', 'afterInstitution', 'afterTitle', 'afterAuthor',
];

/**
 * Cómo se arma la portada, dentro de la guía de estilo.
 *
 * La bibliografía y las notas vivían en la guía; la portada, cableada en el
 * exportador con el modelo de TMS. Aquí se ve y se cambia: renglones en
 * blanco entre bloques, mayúsculas y la palabra antes del autor. Los DATOS
 * (seminario, autor, título) siguen en la portada de cada trabajo.
 */
export function CoverTab({ value, onChange, issues, disabled }: CoverTabProps) {
    const { t } = useTranslation('exegesis');
    const propia = value !== null;
    const estilo = value ?? TMS_COVER_STYLE;

    return (
        <div className="space-y-4">
            <p className="text-[11px] text-muted-foreground leading-snug">
                {t('directory.styleGuides.editor.cover.intro')}
            </p>

            <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground">{t('directory.styleGuides.editor.cover.enabledLabel')}</p>
                    <p className="text-[10.5px] text-muted-foreground">{t('directory.styleGuides.editor.cover.enabledHint')}</p>
                </div>
                <Switch
                    checked={propia}
                    onCheckedChange={(on) => onChange(on ? { ...TMS_COVER_STYLE, layout: { ...TMS_COVER_STYLE.layout } } : null)}
                    disabled={disabled}
                />
            </div>

            {propia && value && (
                <div className="space-y-4 rounded-md border border-border bg-card p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {RENGLONES.map(campo => (
                            <EditorField
                                key={campo}
                                label={t(`directory.styleGuides.editor.cover.layout.${campo}`)}
                                error={issueLabel(issues, `cover.layout.${campo}`, 'error', t)}
                            >
                                <input
                                    type="number"
                                    min={0}
                                    max={20}
                                    value={value.layout[campo]}
                                    onChange={(e) => onChange({ ...value, layout: { ...value.layout, [campo]: Number(e.target.value) } })}
                                    disabled={disabled}
                                    className={editorInputClasses}
                                />
                            </EditorField>
                        ))}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-[12px] text-foreground">{t('directory.styleGuides.editor.cover.uppercase')}</span>
                        <Switch checked={value.uppercase} onCheckedChange={(on) => onChange({ ...value, uppercase: on })} disabled={disabled} />
                    </div>
                    <EditorField
                        label={t('directory.styleGuides.editor.cover.byLine')}
                        hint={t('directory.styleGuides.editor.cover.byLineHint')}
                        fullWidth
                    >
                        <input
                            type="text"
                            value={value.byLine}
                            onChange={(e) => onChange({ ...value, byLine: e.target.value })}
                            disabled={disabled}
                            className={editorInputClasses}
                        />
                    </EditorField>
                </div>
            )}

            {!propia && (
                <p className="text-[11px] text-muted-foreground">
                    {t('directory.styleGuides.editor.cover.usingTms', {
                        before: estilo.layout.beforeInstitution, institution: estilo.layout.afterInstitution,
                        title: estilo.layout.afterTitle, author: estilo.layout.afterAuthor,
                    })}
                </p>
            )}
        </div>
    );
}

import { Monitor, Moon, Sun, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/components/theme-provider';
import { useCambiarIdioma } from '@/i18n/hooks/useCambiarIdioma';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n/types';

/**
 * Idioma y tema en un solo botón de la barra (fase «barra única»): antes eran
 * un selector de idioma y tres botones de tema siempre a la vista.
 */
export function PreferenciasDeVista() {
    const { t } = useTranslation('common');
    const { theme, setTheme } = useTheme();
    const { language, handleLanguageChange } = useCambiarIdioma();
    const temas = [
        { id: 'light', icono: Sun, rotulo: t('preferences.light') },
        { id: 'dark', icono: Moon, rotulo: t('preferences.dark') },
        { id: 'system', icono: Monitor, rotulo: t('preferences.system') },
    ] as const;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('preferences.title')} title={t('preferences.title')}>
                    <SlidersHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{t('preferences.theme')}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={theme} onValueChange={v => setTheme(v as typeof theme)}>
                    {temas.map(({ id, icono: Icono, rotulo }) => (
                        <DropdownMenuRadioItem key={id} value={id} className="gap-2">
                            <Icono className="h-4 w-4" />{rotulo}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t('preferences.language')}</DropdownMenuLabel>
                {/* Sin `supportedLngs`, el idioma detectado puede venir con región («es-419»). */}
                <DropdownMenuRadioGroup value={language.split('-')[0]} onValueChange={v => handleLanguageChange(v as SupportedLanguage)}>
                    {Object.values(SUPPORTED_LANGUAGES).map(l => (
                        <DropdownMenuRadioItem key={l.code} value={l.code} className="gap-2">
                            <span aria-hidden="true">{l.flag}</span>{l.nativeName}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

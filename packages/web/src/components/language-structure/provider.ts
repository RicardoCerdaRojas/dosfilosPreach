import { HostedLanguageStructureProvider } from '@dosfilos/infrastructure';

/**
 * Uno para toda la app: su caché por capítulo sirve a las dos páginas, a la
 * navegación ◀/▶ y al análisis hebreo, que manda las mismas filas a leer.
 */
export const languageStructureProvider = new HostedLanguageStructureProvider();

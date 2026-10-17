import { useFirebase } from '@/context/firebase-context';
import { FirebaseUserProfileRepository } from '@dosfilos/infrastructure';
import { useTranslation } from './useTranslation';
import type { SupportedLanguage } from '../types';

const userProfileRepo = new FirebaseUserProfileRepository();

/**
 * Cambia el idioma al instante y lo guarda en el perfil en segundo plano, para
 * que el servidor responda en el mismo idioma en la próxima llamada y la
 * preferencia viaje entre dispositivos. Lo comparten este selector y el menú
 * «Idioma y tema» de la barra de la app.
 */
export function useCambiarIdioma() {
  const { language, changeLanguage } = useTranslation();
  const { user } = useFirebase();
  const handleLanguageChange = (langCode: SupportedLanguage) => {
    changeLanguage(langCode);
    if (user?.uid) {
      userProfileRepo.updatePreferredLanguage(user.uid, langCode).catch((err) => {
        console.warn('[LanguageSwitcher] Failed to persist preferredLanguage:', err);
      });
    }
  };
  return { language, handleLanguageChange };
}

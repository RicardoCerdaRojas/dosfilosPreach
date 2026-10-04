/**
 * i18n Type Definitions
 * 
 * Provides type safety for internationalization.
 * Following SOLID principles: Single Responsibility - only type definitions
 */

export type SupportedLanguage = 'en' | 'es';

export interface LanguageOption {
    code: SupportedLanguage;
    name: string;
    nativeName: string;
    flag: string;
}

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageOption> = {
    en: {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇺🇸'
    },
    es: {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        flag: '🇪🇸'
    }
} as const;

export const DEFAULT_LANGUAGE: SupportedLanguage = 'es';

export const LANGUAGE_STORAGE_KEY = 'dosfilos-language' as const;

/**
 * Namespaces for organizing translations
 * Following Interface Segregation Principle - separate concerns
 */
export type TranslationNamespace =
    | 'landing'
    | 'common'
    | 'navigation'
    | 'auth'
    | 'welcome'
    | 'dashboard'
    | 'subscription'
    | 'sermons'
    | 'sermonDetail'
    | 'library'
    | 'series'
    | 'planner'
    | 'generator'
    | 'greekTutor'
    | 'hebrewTutor'
    | 'faculty'
    | 'exegesis'
    | 'projects'
    | 'admin'
    | 'wordStudy'
    | 'studyDepth'
    | 'guidedSermon'
    | 'legal'
    | 'settings';


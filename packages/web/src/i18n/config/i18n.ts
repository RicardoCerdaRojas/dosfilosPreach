/**
 * i18next Configuration
 * 
 * Central configuration for internationalization system.
 * Following Dependency Inversion Principle - depends on abstractions (i18next interface)
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from '../types';

// Import translations
import commonEn from '../locales/en/common.json';
import commonEs from '../locales/es/common.json';
import landingEn from '../locales/en/landing.json';
import landingEs from '../locales/es/landing.json';
import navigationEn from '../locales/en/navigation.json';
import navigationEs from '../locales/es/navigation.json';
import authEn from '../locales/en/auth.json';
import authEs from '../locales/es/auth.json';
import welcomeEn from '../locales/en/welcome.json';
import welcomeEs from '../locales/es/welcome.json';
import dashboardEn from '../locales/en/dashboard.json';
import dashboardEs from '../locales/es/dashboard.json';
import subscriptionEn from '../locales/en/subscription.json';
import subscriptionEs from '../locales/es/subscription.json';
import sermonsEn from '../locales/en/sermons.json';
import sermonsEs from '../locales/es/sermons.json';
import libraryEn from '../locales/en/library.json';
import libraryEs from '../locales/es/library.json';
import seriesEn from '../locales/en/series.json';
import seriesEs from '../locales/es/series.json';
import plannerEn from '../locales/en/planner.json';
import plannerEs from '../locales/es/planner.json';
import generatorEn from '../locales/en/generator.json';
import generatorEs from '../locales/es/generator.json';
import greekTutorEn from '../locales/en/greekTutor.json';
import greekTutorEs from '../locales/es/greekTutor.json';
import hebrewTutorEn from '../locales/en/hebrewTutor.json';
import hebrewTutorEs from '../locales/es/hebrewTutor.json';
import languageStructureEn from '../locales/en/languageStructure.json';
import languageStructureEs from '../locales/es/languageStructure.json';
import sermonDetailEn from '../locales/en/sermonDetail.json';
import sermonDetailEs from '../locales/es/sermonDetail.json';
import facultyEn from '../locales/en/faculty.json';
import facultyEs from '../locales/es/faculty.json';
import exegesisEn from '../locales/en/exegesis.json';
import exegesisEs from '../locales/es/exegesis.json';
import projectsEn from '../locales/en/projects.json';
import projectsEs from '../locales/es/projects.json';
import adminEn from '../locales/en/admin.json';
import adminEs from '../locales/es/admin.json';
import settingsEn from '../locales/en/settings.json';
import settingsEs from '../locales/es/settings.json';
import wordStudyEn from '../locales/en/wordStudy.json';
import wordStudyEs from '../locales/es/wordStudy.json';
import studyDepthEn from '../locales/en/studyDepth.json';
import studyDepthEs from '../locales/es/studyDepth.json';
import guidedSermonEn from '../locales/en/guidedSermon.json';
import guidedSermonEs from '../locales/es/guidedSermon.json';
import legalEn from '../locales/en/legal.json';
import legalEs from '../locales/es/legal.json';

/**
 * Initialize i18next with best practices:
 * - Language detection from browser
 * - localStorage persistence
 * - Fallback language
 * - Namespace organization
 */
export const initI18n = () => {
    i18n
        // Detect user language
        .use(LanguageDetector)
        // Pass the i18n instance to react-i18next
        .use(initReactI18next)
        // Initialize i18next
        .init({
            // Resources organized by language and namespace
            resources: {
                en: {
                    common: commonEn,
                    landing: landingEn,
                    navigation: navigationEn,
                    auth: authEn,
                    welcome: welcomeEn,
                    dashboard: dashboardEn,
                    subscription: subscriptionEn,
                    sermons: sermonsEn,
                    library: libraryEn,
                    series: seriesEn,
                    planner: plannerEn,
                    generator: generatorEn,
                    greekTutor: greekTutorEn,
                    hebrewTutor: hebrewTutorEn,
                    languageStructure: languageStructureEn,
                    sermonDetail: sermonDetailEn,
                    faculty: facultyEn,
                    exegesis: exegesisEn,
                    projects: projectsEn,
                    admin: adminEn,
                    settings: settingsEn,
                    wordStudy: wordStudyEn,
                    studyDepth: studyDepthEn,
                    guidedSermon: guidedSermonEn,
                    legal: legalEn,
                },
                es: {
                    common: commonEs,
                    landing: landingEs,
                    navigation: navigationEs,
                    auth: authEs,
                    welcome: welcomeEs,
                    dashboard: dashboardEs,
                    subscription: subscriptionEs,
                    sermons: sermonsEs,
                    library: libraryEs,
                    series: seriesEs,
                    planner: plannerEs,
                    generator: generatorEs,
                    greekTutor: greekTutorEs,
                    hebrewTutor: hebrewTutorEs,
                    languageStructure: languageStructureEs,
                    sermonDetail: sermonDetailEs,
                    faculty: facultyEs,
                    exegesis: exegesisEs,
                    projects: projectsEs,
                    admin: adminEs,
                    settings: settingsEs,
                    wordStudy: wordStudyEs,
                    studyDepth: studyDepthEs,
                    guidedSermon: guidedSermonEs,
                    legal: legalEs,
                },
            },

            // Default language
            fallbackLng: DEFAULT_LANGUAGE,

            // Default namespace
            defaultNS: 'common',

            // Debug mode (disable in production)
            debug: false,

            // Language detection options
            detection: {
                // Order of detection methods
                order: ['localStorage', 'navigator'],

                // Cache user language in localStorage
                caches: ['localStorage'],

                // localStorage key
                lookupLocalStorage: LANGUAGE_STORAGE_KEY,
            },

            // Interpolation options
            interpolation: {
                // React already escapes values
                escapeValue: false,
            },

            // React options
            react: {
                // Use Suspense for async loading
                useSuspense: false,
            },
        });

    return i18n;
};

export default i18n;

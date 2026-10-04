/**
 * Tokens de los cinco modos de luz del lector/púlpito (plan Púlpito §6, M-09).
 * F0 entrega los TOKENS; las pantallas que los consumen llegan en F1.
 *
 * Los cinco modos son producto, no preferencia estética:
 *   - claro / sepia / oscuro: lectura normal según ambiente.
 *   - atril: alto contraste y sin sorpresas — brillo fijo, keep-awake siempre,
 *     pensado para predicar con luz de escenario.
 *   - eink: BOOX y similares (M-09). Negro/blanco PURO, cero animaciones,
 *     refrescos mínimos. En e-ink el color no existe: los estados del timer
 *     se distinguen por forma/peso tipográfico, no por color — por eso aquí
 *     los tres estados comparten tinta.
 */

import type { HighlightColor } from '@dosfilos/domain';

export type ReadingMode = 'claro' | 'sepia' | 'oscuro' | 'atril' | 'eink';

export interface ReadingModeTokens {
    /** Fondo de la superficie de lectura. */
    background: string;
    /** Superficie elevada (popovers, riel de secciones). */
    surface: string;
    /** Cuerpo del sermón. */
    textPrimary: string;
    /** Metadatos, números de sección, atribuciones. */
    textSecondary: string;
    /** Acento interactivo (marcadores [N], links, referencia bíblica). */
    accent: string;
    /** Divisores y bordes. */
    border: string;
    /** Fondo de lo que se está seleccionando ahora mismo, antes de marcarlo. */
    selection: string;
    /** Fondo de cada color de resaltado (F1: tap largo por frase/párrafo). */
    highlightColors: Record<HighlightColor, string>;
    /**
     * En e-ink el color no existe: el resaltado se marca con subrayado y los
     * cuatro colores se ven igual. Es la degradación honesta, no un bug.
     */
    highlightUnderline: boolean;
    /** Timer: bajo el 80% del objetivo. */
    timerOk: string;
    /** Timer: entre 80% y 100%. */
    timerWarn: string;
    /** Timer: pasado del objetivo (rojo tenue — nunca alarma). */
    timerOver: string;
    /** Animaciones permitidas en este modo. */
    animations: boolean;
    /**
     * Cada cuántos segundos cambia el tiempo que muestran los instrumentos
     * (C3). En tinta electrónica, 60: un reloj que avanza por segundo es un
     * refresco de pantalla por segundo, con su parpadeo y su gasto de batería.
     */
    clockStep: number;
    /** keep-awake incondicional (atril) — los demás siguen la sesión de lectura. */
    keepAwakeAlways: boolean;
    /** Estilo de status bar que no ensucia el modo. */
    statusBarStyle: 'light' | 'dark';
}

const primary = '#1754cf';

export const READING_MODES: Record<ReadingMode, ReadingModeTokens> = {
    claro: {
        background: '#f6f6f8',
        surface: '#ffffff',
        textPrimary: '#0f172a',
        textSecondary: '#64748b',
        accent: primary,
        border: '#e2e8f0',
        selection: '#c7d7f7',
        highlightColors: { yellow: '#fef3c7', green: '#d7f0dc', blue: '#dbeafe', pink: '#fce7f3' },
        highlightUnderline: false,
        timerOk: '#15803d',
        timerWarn: '#b45309',
        timerOver: '#b91c1c',
        animations: true,
        clockStep: 1,
        keepAwakeAlways: false,
        statusBarStyle: 'dark',
    },
    sepia: {
        background: '#f4ecd8',
        surface: '#faf6ea',
        textPrimary: '#433422',
        textSecondary: '#8a7457',
        accent: '#8b5e2b',
        border: '#e0d3b8',
        selection: '#e3d3ae',
        highlightColors: { yellow: '#f0dfa8', green: '#dfe8c4', blue: '#d8e2ef', pink: '#f2dcda' },
        highlightUnderline: false,
        timerOk: '#4d7c0f',
        timerWarn: '#b45309',
        timerOver: '#b91c1c',
        animations: true,
        clockStep: 1,
        keepAwakeAlways: false,
        statusBarStyle: 'dark',
    },
    oscuro: {
        background: '#111621',
        surface: '#1e293b',
        textPrimary: '#f8fafc',
        textSecondary: '#94a3b8',
        accent: '#7ea2e8',
        border: 'rgba(255,255,255,0.08)',
        selection: '#2b3d5e',
        highlightColors: { yellow: '#3f3a1e', green: '#1c3a2a', blue: '#1e3050', pink: '#3d2030' },
        highlightUnderline: false,
        timerOk: '#4ade80',
        timerWarn: '#fbbf24',
        timerOver: '#f87171',
        animations: true,
        clockStep: 1,
        keepAwakeAlways: false,
        statusBarStyle: 'light',
    },
    atril: {
        // Blanco puro sobre negro puro produce HALACIÓN bajo luz de escenario
        // y con la pupila dilatada: los trazos claros se derraman sobre el
        // fondo y el texto pierde definición justo en la condición para la que
        // se diseñó el modo. Blanco cálido sobre negro casi puro conserva el
        // contraste sin el derrame. (E-ink sí quiere puros, por el refresco.)
        background: '#0b0b0c',
        surface: '#131316',
        textPrimary: '#f2efe9',
        textSecondary: '#d4d4d4',
        accent: '#ffd166',
        border: '#404040',
        selection: '#3a3320',
        highlightColors: { yellow: '#4d3f00', green: '#0f3a1c', blue: '#0f294d', pink: '#40142c' },
        highlightUnderline: false,
        timerOk: '#22c55e',
        timerWarn: '#facc15',
        timerOver: '#ef4444',
        animations: false,
        clockStep: 1,
        keepAwakeAlways: true,
        statusBarStyle: 'light',
    },
    eink: {
        background: '#ffffff',
        surface: '#ffffff',
        textPrimary: '#000000',
        textSecondary: '#000000',
        accent: '#000000',
        border: '#000000',
        selection: '#d9d9d9',
        highlightColors: { yellow: '#ffffff', green: '#ffffff', blue: '#ffffff', pink: '#ffffff' },
        highlightUnderline: true,
        timerOk: '#000000',
        timerWarn: '#000000',
        timerOver: '#000000',
        animations: false,
        clockStep: 60,
        keepAwakeAlways: false,
        statusBarStyle: 'dark',
    },
};

/**
 * Clave i18n del nombre de cada modo (`preach:mode_*`).
 *
 * Antes eran literales en español acá, así que en un iPad configurado en
 * inglés la hoja de ajustes salía mezclada: los rótulos traducidos y los
 * nombres de modo en español. Los tokens son diseño; el texto es catálogo.
 */
export const READING_MODE_LABEL_KEYS: Record<ReadingMode, string> = {
    claro: 'preach:mode_claro',
    sepia: 'preach:mode_sepia',
    oscuro: 'preach:mode_oscuro',
    atril: 'preach:mode_atril',
    eink: 'preach:mode_eink',
};

/** El tiempo que se MUESTRA en este modo: al paso de `clockStep`. */
export function shownSeconds(tokens: Pick<ReadingModeTokens, 'clockStep'>, seconds: number): number {
    return Math.floor(seconds / tokens.clockStep) * tokens.clockStep;
}

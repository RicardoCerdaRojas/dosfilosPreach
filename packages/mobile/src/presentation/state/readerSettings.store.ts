import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PinnedNext } from '@/core/utils/nextSermon';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { READING_MODES, ReadingMode, ReadingModeTokens } from '@/core/theme/readingModes';
import { DELIVERY_SIZE } from '@/core/theme/typography';
import type { DeliveryFace } from '@/core/theme/typography';

/**
 * Cuánto dice un instrumento.
 *
 * `full` lleva números; `minimal` deja sólo la barra —la posición sin cifras—
 * y `off` lo apaga. Los números son útiles y también son ruido: mirarlos
 * predicando cuesta atención, y el predicador que ya sabe dónde va sólo
 * necesita ver la marca moverse.
 */
export type InstrumentMode = 'full' | 'minimal' | 'off';

interface ReaderSettingsState {
    /** Cuerpo del lector de Biblia: lectura sentada. */
    fontSize: number;
    setFontSize: (size: number) => void;
    /**
     * Interlínea del lector, como múltiplo de la del atril.
     *
     * Es el ajuste que más piden los lectores después del cuerpo: un texto
     * apretado cansa aunque la letra sea grande, y quien lee capítulos enteros
     * lo nota antes que nadie.
     */
    lineSpacing: number;
    setLineSpacing: (value: number) => void;
    /** Familia del lector, separada de la del atril por la misma razón que el cuerpo. */
    bibleFace: DeliveryFace;
    setBibleFace: (face: DeliveryFace) => void;
    /**
     * Números de versículo a la vista.
     *
     * Apagarlos devuelve la página a prosa pura, que es como se leía antes de
     * que Estienne la numerara en 1551. Para leer un libro entero de corrido
     * es lo correcto; para predicar sobre un versículo, no. Por eso se elige.
     */
    verseNumbers: boolean;
    setVerseNumbers: (on: boolean) => void;
    /**
     * Pantalla encendida mientras se lee.
     *
     * Una tablet apoyada en el escritorio se apaga a los treinta segundos
     * porque nadie la toca — leer no es tocar. Es el mismo problema que el
     * atril resuelve, y aparece igual estudiando.
     */
    keepAwake: boolean;
    setKeepAwake: (on: boolean) => void;
    /**
     * Cuerpo del modo púlpito: se predica de pie, a 60-70 cm. Separado del
     * anterior porque compartirlos hacía que ajustar la Biblia cambiara el
     * sermón, y al revés.
     */
    deliveryFontSize: number;
    setDeliveryFontSize: (size: number) => void;
    /** Modo de luz del lector/púlpito (plan §6). Persistido; sync llega en F1. */
    readingMode: ReadingMode;
    setReadingMode: (mode: ReadingMode) => void;
    /**
     * Colometría: cada oración abre renglón (D6). Preferencia del predicador,
     * no un ajuste con respuesta correcta — hay quien reengancha mejor con el
     * párrafo corrido.
     */
    senseLines: boolean;
    setSenseLines: (on: boolean) => void;
    /**
     * Línea vertical al 66 % de la medida. EXCLUYENTE con `senseLines`:
     * encender una apaga la otra, porque resuelven lo mismo y se estorban.
     */
    gazeLine: boolean;
    setGazeLine: (on: boolean) => void;
    /**
     * Presupuesto de tiempo fijado a mano, en segundos, por
     * `${sermonId}|${sectionSlug}`. Lo que el pastor no toca se reparte solo.
     * Persiste porque se decide preparando, no en el atril.
     */
    /**
     * Reserva del tercio inferior para el tablero (P7). Se puede apagar: hay
     * púlpitos donde el atril tapa la parte de abajo y conviene todo el alto
     * para el texto.
     */
    /** Familia tipográfica del cuerpo de entrega. Preferencia del predicador. */
    /** Sangría francesa: primera línea en el margen, el resto adentro. */
    hangingIndent: boolean;
    setHangingIndent: (on: boolean) => void;
    deliveryFace: DeliveryFace;
    setDeliveryFace: (face: DeliveryFace) => void;
    /**
     * La línea de vuelo de arriba y el tablero de abajo se controlan POR
     * SEPARADO: son dos instrumentos distintos, no dos vistas del mismo. Quien
     * quiere el riel de movimientos abajo puede no querer el reloj arriba.
     */
    statusBarMode: InstrumentMode;
    setStatusBarMode: (mode: InstrumentMode) => void;
    panelMode: InstrumentMode;
    setPanelMode: (mode: InstrumentMode) => void;
    /**
     * Dónde quedó la lectura de la Biblia.
     *
     * Se guarda para poder RETOMARLA desde el inicio. Abrir siempre en el
     * mismo capítulo obliga a rehacer la búsqueda cada vez, y un pastor que
     * lee un libro entero a lo largo de una semana vuelve al mismo lugar
     * todos los días.
     */
    /**
     * Lectura a ancho completo en vez de la columna medida.
     *
     * La columna es lo correcto para leer —una línea de mil píxeles hace
     * perder el renglón al volver— pero a veces se quiere la página entera:
     * comparar dos versiones, mirar un capítulo de un vistazo. Es preferencia,
     * no ajuste con respuesta única, así que se guarda.
     */
    /**
     * Últimas búsquedas, de la más reciente a la más vieja.
     *
     * Un pastor busca la misma frase varias veces durante una semana de
     * preparación: escribirla de nuevo cada vez es trabajo que la app puede
     * ahorrarle.
     */
    recentSearches: string[];
    rememberSearch: (query: string) => void;
    fullWidth: boolean;
    setFullWidth: (on: boolean) => void;
    lastRead: { versionId: string; bookId: string; chapter: number } | null;
    setLastRead: (at: { versionId: string; bookId: string; chapter: number }) => void;
    /**
     * Cuánto alto se lleva el tablero, como fracción de lo legible.
     *
     * Era un TERCIO fijo, y un tercio es mucho: el reloj y el riel entran en
     * poco más de cien puntos y el resto quedaba en blanco, comiéndose el
     * texto. Ahora se elige, y el valor por defecto es el chico.
     */
    panelRatio: number;
    setPanelRatio: (ratio: number) => void;
    budgetOverrides: Record<string, number>;
    setBudgetOverride: (key: string, seconds: number | null) => void;
    /**
     * Duración objetivo por sermón, en minutos (A4). Antes era 30 fijos para
     * todos y se olvidaba al salir del atril: un sermón de 45 había que
     * reajustarlo cada vez. Lo que no se fija sale del texto.
     */
    targetMinutesBySermon: Record<string, number>;
    setTargetMinutes: (sermonId: string, minutes: number) => void;
    /** Página de «Lectura» con el pasaje antes del primer movimiento (C7). */
    readingPage: boolean;
    setReadingPage: (on: boolean) => void;
    /**
     * Predicar desde el bosquejo en vez del manuscrito (C7). Es del pastor,
     * no del sermón: quien predica de bosquejo lo hace siempre.
     */
    outlineView: boolean;
    setOutlineView: (on: boolean) => void;
    /**
     * La tinta se ve (T-8). Ocultarla no la borra: es para predicar con el
     * texto limpio sin perder lo anotado. Vale para el púlpito y la Biblia.
     */
    inkVisible: boolean;
    setInkVisible: (on: boolean) => void;
    /**
     * Foco de lectura (L-3): el párrafo en curso a pleno contraste y el resto
     * atenuado; avanzar recorre las ideas antes de pasar la página.
     */
    readingFocus: boolean;
    setReadingFocus: (on: boolean) => void;
    /**
     * Citas en bloque plegadas a un renglón (el «aparato de estudio» de P5).
     * Apagado por defecto: en el manuscrito del pastor la cita al comienzo de
     * un punto es la Escritura que se lee en voz alta.
     */
    collapseQuotes: boolean;
    setCollapseQuotes: (on: boolean) => void;
    /**
     * El sermón como un documento continuo que se desplaza, en vez de
     * páginas (fase «Atril continuo»). Apagado por defecto: en la página el
     * texto no se mueve y el ojo que vuelve del público lo encuentra.
     */
    continuousReading: boolean;
    setContinuousReading: (on: boolean) => void;
    /** Sólo el Apple Pencil escribe en el atril; el dedo sigue pasando página (T-9). */
    pencilOnly: boolean;
    setPencilOnly: (on: boolean) => void;
    /**
     * El sermón de «este domingo» elegido a mano en el inicio. Manda sobre el
     * plan hasta que se predica o pasan 10 días (`pickNextSermon`).
     */
    pinnedNext: PinnedNext | null;
    setPinnedNext: (pin: PinnedNext | null) => void;
    /** Brillo propio del atril (C7), de 0 a 1; `null` deja el del sistema. */
    preachBrightness: number | null;
    setPreachBrightness: (level: number | null) => void;
    /** Dónde predicó la última vez: casi siempre es el mismo lugar (A5). */
    lastPreachingPlace: string;
    setLastPreachingPlace: (place: string) => void;
    /**
     * Borra lo que es DE LA PERSONA (lugar de predicación, duraciones y
     * presupuestos por sermón, búsquedas, dónde quedó leyendo) y conserva lo
     * que es del aparato (tamaño, modo de luz). Al cerrar sesión (revisión
     * adversarial de A8): el siguiente pastor encontraba el lugar del anterior
     * ya escrito y lo registraba sin darse cuenta.
     */
    resetPersonal: () => void;
}

export const useReaderSettingsStore = create<ReaderSettingsState>()(
    persist(
        (set) => ({
            fontSize: 18, // Default font size
            setFontSize: (size: number) => set({ fontSize: size }),
            lineSpacing: 1,
            setLineSpacing: (value: number) => set({ lineSpacing: value }),
            bibleFace: 'literata',
            setBibleFace: (face: DeliveryFace) => set({ bibleFace: face }),
            verseNumbers: true,
            setVerseNumbers: (on: boolean) => set({ verseNumbers: on }),
            keepAwake: true,
            setKeepAwake: (on: boolean) => set({ keepAwake: on }),
            deliveryFontSize: DELIVERY_SIZE.default,
            setDeliveryFontSize: (size: number) => set({ deliveryFontSize: size }),
            readingMode: 'claro',
            setReadingMode: (mode: ReadingMode) => set({ readingMode: mode }),
            senseLines: false,
            // Encender una apaga la otra: resuelven el mismo problema y se
            // estorban entre sí. No son dos niveles de una escala.
            setSenseLines: (on: boolean) =>
                set((state) => ({ senseLines: on, gazeLine: on ? false : state.gazeLine })),
            gazeLine: false,
            setGazeLine: (on: boolean) =>
                set((state) => ({ gazeLine: on, senseLines: on ? false : state.senseLines })),
            hangingIndent: true,
            setHangingIndent: (on: boolean) => set({ hangingIndent: on }),
            deliveryFace: 'lexend',
            setDeliveryFace: (face: DeliveryFace) => set({ deliveryFace: face }),
            statusBarMode: 'full',
            setStatusBarMode: (mode: InstrumentMode) => set({ statusBarMode: mode }),
            panelMode: 'full',
            setPanelMode: (mode: InstrumentMode) => set({ panelMode: mode }),
            recentSearches: [],
            rememberSearch: (query) =>
                set((state) => ({
                    // Sin repetidas y con tope: una lista infinita de
                    // búsquedas deja de ser un atajo.
                    recentSearches: [query, ...state.recentSearches.filter((q) => q !== query)].slice(
                        0,
                        8,
                    ),
                })),
            fullWidth: false,
            setFullWidth: (on) => set({ fullWidth: on }),
            lastRead: null,
            setLastRead: (at) => set({ lastRead: at }),
            panelRatio: 0.17,
            setPanelRatio: (ratio: number) => set({ panelRatio: ratio }),
            budgetOverrides: {},
            setBudgetOverride: (key: string, seconds: number | null) =>
                set((state) => {
                    const next = { ...state.budgetOverrides };
                    if (seconds === null) delete next[key];
                    else next[key] = seconds;
                    return { budgetOverrides: next };
                }),
            resetPersonal: () =>
                set({
                    lastPreachingPlace: '',
                    targetMinutesBySermon: {},
                    budgetOverrides: {},
                    recentSearches: [],
                    lastRead: null,
                    // La elección es del pastor que la hizo, no del siguiente.
                    pinnedNext: null,
                }),
            readingPage: true,
            setReadingPage: (on: boolean) => set({ readingPage: on }),
            outlineView: false,
            setOutlineView: (on: boolean) => set({ outlineView: on }),
            inkVisible: true,
            setInkVisible: (on: boolean) => set({ inkVisible: on }),
            readingFocus: false,
            setReadingFocus: (on: boolean) => set({ readingFocus: on }),
            collapseQuotes: false,
            setCollapseQuotes: (on: boolean) => set({ collapseQuotes: on }),
            continuousReading: false,
            setContinuousReading: (on: boolean) => set({ continuousReading: on }),
            pencilOnly: false,
            setPencilOnly: (on: boolean) => set({ pencilOnly: on }),
            pinnedNext: null,
            setPinnedNext: (pin: PinnedNext | null) => set({ pinnedNext: pin }),
            preachBrightness: null,
            setPreachBrightness: (level: number | null) => set({ preachBrightness: level }),
            lastPreachingPlace: '',
            setLastPreachingPlace: (place: string) => set({ lastPreachingPlace: place }),
            targetMinutesBySermon: {},
            setTargetMinutes: (sermonId: string, minutes: number) =>
                set((state) => ({
                    targetMinutesBySermon: { ...state.targetMinutesBySermon, [sermonId]: minutes },
                })),
        }),
        {
            name: 'reader-settings-storage',
            storage: createJSONStorage(() => AsyncStorage),
            // El tablero era un booleano y ahora tiene tres estados. Sin migrar,
            // quien ya lo había apagado se lo encontraría encendido.
            version: 1,
            migrate: (persisted: any, version: number) => {
                if (version === 0 && persisted && 'instrumentPanel' in persisted) {
                    persisted.panelMode = persisted.instrumentPanel ? 'full' : 'off';
                    delete persisted.instrumentPanel;
                }
                return persisted;
            },
        }
    )
);

/** Tokens del modo activo — el consumo de F1 pasa por aquí, no por READING_MODES directo. */
export function useReadingModeTokens(): ReadingModeTokens {
    const mode = useReaderSettingsStore((s) => s.readingMode);
    return READING_MODES[mode];
}

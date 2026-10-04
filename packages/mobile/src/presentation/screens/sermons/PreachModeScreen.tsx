import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import type { CitationManifestEntry, ReadingBlock, UnitMetric } from '@dosfilos/domain';
import {
    aggregateRequiredAttributions,
    buildMovementBudgets,
    buildReadingBlocks,
    buildOutline,
    buildRehearsalReport,
    fragmentBlock,
    defaultTargetMinutes,
    shiftEndAt,
    suggestedEndAt,
} from '@dosfilos/domain';

import { useSermon } from '@/presentation/hooks/useSermons';
import { usePreachHighlights } from '@/presentation/hooks/usePreachHighlights';
import { extractSectionsWithBody } from '@/core/utils/sermonSections';
import { READING_MODES, shownSeconds } from '@/core/theme/readingModes';
import { GAZE_LINE_RATIO, TYPE_SCALE } from '@/core/theme/typography';
import { useReaderSettingsStore } from '@/presentation/state/readerSettings.store';
import { PreachSectionBody, type PageBlock } from '@/presentation/components/preach/PreachSectionBody';
import { useDeliveryMeasure } from '@/presentation/hooks/useDeliveryMeasure';
import { MarkPopover } from '@/presentation/components/preach/MarkPopover';
import { PreachExitSheet } from '@/presentation/components/preach/PreachExitSheet';
import { PreachStatusBar } from '@/presentation/components/preach/PreachStatusBar';
import { InkLayer } from '@/presentation/components/preach/InkLayer';
import { useInkNotes } from '@/presentation/hooks/useInkNotes';
import { PreachSettingsSheet } from '@/presentation/components/preach/PreachSettingsSheet';
import { BibleConsultSheet } from '@/presentation/components/bible/BibleConsultSheet';
import { PreachInstrumentPanel } from '@/presentation/components/preach/PreachInstrumentPanel';
import { usePagination } from '@/presentation/hooks/usePagination';
import { READING_SLUG, usePreachClock } from '@/presentation/hooks/usePreachClock';
import { usePreachBrightness } from '@/presentation/hooks/usePreachBrightness';
import { PreachReadingPage } from '@/presentation/components/preach/PreachReadingPage';
import { PreachOutline } from '@/presentation/components/preach/PreachOutline';
import { readingPassageFor, verseTextFor } from '@/data/repositories/bible/BibleVersionFactory';
import { useConnectivityStore } from '@/presentation/state/connectivity.store';
import { useUIStore } from '@/presentation/state/ui.store';
import { createGestureGate, swipeDirection, tapZone } from './preachGestures';

interface PreachModeScreenProps {
    /** Id inyectado: lo usa la vista previa de dev, que no llega por ruta. */
    sermonId?: string;
    /** Movimiento inicial: la vista previa de dev abre en el que se revisa. */
    initialSectionIndex?: number;
}

export default function PreachModeScreen({
    sermonId,
    initialSectionIndex = 0,
}: PreachModeScreenProps = {}) {
    const params = useLocalSearchParams<{ id: string }>();
    const id = sermonId ?? params.id;
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { width, height: screenHeight } = useWindowDimensions();
    const { data: sermon, isLoading, refetch } = useSermon(id ?? '', { stable: true });

    const readingMode = useReaderSettingsStore((s) => s.readingMode);
    const setReadingMode = useReaderSettingsStore((s) => s.setReadingMode);
    const fontSize = useReaderSettingsStore((s) => s.deliveryFontSize);
    const setFontSize = useReaderSettingsStore((s) => s.setDeliveryFontSize);
    const deliveryFace = useReaderSettingsStore((s) => s.deliveryFace);
    const setDeliveryFace = useReaderSettingsStore((s) => s.setDeliveryFace);
    const hangingIndent = useReaderSettingsStore((s) => s.hangingIndent);
    const setHangingIndent = useReaderSettingsStore((s) => s.setHangingIndent);
    const senseLines = useReaderSettingsStore((s) => s.senseLines);
    const setSenseLines = useReaderSettingsStore((s) => s.setSenseLines);
    const gazeLine = useReaderSettingsStore((s) => s.gazeLine);
    const setGazeLine = useReaderSettingsStore((s) => s.setGazeLine);
    const statusBarMode = useReaderSettingsStore((s) => s.statusBarMode);
    const setStatusBarMode = useReaderSettingsStore((s) => s.setStatusBarMode);
    const panelMode = useReaderSettingsStore((s) => s.panelMode);
    const setPanelMode = useReaderSettingsStore((s) => s.setPanelMode);
    const panelRatio = useReaderSettingsStore((s) => s.panelRatio);
    const setPanelRatio = useReaderSettingsStore((s) => s.setPanelRatio);
    const budgetOverrides = useReaderSettingsStore((s) => s.budgetOverrides);
    const readingPageOn = useReaderSettingsStore((s) => s.readingPage);
    const setReadingPageOn = useReaderSettingsStore((s) => s.setReadingPage);
    const targetBySermon = useReaderSettingsStore((s) => s.targetMinutesBySermon);
    const setTargetMinutes = useReaderSettingsStore((s) => s.setTargetMinutes);
    const setBudgetOverride = useReaderSettingsStore((s) => s.setBudgetOverride);
    const tokens = READING_MODES[readingMode];
    const offline = useConnectivityStore((s) => s.offline);

    // El púlpito nunca se apaga a mitad de sermón. En modo atril es
    // incondicional por diseño; en el resto vale mientras dure la pantalla.
    useKeepAwake();

    const [sectionIndex, setSectionIndex] = useState(initialSectionIndex);
    /** Página dentro del movimiento. La unidad de avance bajo el pulgar (D7). */
    const [pageIndex, setPageIndex] = useState(0);
    const [chromeVisible, setChromeVisible] = useState(true);
    const [blackout, setBlackout] = useState(false);
    // Con la pantalla negra no se muestra ningún aviso (revisión de A2).
    useEffect(() => {
        useUIStore.getState().setQuiet(blackout);
        return () => useUIStore.getState().setQuiet(false);
    }, [blackout]);
    const [showSections, setShowSections] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showBible, setShowBible] = useState(false);
    const [citation, setCitation] = useState<{ ordinal: number; entry: CitationManifestEntry }[] | null>(
        null,
    );
    /** Cita de bloque abierta desde su marca al margen (P5). */
    const [apparatus, setApparatus] = useState<string | null>(null);
    /** Referencia bíblica tocada en el manuscrito: su versículo en capa (C7). */
    const [verseRef, setVerseRef] = useState<string | null>(null);
    /** La Biblia del atril abierta en una referencia tocada (C7). */
    const [bibleRefs, setBibleRefs] = useState<string[] | null>(null);
    /** En la página de Lectura, antes del primer movimiento (C7). */
    const [onReadingPage, setOnReadingPage] = useState(initialSectionIndex === 0);

    const [showExit, setShowExit] = useState(false);
    const scrollRef = useRef<ScrollView>(null);
    // Toques: un dedo pasa página, dos dedos dos veces apagan (A3).
    const [gate] = useState(createGestureGate);
    const swipeStart = useRef<{ x: number; y: number } | null>(null);



    const sections = sermon?.content ? extractSectionsWithBody(sermon.content) : [];
    // El pasaje para la página de Lectura: el primero que la Biblia local lee.
    // No corre en cada tic: el React Compiler (app.json) memoiza por sus
    // entradas, y el atril compila sin rendirse (lo vigila el lint).
    const passage = readingPageOn ? readingPassageFor(sermon?.bibleReferences ?? []) : null;
    const showReading = onReadingPage && passage !== null;
    const section = sections[sectionIndex];
    const manifest = sermon?.citationManifest;
    const attributions = aggregateRequiredAttributions(manifest);

    // Duración: la que el pastor fijó para ESTE sermón, o la del texto.
    const targetMinutes =
        (id ? targetBySermon[id] : undefined) ?? defaultTargetMinutes(sermon?.content ?? '');

    /**
     * Cambiar de movimiento carga lo corrido al que se dejaba. Se hace al
     * NAVEGAR, no en un efecto que mira el índice: el tiempo es de lo que se
     * leyó de verdad, no de lo que el reloj dice que tocaría.
     */
    const enterSection = (index: number, page: number) => {
        setSectionIndex(index);
        setPageIndex(page);
        const slug = sections[index]?.slug;
        if (slug) preachClock.moveTo(slug);
    };



    const blocks = section ? buildReadingBlocks(section.body) : [];
    // Bosquejo (C7): el mismo movimiento, derivado del manuscrito. Una página
    // por movimiento; las marcas y la tinta, ancladas al manuscrito, no van.
    const outlineOn = useReaderSettingsStore((s) => s.outlineView);
    const setOutlineView = useReaderSettingsStore((s) => s.setOutlineView);
    const outline = outlineOn && section ? buildOutline(section.body) : [];
    const preachBrightness = useReaderSettingsStore((s) => s.preachBrightness);
    const setPreachBrightness = useReaderSettingsStore((s) => s.setPreachBrightness);
    usePreachBrightness(preachBrightness);

    // La caja de medida abarca TODO lo que se lee — título, título de
    // movimiento, cuerpo y atribuciones. Cuando sólo la usaba el cuerpo, los
    // títulos quedaban pegados al borde y el bloque se veía desalineado.
    const { measure, probe } = useDeliveryMeasure(fontSize);

    // Capa de tinta: anclada al texto, no a la pantalla. Ver InkNote en domain.
    const inkLayoutKey = `${sectionIndex}|${pageIndex}|${fontSize}|${senseLines}|${hangingIndent}|${deliveryFace}|${panelMode}|${statusBarMode}|${panelRatio}`;
    const ink = useInkNotes(id ?? '', section, inkLayoutKey);

    // El presupuesto de tiempo por movimiento alimenta el riel (D2). Por
    // defecto se reparte proporcional a las palabras; lo que el pastor fija a
    // mano se respeta y el resto se reacomoda, así que ajustar uno no
    // descuadra el total. F3 lo reemplazará con tiempos reales del ensayo.
    // El reloj y su sesión (A4, C7), en su hook (C6). Los presupuestos por
    // movimiento alimentan el riel (D2): proporcionales a las palabras, con lo
    // que el pastor fijó a mano respetado; dependen de la duración, que con
    // hora de término sale del propio reloj.
    const preachClock = usePreachClock({
        sermonId: id,
        sectionSlugs: sections.map((sec) => sec.slug),
        // En la Lectura el tiempo es de la Lectura: antes se cargaba a la
        // introducción y su aviso de pasado sonaba antes de tiempo.
        sectionSlug: showReading ? READING_SLUG : (section?.slug ?? null),
        pageIndex,
        targetMinutes,
        haptics: readingMode !== 'eink',
        budgetsFor: (targetSeconds) =>
            buildMovementBudgets(
                sections.map((sec) => ({ slug: sec.slug, title: sec.title || t('preach:opening'), body: sec.body })),
                targetSeconds,
                Object.fromEntries(
                    sections
                        .map((sec) => [sec.slug, budgetOverrides[`${id}|${sec.slug}`]] as const)
                        .filter(([, value]) => typeof value === 'number'),
                ),
            ),
        onRestore: ({ sectionIndex: at, pageIndex: page, onReading }) => {
            setOnReadingPage(onReading);
            setSectionIndex(at);
            setPageIndex(page);
        },
    });
    const { budgets, elapsed, running } = preachClock;

    // P7 — el tercio inferior no se llena de prosa: leerlo obliga a bajar el
    // mentón y la cara sale de la congregación. Ahí va el tablero.
    // La línea de vuelo ocupa dos renglones bajo la barra: si no se descuenta,
    // la última línea de cada página queda debajo del borde.
    const statusBarHeight =
        chromeVisible && budgets.length > 0 && statusBarMode !== 'off'
            ? statusBarMode === 'full'
                ? 34
                : 12
            : 0;
    const chromeTop = (chromeVisible ? insets.top + 44 : insets.top + 16) + statusBarHeight;
    const readableHeight = screenHeight - chromeTop - insets.bottom;
    // El tablero ya no es un tercio fijo: el reloj y el riel entran en poco
    // más de cien puntos, y lo que sobraba se lo estaba comiendo al texto.
    const panelHeight =
        panelMode === 'off'
            ? 0
            : panelMode === 'minimal'
              ? // Sólo el riel: no hace falta más que su alto y un poco de aire.
                44
              : Math.max(96, Math.round(readableHeight * panelRatio));
    // Lo que queda para el texto: el alto visible menos el respiro de arriba
    // (16) y el asomo de la página siguiente (0,6 de margen + 2 renglones de
    // 1,4). Antes se reservaban 2 cuerpos y el asomo ocupa ~3,4: la última
    // línea de cada página quedaba bajo el borde (A7).
    const PEEK_LINES = 2;
    const peekHeight = fontSize * 0.6 + PEEK_LINES * fontSize * 1.4;
    const pageHeight = readableHeight - panelHeight - 16 - peekHeight;

    const renderBlockForMeasure = (
        block: ReadingBlock,
        _index: number,
        onUnitMetrics: (metrics: UnitMetric[]) => void,
    ) => (
        <PreachSectionBody
            blocks={[block]}
            onUnitMetrics={onUnitMetrics}
            highlights={[]}
            fontSize={fontSize}
            tokens={tokens}
            senseLines={senseLines}
            face={deliveryFace}
            hangingIndent={hangingIndent}
            selection={null}
            onSelectionChange={() => undefined}
            onSelectionEnd={() => undefined}
            onTapAt={() => undefined}
            onPressCitation={() => undefined}
            onPressApparatus={() => undefined}
        />
    );

    // Lo que va arriba de la primera página del movimiento. Se mide para
    // descontarlo de esa página (A7).
    const pageHeader =
        (sectionIndex === 0 && sermon?.title) || section?.title ? (
            <View>
                {sectionIndex === 0 && sermon?.title ? (
                    <Text
                        style={{
                            color: tokens.textPrimary,
                            fontSize: Math.min(fontSize * 1.4, 46),
                            marginBottom: fontSize * 0.8,
                        }}
                        className="font-lexend-bold leading-tight"
                    >
                        {sermon.title}
                    </Text>
                ) : null}
                {section?.title ? (
                    // Ubica, no compite: 0.6× en versalitas y color
                    // secundario. A 1.15× le disputaba la pantalla al
                    // título del sermón.
                    <Text
                        style={{
                            color: tokens.textSecondary,
                            fontSize: fontSize * TYPE_SCALE.movementTitle,
                            marginBottom: fontSize * 0.5,
                        }}
                        className="font-lexend-semibold uppercase tracking-widest"
                    >
                        {section.title}
                    </Text>
                ) : null}
            </View>
        ) : null;

    const { pages, measuring, probe: pageProbe } = usePagination({
        header: pageHeader ?? undefined,
        blocks,
        availableHeight: pageHeight,
        renderBlock: renderBlockForMeasure,
        // La familia entra en la clave: distintas fuentes dan distinta altura
        // de línea, y paginar con las alturas de otra fuente corta mal.
        layoutKey: `${section?.slug ?? ''}|${fontSize}|${senseLines}|${deliveryFace}|${hangingIndent}|${measure ?? 0}`,
    });

    const pageCount = outlineOn ? 1 : Math.max(1, pages.length);
    const safePageIndex = Math.min(pageIndex, pageCount - 1);
    // Con la paginación por oración (L-1) una página lleva fragmentos: un
    // bloque entero o un tramo de sus oraciones.
    const pageBlocks: PageBlock[] =
        pages.length && !outlineOn
            ? (pages[safePageIndex] ?? []).map((f) => fragmentBlock(blocks[f.block]!, f))
            : blocks;

    // Texto de la página siguiente para el asomo. Sale del primer fragmento
    // que viene: alcanza para saber si la idea sigue o si acá cerró.
    const nextFragment = !outlineOn ? pages[safePageIndex + 1]?.[0] : undefined;
    const nextPeek = nextFragment ? fragmentBlock(blocks[nextFragment.block]!, nextFragment).text : null;

    // El resaltado por tap largo vive en su propio hook: la pantalla ya
    // carga timer, modos de luz, navegación por secciones y citas.
    // El pulso se apaga solo en e-ink: los lectores BOOX no tienen motor
    // háptico. Atril apaga animaciones pero conserva el pulso.
    const highlighting = usePreachHighlights(id ?? '', section, readingMode !== 'eink');

    const goTo = (index: number) => {
        if (index < 0 || index >= sections.length) return;
        enterSection(index, 0);
        scrollRef.current?.scrollTo({ y: 0, animated: tokens.animations });
    };

    /**
     * El avance es POR PÁGINA, no por movimiento. Al llegar al borde salta al
     * movimiento vecino: para el predicador el sermón es continuo, la división
     * en movimientos sirve para ubicarse, no para tener que navegarla.
     */
    /**
     * El reloj arranca solo con el PRIMER toque, de cualquier tipo: antes, si
     * el pastor no tocaba play, la predicación no se registraba (A4). Era con
     * el primer avance, y entonces la primera página no contaba nunca: el
     * informe decía «introducción 0:00» (revisión adversarial de A4).
     */
    const ensureClockStarted = preachClock.ensureStarted;

    const step = (delta: number) => {
        ensureClockStarted();
        // Desde la Lectura, adelante entra al primer movimiento.
        if (showReading) {
            if (delta > 0) {
                setOnReadingPage(false);
                enterSection(0, 0);
            }
            return;
        }
        // Desde la primera página del sermón, atrás vuelve a la Lectura.
        if (delta < 0 && passage && sectionIndex === 0 && safePageIndex === 0) {
            setOnReadingPage(true);
            preachClock.moveTo(READING_SLUG);
            return;
        }
        const next = safePageIndex + delta;
        if (next >= 0 && next < pageCount) {
            setPageIndex(next);
            scrollRef.current?.scrollTo({ y: 0, animated: tokens.animations });
            return;
        }
        if (delta > 0 && sectionIndex < sections.length - 1) {
            goTo(sectionIndex + 1);
        } else if (delta < 0 && sectionIndex > 0) {
            // Al retroceder de movimiento se entra por su ÚLTIMA página, que
            // es donde estabas leyendo cuando avanzaste.
            enterSection(sectionIndex - 1, Number.MAX_SAFE_INTEGER);
            scrollRef.current?.scrollTo({ y: 0, animated: tokens.animations });
        }
    };

    // Zonas de tap: ⅓ izquierda retrocede, ⅓ derecha avanza, centro
    // muestra/oculta controles. La pantalla negra es de DOS dedos (ver
    // preachGestures): un dedo nunca apaga, por rápido que toque.
    // `x` es SIEMPRE absoluto de pantalla (pageX): el cuerpo del sermón
    // reenvía sus taps desde adentro y su locationX sería relativo.
    const handleTap = (x: number) => {
        if (!gate.acceptsTap(Date.now())) return;
        ensureClockStarted();
        // ¿Deslizó? Se decide al soltar, contra el punto donde bajó el dedo.
        const swipe = swipeDirection(swipeStart.current?.x ?? null, x);
        swipeStart.current = null;
        if (swipe !== 0) {
            step(swipe);
            return;
        }
        const zone = tapZone(x, width);
        if (zone === 'back') step(-1);
        else if (zone === 'forward') step(1);
        else setChromeVisible((v) => !v);
    };

    // Salir pasa por la hoja de salida si hubo predicación: ahí se registra.
    const requestExit = () => {
        if (elapsed > 60) {
            setShowExit(true);
            return;
        }
        preachClock.finish();
        router.back();
    };

    // «Atrás» de Android: antes salía del atril sin la hoja de salida y se
    // perdían el informe y el registro (A3). Las capas abiertas (Modal) se
    // cierran solas con su onRequestClose antes de llegar acá.
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (blackout) setBlackout(false);
            else if (!showExit) requestExit();
            return true;
        });
        return () => sub.remove();
    });

    const openCitation = (ordinals: number[]) => {
        if (!manifest) return;
        const resolved = ordinals
            .map((n) => ({ ordinal: n, entry: manifest.entries[n - 1] }))
            .filter((p): p is { ordinal: number; entry: CitationManifestEntry } => Boolean(p.entry));
        if (resolved.length) setCitation(resolved);
    };

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center" style={{ backgroundColor: tokens.background }}>
                <ActivityIndicator color={tokens.accent} />
            </View>
        );
    }

    // Sin datos: un mensaje y dos salidas. Antes era un spinner eterno, y el
    // pastor no sabía si esperar o volver (A2).
    // Sólo sin sermón: si una recarga falla, React Query conserva los datos y
    // el atril no se reemplaza por esta pantalla (revisión de A2).
    if (!sermon) {
        return (
            <View
                className="flex-1 items-center justify-center px-10"
                style={{ backgroundColor: tokens.background }}
            >
                <MaterialIcons name="cloud-off" size={36} color={tokens.textSecondary} />
                <Text
                    style={{ color: tokens.textPrimary, fontSize: 19 }}
                    className="font-lexend-semibold text-center mt-4"
                >
                    {t('common:load_failed')}
                </Text>
                <Text
                    style={{ color: tokens.textSecondary, fontSize: 15, lineHeight: 22 }}
                    className="font-lexend text-center mt-2"
                >
                    {t('common:load_failed_hint')}
                </Text>
                <View className="flex-row mt-6">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        className="px-6 py-3 rounded-full mr-3"
                        style={{ borderWidth: 1, borderColor: tokens.border }}
                    >
                        <Text style={{ color: tokens.textPrimary }} className="font-lexend-semibold">
                            {t('common:go_back')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => refetch()}
                        accessibilityRole="button"
                        className="px-6 py-3 rounded-full"
                        style={{ backgroundColor: tokens.accent }}
                    >
                        <Text style={{ color: tokens.background }} className="font-lexend-semibold">
                            {t('common:retry')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1" style={{ backgroundColor: tokens.background }}>
            <StatusBar style={tokens.statusBarStyle} hidden={!chromeVisible} />

            {chromeVisible && (
                <View
                    className="flex-row items-center justify-between px-5 pb-2"
                    style={{ paddingTop: insets.top + 6, borderBottomWidth: 1, borderBottomColor: tokens.border }}
                >
                    <TouchableOpacity
                        onPress={requestExit}
                        accessibilityRole="button"
                        accessibilityLabel={t('preach:exit')}
                        className="flex-row items-center"
                    >
                        <MaterialIcons name="close" size={22} color={tokens.textSecondary} />
                    </TouchableOpacity>

                    {/* Sin conexión: el sermón es la copia del maletín. Un
                        ícono, no un cartel: en el atril sólo tiene que estar
                        a la vista para quien lo busque. */}
                    {offline ? (
                        <View
                            accessible
                            accessibilityLabel={t('preach:offline_copy')}
                            className="flex-row items-center ml-4 mr-auto"
                        >
                            <MaterialIcons name="cloud-off" size={18} color={tokens.textSecondary} />
                        </View>
                    ) : null}

                    <View className="flex-row items-center">
                        {/* El timer vive abajo, en el tablero (P7). Acá queda
                            sólo arrancarlo y pararlo. */}
                        <TouchableOpacity
                            onPress={preachClock.toggle}
                            accessibilityRole="button"
                            accessibilityLabel={t(running ? 'preach:pause_timer' : 'preach:start_timer')}
                            className="mr-5"
                        >
                            <MaterialIcons
                                name={running ? 'pause' : 'play-arrow'}
                                size={26}
                                color={running ? tokens.accent : tokens.textSecondary}
                            />
                        </TouchableOpacity>
                        {/* Manuscrito o bosquejo (C7), a un toque: se cambia
                            en medio del sermón, cuando la idea ya está dicha. */}
                        <TouchableOpacity
                            onPress={() => {
                                ink.setPenActive(false);
                                setOutlineView(!outlineOn);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t(outlineOn ? 'preach:view_manuscript' : 'preach:view_outline')}
                            className="mr-4"
                        >
                            <MaterialIcons
                                name={outlineOn ? 'article' : 'format-list-bulleted'}
                                size={22}
                                color={outlineOn ? tokens.accent : tokens.textSecondary}
                            />
                        </TouchableOpacity>
                        {outlineOn ? null : <TouchableOpacity
                            onPress={() => ink.setPenActive(!ink.penActive)}
                            accessibilityRole="button"
                            accessibilityLabel={t('preach:pen')}
                            className="mr-4"
                        >
                            <MaterialIcons
                                name={ink.penActive ? 'draw' : 'edit'}
                                size={22}
                                color={ink.penActive ? tokens.accent : tokens.textSecondary}
                            />
                        </TouchableOpacity>}
                        <TouchableOpacity
                            onPress={() => setShowBible(true)}
                            accessibilityRole="button"
                            accessibilityLabel={t('bible:title')}
                            className="mr-4"
                        >
                            <MaterialIcons
                                name="menu-book"
                                size={22}
                                color={tokens.textSecondary}
                            />
                        </TouchableOpacity>
                        {/* Pantalla negra también con un botón: el gesto de dos
                            dedos no se descubre solo. */}
                        <TouchableOpacity
                            onPress={() => setBlackout(true)}
                            accessibilityRole="button"
                            accessibilityLabel={t('preach:blackout')}
                            className="mr-4"
                        >
                            <MaterialIcons name="dark-mode" size={22} color={tokens.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowSections(true)}
                            accessibilityRole="button"
                            accessibilityLabel={t('preach:sections')}
                            className="mr-4"
                        >
                            <MaterialIcons name="format-list-numbered" size={22} color={tokens.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowSettings(true)}
                            accessibilityRole="button"
                            accessibilityLabel={t('preach:settings')}
                        >
                            <MaterialIcons name="tune" size={22} color={tokens.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* La línea de vuelo va SIEMPRE, con tablero o sin él: apagarlo
                dejaba al predicador sin hora y sin saber por dónde va. */}
            {chromeVisible && budgets.length > 0 && statusBarMode !== 'off' && (
                <PreachStatusBar
                    tokens={tokens}
                    budgets={budgets}
                    elapsedSeconds={shownSeconds(tokens, elapsed)}
                    readingIndex={sectionIndex}
                    pageIndex={safePageIndex}
                    pageCount={pageCount}
                    running={running}
                    numbers={statusBarMode === 'full'}
                    endAt={preachClock.endAt}
                />
            )}

            {/* Swipe horizontal para pasar página, además de las zonas de tap.
                Se decide al SOLTAR (handleTap), contra el punto de partida
                anotado al bajar el dedo: los manejadores del sistema de
                respuesta pasados a Pressable quedaban pisados por los suyos y
                el deslizamiento nunca pasaba página (revisión de A3). */}
            <Pressable
                className="flex-1"
                onPress={(e) => handleTap(e.nativeEvent.pageX)}
                onTouchStart={(e) => {
                    swipeStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
                    if (gate.touchStart(e.nativeEvent.touches, Date.now())) setBlackout(true);
                }}
            >
                <ScrollView
                    ref={scrollRef}
                    contentContainerStyle={{
                        // Sin medida en píxeles: PreachSectionBody se centra a
                        // sí mismo en 48 ch (D1). Esto es solo respiro mínimo.
                        paddingHorizontal: 24,
                        paddingTop: chromeVisible ? 16 : insets.top + 24,
                        paddingBottom: insets.bottom + 56,
                    }}
                >
                    {probe}
                    <View
                        style={{
                            width: measure,
                            alignSelf: 'center',
                            // Sin esto, mientras se miden las alturas se ve el
                            // movimiento entero de un flash antes de paginar.
                            opacity: showReading || (measure && (outlineOn || !measuring)) ? 1 : 0,
                        }}
                    >
                        {pageProbe}
                        {/* Guía de mirada al 66 % de la medida: se lee de
                            corrido hasta acá y el resto se dice mirando a la
                            gente. Sólo tiene sentido con la medida clavada. */}
                        {gazeLine && measure ? (
                            <View
                                pointerEvents="none"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    bottom: 0,
                                    left: measure * GAZE_LINE_RATIO,
                                    width: 1,
                                    backgroundColor: tokens.accent,
                                    opacity: 0.35,
                                }}
                            />
                        ) : null}
                        {showReading && passage ? (
                            <PreachReadingPage
                                passage={passage}
                                tokens={tokens}
                                fontSize={fontSize}
                                face={deliveryFace}
                                onTapAt={handleTap}
                            />
                        ) : null}
                        {!showReading && safePageIndex === 0 ? pageHeader : null}

                    {!showReading && outlineOn ? (
                        <PreachOutline
                            items={outline}
                            tokens={tokens}
                            fontSize={fontSize}
                            face={deliveryFace}
                            onTapAt={handleTap}
                        />
                    ) : null}

                    {showReading || outlineOn ? null : <PreachSectionBody
                        blocks={pageBlocks}
                        highlights={highlighting.highlights}
                        glyphs={highlighting.glyphs}
                        fontSize={fontSize}
                        tokens={tokens}
                        senseLines={senseLines}
                        face={deliveryFace}
                        hangingIndent={hangingIndent}
                        onBlockLayout={ink.rememberBlock}
                        layoutKey={inkLayoutKey}
                        onTapAt={handleTap}
                        onPressApparatus={setApparatus}
                        selection={highlighting.selection}
                        onSelectionChange={highlighting.beginSelection}
                        onSelectionEnd={highlighting.endSelection}
                        onPressCitation={openCitation}
                        onPressReference={setVerseRef}
                    />}

                    {/* Asomo: dos renglones de lo que viene, atenuados. Avisa
                        que el bloque sigue, y quita la duda de si la página
                        terminó la idea o la cortó. */}
                    {nextPeek && !showReading ? (
                        <View
                            pointerEvents="none"
                            style={{ marginTop: fontSize * 0.6, opacity: 0.32 }}
                        >
                            <Text
                                numberOfLines={2}
                                style={{
                                    color: tokens.textPrimary,
                                    fontSize,
                                    lineHeight: fontSize * 1.4,
                                }}
                                className="font-lexend"
                            >
                                {nextPeek}
                            </Text>
                        </View>
                    ) : null}

                    {!showReading &&
                        sectionIndex === sections.length - 1 &&
                        safePageIndex === pageCount - 1 &&
                        attributions.length > 0 && (
                        <View style={{ borderTopWidth: 1, borderTopColor: tokens.border }} className="mt-8 pt-4">
                            {attributions.map((block) => (
                                <View key={block.sourceId} className="mb-3">
                                    <Text
                                        style={{ color: tokens.textSecondary, fontSize: fontSize * 0.6 }}
                                        className="font-lexend-semibold"
                                    >
                                        {block.title}
                                    </Text>
                                    {block.lines.map((line, i) => (
                                        <Text
                                            key={i}
                                            style={{ color: tokens.textSecondary, fontSize: fontSize * 0.55 }}
                                            className="font-lexend"
                                        >
                                            {line}
                                        </Text>
                                    ))}
                                </View>
                            ))}
                        </View>
                    )}
                    </View>
                </ScrollView>
            </Pressable>

            {/* P7 — el tercio inferior es el tablero: timer y riel, los dos
                datos que se consultan de reojo desde el atril. */}
            {panelMode !== 'off' && budgets.length > 0 && (
                <View style={{ paddingBottom: insets.bottom }}>
                    <PreachInstrumentPanel
                        tokens={tokens}
                        fontSize={fontSize}
                        budgets={budgets}
                        elapsedSeconds={shownSeconds(tokens, elapsed)}
                        readingIndex={sectionIndex}
                        pageIndex={safePageIndex}
                        pageCount={pageCount}
                        height={panelHeight}
                        numbers={panelMode === 'full'}
                    />
                </View>
            )}

            {/* Riel de secciones */}
            <Modal
                visible={showSections}
                transparent
                animationType={tokens.animations ? 'slide' : 'none'}
                onRequestClose={() => setShowSections(false)}
            >
                <Pressable className="flex-1 bg-black/40" onPress={() => setShowSections(false)}>
                    <View
                        className="mt-auto rounded-t-2xl px-6 pt-5"
                        style={{ backgroundColor: tokens.surface, paddingBottom: insets.bottom + 20, maxHeight: '70%' }}
                    >
                        <Text style={{ color: tokens.textPrimary }} className="font-lexend-semibold text-lg mb-3">
                            {t('preach:sections')}
                        </Text>
                        <ScrollView>
                            {passage ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        setOnReadingPage(true);
                                        setShowSections(false);
                                    }}
                                    className="py-3"
                                >
                                    <Text
                                        style={{ color: showReading ? tokens.accent : tokens.textPrimary }}
                                        className="font-lexend text-base"
                                    >
                                        {t('preach:reading_label')} · {passage.title}
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
                            {sections.map((s, i) => (
                                <TouchableOpacity
                                    key={s.slug}
                                    onPress={() => {
                                        setOnReadingPage(false);
                                        goTo(i);
                                        setShowSections(false);
                                    }}
                                    className="py-3"
                                >
                                    <Text
                                        style={{ color: !showReading && i === sectionIndex ? tokens.accent : tokens.textPrimary }}
                                        className="font-lexend text-base"
                                    >
                                        {s.title || t('preach:opening')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>

            {/* La Biblia sin salir del sermón: abre en la referencia propia. */}
            <BibleConsultSheet
                // Abre en la referencia tocada, o en la del sermón. La key la
                // remonta: el cajón fija su libro al montarse.
                key={bibleRefs?.join('|') ?? 'sermon'}
                visible={showBible}
                tokens={tokens}
                face={deliveryFace}
                fontSize={fontSize}
                references={bibleRefs ?? sermon.bibleReferences ?? []}
                onClose={() => {
                    setShowBible(false);
                    setBibleRefs(null);
                }}
            />

            {/* El versículo de una referencia tocada en el manuscrito (C7):
                sin salir de la página. «Abrir en la Biblia» lleva al cajón. */}
            <Modal
                visible={verseRef !== null}
                transparent
                animationType={tokens.animations ? 'fade' : 'none'}
                onRequestClose={() => setVerseRef(null)}
            >
                <Pressable className="flex-1 bg-black/50 items-center justify-center px-8" onPress={() => setVerseRef(null)}>
                    <View className="rounded-2xl p-6 w-full max-w-2xl" style={{ backgroundColor: tokens.surface }}>
                        <Text style={{ color: tokens.accent }} className="font-lexend-semibold text-base mb-2">
                            {verseRef}
                        </Text>
                        <Text
                            style={{ color: tokens.textPrimary, fontSize: Math.max(18, fontSize * 0.75), lineHeight: Math.max(18, fontSize * 0.75) * 1.45 }}
                            className="font-lexend"
                        >
                            {(verseRef && verseTextFor(verseRef)) ?? t('preach:verse_unreadable')}
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                if (verseRef) setBibleRefs([verseRef]);
                                setVerseRef(null);
                                setShowBible(true);
                            }}
                            accessibilityRole="button"
                            className="self-end mt-4 px-4 py-2 rounded-full"
                            style={{ borderWidth: 1, borderColor: tokens.border }}
                        >
                            <Text style={{ color: tokens.textPrimary }} className="font-lexend-semibold text-sm">
                                {t('preach:open_in_bible')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* Ajustes: modo de luz, tipografía, corte de línea, duración */}
            <PreachSettingsSheet
                visible={showSettings}
                onClose={() => setShowSettings(false)}
                tokens={tokens}
                readingMode={readingMode}
                setReadingMode={setReadingMode}
                fontSize={fontSize}
                setFontSize={setFontSize}
                senseLines={senseLines}
                setSenseLines={setSenseLines}
                gazeLine={gazeLine}
                setGazeLine={setGazeLine}
                statusBarMode={statusBarMode}
                setStatusBarMode={setStatusBarMode}
                panelMode={panelMode}
                setPanelMode={setPanelMode}
                panelRatio={panelRatio}
                setPanelRatio={setPanelRatio}
                deliveryFace={deliveryFace}
                setDeliveryFace={setDeliveryFace}
                hangingIndent={hangingIndent}
                setHangingIndent={setHangingIndent}
                readingPage={readingPageOn}
                setReadingPage={setReadingPageOn}
                brightness={preachBrightness}
                setBrightness={setPreachBrightness}
                targetMinutes={targetMinutes}
                // Cambiar la duración ya no pone el reloj en cero (A4).
                onPickDuration={(min) => id && setTargetMinutes(id, min)}
                endAt={preachClock.endAt}
                onToggleEndAt={() =>
                    preachClock.setEndAt((at) =>
                        at !== null ? null : suggestedEndAt(Date.now(), targetMinutes * 60 - elapsed),
                    )
                }
                onShiftEndAt={(delta) =>
                    preachClock.setEndAt((at) => (at === null ? at : shiftEndAt(at, delta, Date.now())))
                }
                // Volver a cero, a mano: para un ensayo que se repite, o si el
                // reloj quedó mal. Antes no había forma.
                onResetClock={preachClock.reset}
                budgets={budgets}
                onSetBudget={(slug, seconds) => setBudgetOverride(`${id}|${slug}`, seconds)}
            />

            {/* Popover de cita [N] — primer cliente del citationManifest */}
            <Modal
                visible={citation !== null}
                transparent
                animationType={tokens.animations ? 'fade' : 'none'}
                onRequestClose={() => setCitation(null)}
            >
                <Pressable className="flex-1 bg-black/50 items-center justify-center px-8" onPress={() => setCitation(null)}>
                    <View className="rounded-2xl p-6 w-full max-w-2xl" style={{ backgroundColor: tokens.surface }}>
                        {(citation ?? []).map(({ ordinal, entry }) => (
                            <View key={ordinal} className="mb-4">
                                <Text style={{ color: tokens.accent }} className="font-lexend-semibold text-sm mb-1">
                                    [{ordinal}] {entry.title}
                                </Text>
                                {entry.author ? (
                                    <Text style={{ color: tokens.textSecondary }} className="font-lexend text-xs mb-1">
                                        {entry.author}
                                        {entry.page ? ` · ${t('preach:page')} ${entry.page}` : ''}
                                    </Text>
                                ) : null}
                                <Text style={{ color: tokens.textPrimary }} className="font-lexend text-base leading-6">
                                    “{entry.excerpt}”
                                </Text>
                            </View>
                        ))}
                    </View>
                </Pressable>
            </Modal>

            {/* Aparato de estudio: fuera del flujo de entrega, en capa (P5) */}
            <Modal
                visible={apparatus !== null}
                transparent
                animationType={tokens.animations ? 'fade' : 'none'}
                onRequestClose={() => setApparatus(null)}
            >
                <Pressable
                    className="flex-1 bg-black/50 items-center justify-center px-8"
                    onPress={() => setApparatus(null)}
                >
                    <View
                        className="rounded-2xl p-6 w-full max-w-2xl"
                        style={{ backgroundColor: tokens.surface, maxHeight: '70%' }}
                    >
                        <ScrollView>
                            <Text
                                style={{ color: tokens.textPrimary, fontSize: fontSize * 0.7 }}
                                className="font-lexend leading-6"
                            >
                                {apparatus}
                            </Text>
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>

            {/* Marcas: popover contextual junto a lo que se seleccionó. Un
                panel inferior tapaba el tablero y obligaba a mirar a otro
                lado del que se estaba marcando. */}
            <MarkPopover
                visible={highlighting.popoverOpen}
                tokens={tokens}
                anchorY={highlighting.popoverY}
                screenHeight={screenHeight}
                currentColor={highlighting.pendingColor}
                currentStyle={highlighting.pendingStyle}
                onPick={highlighting.applyMark}
                onRemove={highlighting.removeMark}
                onClose={highlighting.close}
                glyphs={{ current: highlighting.pendingGlyph, onPick: highlighting.applyGlyph }}
            />

            {/* Tinta encima de todo. Con el lápiz apagado la capa es
                transparente al tacto: predicar no puede quedar detrás de una
                capa de dibujo. */}
            {outlineOn ? null : <InkLayer
                tokens={tokens}
                notes={ink.notes}
                anchorRectFor={ink.anchorRectFor}
                bodySize={fontSize}
                penActive={ink.penActive}
                anchorAt={ink.anchorAt}
                onFinishStroke={ink.addStroke}
                color={ink.penColor}
                eraser={ink.eraser}
                onErase={ink.eraseStroke}
                top={chromeTop}
                bottom={panelHeight + insets.bottom}
            />}

            {/* Barra del lápiz: colores, goma y salida. Va DESPUÉS de la capa
                para quedar por encima — si quedara debajo, la propia capa
                taparía el botón de salir y no habría cómo apagar el lápiz. */}
            {ink.penActive ? (
                <View
                    className="absolute flex-row items-center rounded-full px-3 py-2"
                    style={{
                        right: 20,
                        bottom: panelHeight + insets.bottom + 20,
                        backgroundColor: tokens.surface,
                        borderWidth: 1,
                        borderColor: tokens.border,
                    }}
                >
                    {(['ink', 'blue', 'red'] as const).map((c) => (
                        <TouchableOpacity
                            key={c}
                            onPress={() => {
                                ink.setPenColor(c);
                                ink.setEraser(false);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t(`preach:ink_${c}`)}
                            className="mr-2"
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor:
                                    c === 'red'
                                        ? tokens.timerOver
                                        : c === 'blue'
                                          ? tokens.accent
                                          : tokens.textPrimary,
                                borderWidth: c === ink.penColor && !ink.eraser ? 3 : 0,
                                borderColor: tokens.background,
                            }}
                        />
                    ))}
                    <TouchableOpacity
                        onPress={() => ink.setEraser(!ink.eraser)}
                        accessibilityRole="button"
                        accessibilityLabel={t('preach:eraser')}
                        className="items-center justify-center mr-1"
                        style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            backgroundColor: ink.eraser ? tokens.accent : 'transparent',
                        }}
                    >
                        <MaterialIcons
                            name="auto-fix-normal"
                            size={20}
                            color={ink.eraser ? tokens.background : tokens.textPrimary}
                        />
                    </TouchableOpacity>
                    <View style={{ width: 1, height: 24, backgroundColor: tokens.border }} className="mx-1" />
                    <TouchableOpacity
                        onPress={() => {
                            ink.setPenActive(false);
                            ink.setEraser(false);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('preach:pen_done')}
                        className="px-3 py-1"
                    >
                        <Text style={{ color: tokens.accent }} className="font-lexend-semibold text-sm">
                            {t('preach:pen_done')}
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {/* Salida: informe del ensayo y registro de la predicación (F3).
                No es un modal apurado — al bajar del púlpito hay algo que
                decir sobre lo que acaba de pasar. */}
            <PreachExitSheet
                visible={showExit}
                tokens={tokens}
                report={buildRehearsalReport(budgets, preachClock.spent)}
                sermonId={id ?? ''}
                elapsedSeconds={elapsed}
                onClose={() => setShowExit(false)}
                onLeave={() => {
                    setShowExit(false);
                    preachClock.finish();
                    router.back();
                }}
            />

            {/* Blackout: pantalla negra total; un tap la retira */}
            {blackout && (
                <Pressable
                    onPress={() => setBlackout(false)}
                    className="absolute inset-0"
                    style={{ backgroundColor: '#000000' }}
                />
            )}
        </View>
    );
}

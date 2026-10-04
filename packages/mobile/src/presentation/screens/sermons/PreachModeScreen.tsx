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
import type { CitationManifestEntry, ReadingBlock } from '@dosfilos/domain';
import {
    aggregateRequiredAttributions,
    buildMovementBudgets,
    buildReadingBlocks,
    buildRehearsalReport,
} from '@dosfilos/domain';

import { useSermon } from '@/presentation/hooks/useSermons';
import { usePreachHighlights } from '@/presentation/hooks/usePreachHighlights';
import { extractSectionsWithBody } from '@/core/utils/sermonSections';
import { READING_MODES } from '@/core/theme/readingModes';
import { GAZE_LINE_RATIO, TYPE_SCALE } from '@/core/theme/typography';
import { useReaderSettingsStore } from '@/presentation/state/readerSettings.store';
import { PreachSectionBody } from '@/presentation/components/preach/PreachSectionBody';
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
import { useConnectivityStore } from '@/presentation/state/connectivity.store';
import { createGestureGate, tapZone } from './preachGestures';

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
    const { data: sermon, isLoading, error, refetch } = useSermon(id ?? '');

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
    const [showSections, setShowSections] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showBible, setShowBible] = useState(false);
    const [citation, setCitation] = useState<{ ordinal: number; entry: CitationManifestEntry }[] | null>(
        null,
    );
    /** Cita de bloque abierta desde su marca al margen (P5). */
    const [apparatus, setApparatus] = useState<string | null>(null);

    const [targetMinutes, setTargetMinutes] = useState(30);
    const [elapsed, setElapsed] = useState(0);
    const [running, setRunning] = useState(false);
    /**
     * F3 — el cronómetro con memoria. Acumula segundos POR MOVIMIENTO, que es
     * lo que convierte la app de visor en entrenador: al terminar, el pastor
     * ve que la introducción le comió 12 de sus 35 minutos.
     */
    const [spentBySlug, setSpentBySlug] = useState<Record<string, number>>({});
    const [showExit, setShowExit] = useState(false);
    const scrollRef = useRef<ScrollView>(null);
    // Toques: un dedo pasa página, dos dedos dos veces apagan (A3).
    const [gate] = useState(createGestureGate);
    const swipeStart = useRef<{ x: number; y: number } | null>(null);
    // El intervalo no debe recrearse en cada cambio de sección: lee el slug
    // vigente por ref en vez de entrar en las dependencias del efecto.
    const sectionSlugRef = useRef<string | null>(null);

    const swipeDelta = (event: { pageX: number; pageY: number }) => {
        const from = swipeStart.current;
        if (!from) return { dx: 0, dy: 0 };
        return { dx: event.pageX - from.x, dy: event.pageY - from.y };
    };

    useEffect(() => {
        if (!running) return;
        const timer = setInterval(() => {
            setElapsed((e) => e + 1);
            // El segundo se le carga al movimiento que se está leyendo, no al
            // que el reloj dice que tocaría: interesa lo que pasó de verdad.
            setSpentBySlug((current) => {
                const slug = sectionSlugRef.current;
                if (!slug) return current;
                return { ...current, [slug]: (current[slug] ?? 0) + 1 };
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [running]);

    const sections = sermon?.content ? extractSectionsWithBody(sermon.content) : [];
    const section = sections[sectionIndex];
    const manifest = sermon?.citationManifest;
    const attributions = aggregateRequiredAttributions(manifest);

    // El slug vigente viaja por ref para que el intervalo no se recree en cada
    // cambio de movimiento — recrearlo perdería la fracción de segundo en
    // curso. Se escribe en un efecto: durante el render está prohibido.
    useEffect(() => {
        sectionSlugRef.current = section?.slug ?? null;
    }, [section?.slug]);


    const blocks = section ? buildReadingBlocks(section.body) : [];

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
    const budgets = buildMovementBudgets(
        sections.map((sec) => ({ slug: sec.slug, title: sec.title || t('preach:opening'), body: sec.body })),
        targetMinutes * 60,
        Object.fromEntries(
            sections
                .map((sec) => [sec.slug, budgetOverrides[`${id}|${sec.slug}`]] as const)
                .filter(([, value]) => typeof value === 'number'),
        ),
    );

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
    const pageHeight = readableHeight - panelHeight - fontSize * 2;

    const renderBlockForMeasure = (block: ReadingBlock, index: number) => (
        <PreachSectionBody
            blocks={[block]}
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

    const { pages, measuring, probe: pageProbe } = usePagination({
        blocks,
        availableHeight: pageHeight,
        renderBlock: renderBlockForMeasure,
        // La familia entra en la clave: distintas fuentes dan distinta altura
        // de línea, y paginar con las alturas de otra fuente corta mal.
        layoutKey: `${section?.slug ?? ''}|${fontSize}|${senseLines}|${deliveryFace}|${hangingIndent}|${measure ?? 0}`,
    });

    const safePageIndex = Math.min(pageIndex, Math.max(0, pages.length - 1));
    const pageBlocks = pages.length
        ? pages[safePageIndex].map((i) => blocks[i])
        : blocks;

    // Texto de la página siguiente para el asomo. Sale del primer bloque que
    // viene: alcanza para saber si la idea sigue o si acá cerró.

    const nextPeek =
        pages.length && safePageIndex < pages.length - 1
            ? blocks[pages[safePageIndex + 1][0]]?.text ?? null
            : null;

    // El resaltado por tap largo vive en su propio hook: la pantalla ya
    // carga timer, modos de luz, navegación por secciones y citas.
    // El pulso se apaga solo en e-ink: los lectores BOOX no tienen motor
    // háptico. Atril apaga animaciones pero conserva el pulso.
    const highlighting = usePreachHighlights(id ?? '', section, readingMode !== 'eink');

    const goTo = (index: number) => {
        if (index < 0 || index >= sections.length) return;
        setSectionIndex(index);
        setPageIndex(0);
        scrollRef.current?.scrollTo({ y: 0, animated: tokens.animations });
    };

    /**
     * El avance es POR PÁGINA, no por movimiento. Al llegar al borde salta al
     * movimiento vecino: para el predicador el sermón es continuo, la división
     * en movimientos sirve para ubicarse, no para tener que navegarla.
     */
    const step = (delta: number) => {
        const next = safePageIndex + delta;
        if (next >= 0 && next < pages.length) {
            setPageIndex(next);
            scrollRef.current?.scrollTo({ y: 0, animated: tokens.animations });
            return;
        }
        if (delta > 0 && sectionIndex < sections.length - 1) {
            goTo(sectionIndex + 1);
        } else if (delta < 0 && sectionIndex > 0) {
            // Al retroceder de movimiento se entra por su ÚLTIMA página, que
            // es donde estabas leyendo cuando avanzaste.
            setSectionIndex(sectionIndex - 1);
            setPageIndex(Number.MAX_SAFE_INTEGER);
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
        const zone = tapZone(x, width);
        if (zone === 'back') step(-1);
        else if (zone === 'forward') step(1);
        else setChromeVisible((v) => !v);
    };

    // Salir pasa por la hoja de salida si hubo predicación: ahí se registra.
    const requestExit = () => (elapsed > 60 ? setShowExit(true) : router.back());

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
    if (error || !sermon) {
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
                        <TouchableOpacity onPress={() => setRunning((r) => !r)} className="mr-5">
                            <MaterialIcons
                                name={running ? 'pause' : 'play-arrow'}
                                size={26}
                                color={running ? tokens.accent : tokens.textSecondary}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
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
                        </TouchableOpacity>
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
                    elapsedSeconds={elapsed}
                    readingIndex={sectionIndex}
                    pageIndex={safePageIndex}
                    pageCount={Math.max(1, pages.length)}
                    running={running}
                    numbers={statusBarMode === 'full'}
                />
            )}

            {/* Swipe horizontal para pasar página, además de las zonas de tap.
                Sólo reclama el gesto si es claramente horizontal y largo: si
                no, se comería el arrastre de selección y el scroll vertical
                de una página que no entró. */}
            <Pressable
                className="flex-1"
                onPress={(e) => handleTap(e.nativeEvent.pageX)}
                onMoveShouldSetResponder={(e) => {
                    const { dx, dy } = swipeDelta(e.nativeEvent);
                    return Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 2;
                }}
                // El origen se anota en onTouchStart, no en onResponderGrant:
                // ese corre DESPUÉS de reclamar el gesto, y para decidir si
                // reclamarlo ya hace falta saber de dónde salió el dedo.
                onTouchStart={(e) => {
                    swipeStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
                    if (gate.touchStart(e.nativeEvent.touches.length, Date.now())) setBlackout(true);
                }}
                onResponderRelease={(e) => {
                    const { dx } = swipeDelta(e.nativeEvent);
                    swipeStart.current = null;
                    if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1);
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
                            opacity: measure && !measuring ? 1 : 0,
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
                        {sectionIndex === 0 && safePageIndex === 0 && (
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
                        )}
                        {section?.title && safePageIndex === 0 ? (
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

                    <PreachSectionBody
                        blocks={pageBlocks}
                        highlights={highlighting.highlights}
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
                    />

                    {/* Asomo: dos renglones de lo que viene, atenuados. Avisa
                        que el bloque sigue, y quita la duda de si la página
                        terminó la idea o la cortó. */}
                    {nextPeek ? (
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

                    {sectionIndex === sections.length - 1 &&
                        safePageIndex === Math.max(0, pages.length - 1) &&
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
                        elapsedSeconds={elapsed}
                        readingIndex={sectionIndex}
                        pageIndex={safePageIndex}
                        pageCount={Math.max(1, pages.length)}
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
                            {sections.map((s, i) => (
                                <TouchableOpacity
                                    key={s.slug}
                                    onPress={() => {
                                        goTo(i);
                                        setShowSections(false);
                                    }}
                                    className="py-3"
                                >
                                    <Text
                                        style={{ color: i === sectionIndex ? tokens.accent : tokens.textPrimary }}
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
                visible={showBible}
                tokens={tokens}
                face={deliveryFace}
                fontSize={fontSize}
                references={sermon.bibleReferences ?? []}
                onClose={() => setShowBible(false)}
            />

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
                targetMinutes={targetMinutes}
                onPickDuration={(min) => {
                    setTargetMinutes(min);
                    setElapsed(0);
                }}
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
            />

            {/* Tinta encima de todo. Con el lápiz apagado la capa es
                transparente al tacto: predicar no puede quedar detrás de una
                capa de dibujo. */}
            <InkLayer
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
            />

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
                report={buildRehearsalReport(budgets, spentBySlug)}
                sermonId={id ?? ''}
                elapsedSeconds={elapsed}
                onClose={() => setShowExit(false)}
                onLeave={() => {
                    setShowExit(false);
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

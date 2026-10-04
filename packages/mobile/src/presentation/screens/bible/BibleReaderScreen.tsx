import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { INK_COLORS } from '@dosfilos/domain';
import type { HighlightColor, MarkStyle } from '@dosfilos/domain';
import { TABLET_EDITING } from '@/core/config/features';

import { READING_MODES } from '@/core/theme/readingModes';
import { FACE_CLASS } from '@/core/theme/typography';
import { useReaderSettingsStore } from '@/presentation/state/readerSettings.store';
import { useBibleMarks, useBibleMarkMutations } from '@/presentation/hooks/useBibleMarks';
import { verseKey } from '@/domain/bible/entities/BibleMark';
import { useDeliveryMeasure } from '@/presentation/hooks/useDeliveryMeasure';
import {
    SelectableVerses,
    selectionText,
    type WordSelection,
} from '@/presentation/components/bible/SelectableVerses';
import { InkLayer } from '@/presentation/components/preach/InkLayer';
import { MarkPopover } from '@/presentation/components/preach/MarkPopover';
import { useBibleInk } from '@/presentation/hooks/useBibleInk';
import { useSharedValue } from 'react-native-reanimated';
import { formatSelectionForSermon } from '@/presentation/components/bible/passageFormat';
import { BiblePickerSheet } from '@/presentation/components/bible/BiblePickerSheet';
import { BibleSearchSheet } from '@/presentation/components/bible/BibleSearchSheet';
import { BibleSettingsSheet } from '@/presentation/components/bible/BibleSettingsSheet';
import { BibleVersionFactory, bookIdInVersion } from '@/data/repositories/bible/BibleVersionFactory';

/**
 * El lector — la PUERTA 1 de la Biblia: cuando el pastor va a leer.
 *
 * Reemplaza a las cuatro pantallas anteriores (biblioteca → versión → lector →
 * búsqueda). Elegir versión y elegir libro no son destinos: son controles. La
 * ceremonia sobraba, la función no — por eso todo sigue estando, a un toque.
 *
 * Hereda del púlpito la tipografía, la medida en caracteres y los cinco modos
 * de luz. No es prolijidad: el ojo del pastor no debería cambiar de registro
 * entre el sermón y el pasaje que lo sostiene.
 */
/** Aire entre las dos columnas del paralelo. */
const COLUMN_GAP = 28;

/** Etiqueta propia: no apaga la que mantiene el atril encendido. */
const KEEP_AWAKE_TAG = 'bible-reader';

export default function BibleReaderScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const readingMode = useReaderSettingsStore((s) => s.readingMode);
    // Cuerpo y familia PROPIOS del lector, no los del atril: predicar de pie a
    // 70 cm y estudiar sentado no piden lo mismo, y compartir el valor hacía
    // que tocar uno cambiara el otro por la espalda.
    const face = useReaderSettingsStore((s) => s.bibleFace);
    const fontSize = useReaderSettingsStore((s) => s.fontSize);
    const lineSpacing = useReaderSettingsStore((s) => s.lineSpacing);
    const verseNumbers = useReaderSettingsStore((s) => s.verseNumbers);
    const keepAwake = useReaderSettingsStore((s) => s.keepAwake);
    const tokens = READING_MODES[readingMode];

    // Retoma donde quedó: el estado inicial sale de lo guardado.
    const lastRead = useReaderSettingsStore((s) => s.lastRead);
    const setLastRead = useReaderSettingsStore((s) => s.setLastRead);
    const [versionId, setVersionId] = useState(lastRead?.versionId ?? 'rvr1960');
    const [parallelId, setParallelId] = useState<string | null>(null);
    // `jn` es Jonás EN ESTE juego de datos (Juan es `jo`). El id se escribe
    // acá y no se adivina: los ids del dato no son los del dominio.
    const [bookId, setBookId] = useState(lastRead?.bookId ?? 'jn');
    const [chapter, setChapter] = useState(lastRead?.chapter ?? 1);
    const [selection, setSelection] = useState<WordSelection | null>(null);
    const [popoverY, setPopoverY] = useState(0);
    const [showPopover, setShowPopover] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const { height: screenHeight } = useWindowDimensions();
    /** Alto de la cabecera: la capa de tinta empieza debajo para no taparla. */
    const [headerHeight, setHeaderHeight] = useState(0);
    /** Alto de la barra de ayuda del lápiz: la tinta también empieza debajo. */
    const [hintHeight, setHintHeight] = useState(0);
    /**
     * Ancho disponible para leer, MEDIDO.
     *
     * Las columnas se calculan en píxeles a partir de esto en vez de repartirse
     * con `flex` y porcentajes. Con porcentajes, el ancho de la columna dependía
     * de una cadena de contenedores —y bastaba que uno no resolviera su ancho
     * para que el texto se saliera de la pantalla, que es lo que pasaba al
     * abrir el paralelo.
     */
    const [availableWidth, setAvailableWidth] = useState(0);
    const { data: marks } = useBibleMarks();
    const { set: setMark, clear: clearMark } = useBibleMarkMutations();
    const { measure, probe } = useDeliveryMeasure(fontSize);
    const fullWidth = useReaderSettingsStore((s) => s.fullWidth);
    const setFullWidth = useReaderSettingsStore((s) => s.setFullWidth);

    /**
     * Firma del layout: al cambiar, los versículos se vuelven a medir.
     *
     * Sin esto la tinta queda a medias, porque `onLayout` sólo dispara para
     * las vistas que efectivamente se movieron. Es exactamente el bug que ya
     * costó dos vueltas en el púlpito.
     */
    const inkLayoutKey = `${bookId}|${chapter}|${fontSize}|${parallelId ?? ''}|${readingMode}|${fullWidth}|${lineSpacing}|${verseNumbers}|${face}`;
    const ink = useBibleInk(bookId, chapter, inkLayoutKey);
    // Cuánto bajó el capítulo. La tinta vive en coordenadas del TEXTO (las de
    // pantalla más esto): antes quedaba fija mientras el capítulo se movía.
    const scrollY = useSharedValue(0);

    const repo = BibleVersionFactory.getByVersion(versionId);
    const parallelRepo = parallelId ? BibleVersionFactory.getByVersion(parallelId) : null;

    const books = repo?.getBooks() ?? [];
    const book = books.find((b) => b.id === bookId) ?? books[0];
    const verses = repo?.getChapterContent(bookId, chapter) ?? [];
    /**
     * El mismo capítulo EN LA OTRA VERSIÓN.
     *
     * El id del libro no cruza de una versión a la otra: `jn` es Jonás en la
     * RVR y no existe en la ASV, que lo numera `32`. Se traduce por el id
     * canónico, que es el único vocabulario común.
     */
    const parallelBookId = parallelRepo
        ? parallelRepo.getBookIdForCanonical(repo.getCanonicalBookId(bookId))
        : null;
    const parallelVerses = parallelBookId
        ? (parallelRepo?.getChapterContent(parallelBookId, chapter) ?? [])
        : [];
    const chapterCount = repo?.getChapterCount(bookId) ?? 1;

    /** Los versículos que toca la selección, con sus extremos de palabra. */
    const selectedRanges = () => {
        if (!selection) return [];
        const ranges = [];
        for (let verse = selection.startVerse; verse <= selection.endVerse; verse += 1) {
            ranges.push({
                verse,
                from: verse === selection.startVerse ? selection.startWord : undefined,
                to: verse === selection.endVerse ? selection.endWord : undefined,
            });
        }
        return ranges;
    };

    const closePopover = () => {
        setShowPopover(false);
        setSelection(null);
    };

    const applyMark = (color: HighlightColor, style: MarkStyle) => {
        setMark.mutate({ versionId, bookId, chapter, ranges: selectedRanges(), color, style });
        closePopover();
    };

    const removeMark = () => {
        clearMark.mutate({
            bookId,
            chapter,
            verses: selectedRanges().map((r) => r.verse),
        });
        closePopover();
    };

    const copyToSermon = () => {
        if (!selection) return;
        // Viaja lo SELECCIONADO, no el versículo entero: si el pastor eligió
        // media frase, es esa media frase la que quiere en el sermón.
        const markdown = formatSelectionForSermon(
            book?.name ?? bookId,
            chapter,
            selection.startVerse,
            selection.endVerse,
            selectionText(verses, selection),
        );
        closePopover();
        // El pasaje viaja por parámetro: el editor lo recibe y lo inserta donde
        // esté el cursor. Copiar al portapapeles obligaría a pegar a mano.
        router.push(`/sermon/paste?markdown=${encodeURIComponent(markdown)}`);
    };

    // La tablet apoyada en el escritorio se apaga a los treinta segundos
    // porque nadie la toca, y leer no es tocar.
    //
    // Con `activate/deactivate` y no con `useKeepAwake`: ese hook mantiene la
    // pantalla encendida SIEMPRE que está montado —el argumento es una
    // etiqueta, no un interruptor— así que con él el ajuste no se podría
    // apagar.
    useEffect(() => {
        if (!keepAwake) return;
        activateKeepAwakeAsync(KEEP_AWAKE_TAG);
        return () => {
            deactivateKeepAwake(KEEP_AWAKE_TAG);
        };
    }, [keepAwake]);

    // Se anota después de pintar, no durante el render: escribir en un store
    // mientras React renderiza puede reentrar en el mismo árbol.
    useEffect(() => {
        setLastRead({ versionId, bookId, chapter });
    }, [versionId, bookId, chapter, setLastRead]);

    /** Marca ya existente bajo la selección, para que el popover la muestre. */
    const currentMark = selection
        ? marks?.get(verseKey(bookId, chapter, selection.startVerse))
        : undefined;

    /**
     * Cambiar de versión conserva el libro.
     *
     * El id no cruza entre versiones, así que sin traducir por el canónico
     * pasar de la RVR a la ASV dejaba un id que la otra no reconoce y el
     * lector volvía a Génesis.
     */
    const changeVersion = (nextVersionId: string) => {
        const translated = bookIdInVersion(versionId, nextVersionId, bookId);
        setVersionId(nextVersionId);
        if (translated) setBookId(translated);
        if (parallelId === nextVersionId) setParallelId(null);
    };

    /**
     * Ancho de cada columna y del bloque entero.
     *
     * Con paralelo, las dos columnas se reparten lo disponible: leer dos
     * versiones exige ver las dos, y una medida "ideal" que no entra en
     * pantalla no es una medida, es un desborde. Sin paralelo manda la medida
     * de lectura, salvo que el pastor haya pedido ancho completo.
     */
    const columnWidth = parallelId
        ? Math.max(200, (availableWidth - COLUMN_GAP) / 2)
        : fullWidth
          ? availableWidth
          : Math.min(availableWidth, measure ?? availableWidth);
    const totalWidth = parallelId ? availableWidth : columnWidth;

    const goChapter = (delta: number) => {
        const next = chapter + delta;
        if (next >= 1 && next <= chapterCount) {
            setChapter(next);
            setSelection(null);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: tokens.background }}>
            {/* Cabecera: libro y capítulo abren el selector; la versión es un
                interruptor, no una pantalla previa. */}
            <View
                className="flex-row items-center px-5 pb-3"
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                style={{
                    paddingTop: insets.top + 8,
                    borderBottomWidth: 1,
                    borderBottomColor: tokens.border,
                }}
            >
                <TouchableOpacity
                    onPress={() => setShowPicker(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('bible:pick_passage')}
                    className="flex-row items-center"
                >
                    <Text
                        style={{ color: tokens.textPrimary }}
                        className={`${FACE_CLASS[face].semibold} text-xl`}
                    >
                        {book?.name ?? ''} {chapter}
                    </Text>
                    <MaterialIcons name="expand-more" size={22} color={tokens.textSecondary} />
                </TouchableOpacity>

                <View className="flex-1" />

                {/* Columna medida o página entera. La columna es lo correcto
                    para leer; el ancho completo sirve para mirar de un vistazo,
                    y en una tablet de 13″ la diferencia se nota. */}
                <TouchableOpacity
                    onPress={() => setFullWidth(!fullWidth)}
                    accessibilityRole="button"
                    accessibilityLabel={t('bible:full_width')}
                    className="mr-4"
                >
                    <MaterialIcons
                        name={fullWidth ? 'format-align-justify' : 'format-align-center'}
                        size={22}
                        color={fullWidth ? tokens.accent : tokens.textSecondary}
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setParallelId(parallelId ? null : versionId === 'rvr1960' ? 'asv' : 'rvr1960')}
                    accessibilityRole="button"
                    accessibilityLabel={t('bible:parallel')}
                    className="mr-4"
                >
                    <MaterialIcons
                        name="view-column"
                        size={22}
                        color={parallelId ? tokens.accent : tokens.textSecondary}
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setShowSearch(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('bible:search')}
                    className="mr-4"
                >
                    <MaterialIcons name="search" size={22} color={tokens.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setShowSettings(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('bible:reader_settings')}
                    className="mr-4"
                >
                    <MaterialIcons name="tune" size={22} color={tokens.textSecondary} />
                </TouchableOpacity>

                {/* Lápiz. La Biblia del pastor está escrita al margen: era lo
                    único que el atril sabía hacer y el lector no. */}
                <TouchableOpacity
                    onPress={() => {
                        ink.setPenActive(!ink.penActive);
                        ink.setEraser(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('preach:pen')}
                >
                    <MaterialIcons
                        name={ink.penActive ? 'draw' : 'edit'}
                        size={22}
                        color={ink.penActive ? tokens.accent : tokens.textSecondary}
                    />
                </TouchableOpacity>

                {ink.penActive ? (
                    <>
                        {INK_COLORS.map((color) => (
                            <TouchableOpacity
                                key={color}
                                onPress={() => {
                                    ink.setPenColor(color);
                                    ink.setEraser(false);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={t(`preach:ink_${color}`)}
                                className="ml-3"
                                style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 11,
                                    backgroundColor:
                                        color === 'red'
                                            ? tokens.timerOver
                                            : color === 'blue'
                                              ? tokens.accent
                                              : tokens.textPrimary,
                                    borderWidth: ink.penColor === color && !ink.eraser ? 2 : 0,
                                    borderColor: tokens.background,
                                }}
                            />
                        ))}
                        <TouchableOpacity
                            onPress={() => ink.setEraser(!ink.eraser)}
                            accessibilityRole="button"
                            accessibilityLabel={t('preach:eraser')}
                            className="ml-3"
                        >
                            <MaterialIcons
                                name="auto-fix-normal"
                                size={22}
                                color={ink.eraser ? tokens.accent : tokens.textSecondary}
                            />
                        </TouchableOpacity>
                    </>
                ) : null}
            </View>

            <ScrollView
                onLayout={(e) => setAvailableWidth(e.nativeEvent.layout.width - 48)}
                onScroll={(e) => {
                    scrollY.value = e.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
                contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 120 }}
            >
                {probe}
                <View style={{ alignSelf: 'center', width: totalWidth }}>
                    {/* La dirección va por ESTILO y no por `className`: ya nos
                        pasó en el rail que una clase condicional junto a un
                        estilo no llegue a aplicarse, y acá el síntoma sería
                        justamente éste — las dos versiones una debajo de la
                        otra en vez de lado a lado. */}
                    <View style={{ flexDirection: parallelId ? 'row' : 'column' }}>
                        <View style={{ width: columnWidth, marginRight: parallelId ? COLUMN_GAP : 0 }}>
                            {parallelId ? (
                                // Sin rótulo, dos columnas de texto parecido no
                                // dicen cuál es cuál.
                                <Text
                                    style={{ color: tokens.textSecondary, marginBottom: 10 }}
                                    className={`${FACE_CLASS[face].semibold} text-xs`}
                                >
                                    {versionId.toUpperCase()}
                                </Text>
                            ) : null}
                            <SelectableVerses
                                bookId={bookId}
                                chapter={chapter}
                                verses={verses}
                                marks={marks ?? new Map()}
                                tokens={tokens}
                                face={face}
                                fontSize={fontSize}
                                lineSpacing={lineSpacing}
                                showVerseNumbers={verseNumbers}
                                selection={selection}
                                onSelectionChange={setSelection}
                                onSelectionEnd={(range, atY) => {
                                    setSelection(range);
                                    setPopoverY(atY);
                                    setShowPopover(true);
                                }}
                                onVerseLayout={(verse, rect) =>
                                    ink.rememberVerse(verse, { ...rect, y: rect.y + scrollY.value })
                                }
                                layoutKey={inkLayoutKey}
                            />
                        </View>
                        {parallelId ? (
                            <View style={{ width: columnWidth }}>
                                <Text
                                    style={{ color: tokens.textSecondary, marginBottom: 10 }}
                                    className={`${FACE_CLASS[face].semibold} text-xs`}
                                >
                                    {parallelId.toUpperCase()}
                                </Text>
                                {parallelVerses.length === 0 ? (
                                    <Text
                                        style={{ color: tokens.textSecondary }}
                                        className={`${FACE_CLASS[face].regular} text-sm`}
                                    >
                                        {t('bible:not_in_version')}
                                    </Text>
                                ) : null}
                                <SelectableVerses
                                    bookId={parallelBookId ?? bookId}
                                    chapter={chapter}
                                    verses={parallelVerses}
                                    marks={new Map()}
                                    tokens={tokens}
                                    face={face}
                                    fontSize={fontSize}
                                    lineSpacing={lineSpacing}
                                    showVerseNumbers={verseNumbers}
                                    selection={null}
                                    onSelectionChange={() => undefined}
                                    onSelectionEnd={() => undefined}
                                />
                            </View>
                        ) : null}
                    </View>

                    <View className="flex-row justify-between mt-10">
                        <TouchableOpacity
                            onPress={() => goChapter(-1)}
                            disabled={chapter <= 1}
                            accessibilityRole="button"
                            accessibilityLabel={t('bible:previous_chapter')}
                            style={{ opacity: chapter <= 1 ? 0.3 : 1 }}
                        >
                            <MaterialIcons name="chevron-left" size={30} color={tokens.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => goChapter(1)}
                            disabled={chapter >= chapterCount}
                            accessibilityRole="button"
                            accessibilityLabel={t('bible:next_chapter')}
                            style={{ opacity: chapter >= chapterCount ? 0.3 : 1 }}
                        >
                            <MaterialIcons name="chevron-right" size={30} color={tokens.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {ink.penActive ? (
                // El gesto hay que enseñarlo: nadie adivina que dos dedos
                // desplazan mientras uno escribe.
                <View
                    onLayout={(e) => setHintHeight(e.nativeEvent.layout.height)}
                    style={{
                        paddingVertical: 6,
                        paddingHorizontal: 24,
                        backgroundColor: tokens.surface,
                        borderBottomWidth: 1,
                        borderBottomColor: tokens.border,
                    }}
                >
                    <Text
                        style={{ color: tokens.textSecondary }}
                        className={`${FACE_CLASS[face].regular} text-xs`}
                    >
                        {ink.eraser ? t('bible:eraser_hint') : t('bible:pen_hint')}
                    </Text>
                </View>
            ) : null}

            {/* La tinta va encima del texto pero debajo de la cabecera: si la
                tapara, no habría cómo apagar el lápiz. */}
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
                scrollOffset={scrollY}
                top={headerHeight + hintHeight}
                bottom={0}
            />

            {/* Popover contextual, igual que en el púlpito: aparece al lado
                de lo que se eligió. La barra inferior obligaba a mirar al
                otro extremo de la pantalla del que se estaba marcando. */}
            <MarkPopover
                visible={showPopover}
                tokens={tokens}
                anchorY={popoverY}
                screenHeight={screenHeight}
                currentColor={currentMark?.color ?? null}
                currentStyle={currentMark?.style ?? null}
                onPick={applyMark}
                onRemove={removeMark}
                onClose={closePopover}
                extraAction={
                    // Agrega al sermón PUBLICADO: apagado en la v1 (D5).
                    TABLET_EDITING
                        ? { icon: 'post-add', label: t('bible:to_sermon'), onPress: copyToSermon }
                        : undefined
                }
            />

            <BibleSettingsSheet
                visible={showSettings}
                tokens={tokens}
                onClose={() => setShowSettings(false)}
            />

            <BiblePickerSheet
                visible={showPicker}
                tokens={tokens}
                face={face}
                books={books}
                bookId={bookId}
                chapter={chapter}
                versionId={versionId}
                onPick={(nextBook, nextChapter) => {
                    setBookId(nextBook);
                    setChapter(nextChapter);
                    setSelection(null);
                    setShowPicker(false);
                }}
                onPickVersion={changeVersion}
                onClose={() => setShowPicker(false)}
            />

            <BibleSearchSheet
                visible={showSearch}
                tokens={tokens}
                face={face}
                versionId={versionId}
                currentBookId={bookId}
                currentBookName={book?.name ?? ''}
                onOpen={(nextBook, nextChapter, nextVerse) => {
                    setBookId(nextBook);
                    setChapter(nextChapter);
                    // El versículo encontrado queda SELECCIONADO: abrir el
                    // capítulo y dejar que el pastor lo busque de nuevo con la
                    // vista es devolverle el trabajo que acababa de hacer.
                    setSelection({
                        startVerse: nextVerse,
                        startWord: 0,
                        endVerse: nextVerse,
                        // Sin contar las palabras: cualquier índice del
                        // versículo cae dentro, que es justo lo que se quiere.
                        endWord: Number.MAX_SAFE_INTEGER,
                    });
                    setShowSearch(false);
                }}
                onClose={() => setShowSearch(false)}
            />
        </View>
    );
}

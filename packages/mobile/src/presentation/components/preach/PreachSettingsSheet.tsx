import React from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { READING_MODE_LABEL_KEYS, ReadingMode, ReadingModeTokens } from '@/core/theme/readingModes';
import { DELIVERY_FACES, DELIVERY_SIZE } from '@/core/theme/typography';
import type { DeliveryFace } from '@/core/theme/typography';
import { targetMinuteOptions, type MovementBudget } from '@dosfilos/domain';
import type { InstrumentMode } from '@/presentation/state/readerSettings.store';
import { formatWallTime } from '@/core/utils/wallTime';

const MODES: ReadingMode[] = ['claro', 'sepia', 'oscuro', 'atril', 'eink'];
/** Guías de mirada, EXCLUYENTES entre sí. Ver el comentario del render. */
const GAZE_GUIDES = ['none', 'sense', 'line'] as const;

interface Props {
    visible: boolean;
    onClose: () => void;
    tokens: ReadingModeTokens;
    readingMode: ReadingMode;
    setReadingMode: (mode: ReadingMode) => void;
    fontSize: number;
    setFontSize: (size: number) => void;
    senseLines: boolean;
    setSenseLines: (on: boolean) => void;
    gazeLine: boolean;
    setGazeLine: (on: boolean) => void;
    statusBarMode: InstrumentMode;
    setStatusBarMode: (mode: InstrumentMode) => void;
    panelMode: InstrumentMode;
    setPanelMode: (mode: InstrumentMode) => void;
    panelRatio: number;
    setPanelRatio: (ratio: number) => void;
    deliveryFace: DeliveryFace;
    setDeliveryFace: (face: DeliveryFace) => void;
    hangingIndent: boolean;
    readingPage: boolean;
    setReadingPage: (on: boolean) => void;
    /** Foco de lectura (L-3). */
    readingFocus: boolean;
    setReadingFocus: (on: boolean) => void;
    /** Citas plegadas a un renglón (opción; por defecto completas). */
    collapseQuotes: boolean;
    setCollapseQuotes: (on: boolean) => void;
    /** Brillo propio del atril (C7); `null` es el del sistema. */
    brightness: number | null;
    setBrightness: (level: number | null) => void;
    setHangingIndent: (on: boolean) => void;
    targetMinutes: number;
    onPickDuration: (minutes: number) => void;
    /**
     * Hora de término (C7), en ms de reloj de pared, o `null`. Mientras esté
     * puesta, la duración sale de ella y las cifras de minutos no mandan.
     */
    endAt: number | null;
    onToggleEndAt: () => void;
    onShiftEndAt: (deltaMinutes: number) => void;
    onResetClock: () => void;
    /** Reparto vigente, ya resuelto (automático + lo fijado a mano). */
    budgets: MovementBudget[];
    /** Fija o suelta el presupuesto de un movimiento. `null` vuelve al automático. */
    onSetBudget: (slug: string, seconds: number | null) => void;
}

/**
  * Hoja de ajustes del púlpito: modo de luz, cuerpo, corte de línea y duración
  * objetivo. Vive aparte porque la pantalla ya carga timer, navegación por
  * secciones, citas, resaltado y aparato de estudio.
  */
/** Qué dice cada instrumento: todo, sólo la marca, o nada. */
const INSTRUMENT_MODES = [
    { value: 'full' as const, key: 'preach:instrument_full' },
    { value: 'minimal' as const, key: 'preach:instrument_minimal' },
    { value: 'off' as const, key: 'preach:instrument_off' },
];

/** Brillos del atril: el del sistema o uno fijo. */
const BRIGHTNESS_LEVELS = [null, 0.3, 0.55, 0.8, 1] as const;

/** Tres alturas de tablero. La chica alcanza para el reloj y el riel. */
const PANEL_SIZES = [
    { ratio: 0.17, key: 'preach:panel_small' },
    { ratio: 0.25, key: 'preach:panel_medium' },
    { ratio: 0.33, key: 'preach:panel_large' },
] as const;

export function PreachSettingsSheet({
    visible,
    onClose,
    tokens,
    readingMode,
    setReadingMode,
    fontSize,
    setFontSize,
    senseLines,
    setSenseLines,
    gazeLine,
    setGazeLine,
    statusBarMode,
    setStatusBarMode,
    panelMode,
    setPanelMode,
    panelRatio,
    setPanelRatio,
    deliveryFace,
    setDeliveryFace,
    hangingIndent,
    readingPage,
    setReadingPage,
    readingFocus,
    setReadingFocus,
    collapseQuotes,
    setCollapseQuotes,
    brightness,
    setBrightness,
    setHangingIndent,
    targetMinutes,
    onPickDuration,
    endAt,
    onToggleEndAt,
    onShiftEndAt,
    onResetClock,
    budgets,
    onSetBudget,
}: Props) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    return (
        <Modal visible={visible} transparent animationType={tokens.animations ? 'fade' : 'none'} onRequestClose={onClose}>
            {/* Cajón lateral derecho, no hoja inferior. En una tablet el ancho
                sobra y el alto no: una hoja desde abajo tapaba justo el tablero
                y dejaba media pantalla vacía a los costados. */}
            <Pressable className="flex-1 flex-row bg-black/40" onPress={onClose}>
                <View className="flex-1" />
                <Pressable
                    className="px-6 pt-6"
                    onPress={() => undefined}
                    style={{
                        backgroundColor: tokens.surface,
                        width: 420,
                        maxWidth: '85%',
                        height: '100%',
                        paddingBottom: insets.bottom + 20,
                        borderLeftWidth: 1,
                        borderLeftColor: tokens.border,
                    }}
                >
                    <ScrollView showsVerticalScrollIndicator={false}>
                    <Text
                        style={{ color: tokens.textSecondary }}
                        className="font-lexend-semibold text-xs uppercase tracking-widest mb-2"
                    >
                        {t('preach:light_mode')}
                    </Text>
                    <View className="flex-row flex-wrap mb-5">
                        {MODES.map((m) => (
                            <TouchableOpacity
                                key={m}
                                onPress={() => setReadingMode(m)}
                                className="px-4 py-2 rounded-full mr-2 mb-2"
                                style={{
                                    backgroundColor: m === readingMode ? tokens.accent : 'transparent',
                                    borderWidth: 1,
                                    borderColor: m === readingMode ? tokens.accent : tokens.border,
                                }}
                            >
                                <Text
                                    style={{ color: m === readingMode ? tokens.background : tokens.textPrimary }}
                                    className="font-lexend text-sm"
                                >
                                    {t(READING_MODE_LABEL_KEYS[m])}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text
                        style={{ color: tokens.textSecondary }}
                        className="font-lexend-semibold text-xs uppercase tracking-widest mb-2"
                    >
                        {t('preach:typeface')}
                    </Text>
                    <View className="flex-row flex-wrap mb-5">
                        {DELIVERY_FACES.map((face) => (
                            <TouchableOpacity
                                key={face}
                                onPress={() => setDeliveryFace(face)}
                                accessibilityRole="button"
                                accessibilityLabel={t(`preach:face_${face}`)}
                                className="px-4 py-2 rounded-full mr-2 mb-2"
                                style={{
                                    backgroundColor: face === deliveryFace ? tokens.accent : 'transparent',
                                    borderWidth: 1,
                                    borderColor: face === deliveryFace ? tokens.accent : tokens.border,
                                }}
                            >
                                <Text
                                    style={{ color: face === deliveryFace ? tokens.background : tokens.textPrimary }}
                                    className="font-lexend text-sm"
                                >
                                    {t(`preach:face_${face}`)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text
                        style={{ color: tokens.textSecondary }}
                        className="font-lexend-semibold text-xs uppercase tracking-widest mb-2"
                    >
                        {t('preach:text_size')}
                    </Text>
                    <View className="flex-row items-center mb-5">
                        <TouchableOpacity
                            onPress={() => setFontSize(Math.max(DELIVERY_SIZE.min, fontSize - 2))}
                            accessibilityRole="button"
                            accessibilityLabel={t('preach:font_smaller')}
                            className="px-4 py-2 rounded-lg"
                            style={{ borderWidth: 1, borderColor: tokens.border }}
                        >
                            <MaterialIcons name="remove" size={20} color={tokens.textPrimary} />
                        </TouchableOpacity>
                        <Text style={{ color: tokens.textPrimary }} className="font-lexend mx-4">
                            {fontSize}
                        </Text>
                        <TouchableOpacity
                            onPress={() => setFontSize(Math.min(DELIVERY_SIZE.max, fontSize + 2))}
                            accessibilityRole="button"
                            accessibilityLabel={t('preach:font_bigger')}
                            className="px-4 py-2 rounded-lg"
                            style={{ borderWidth: 1, borderColor: tokens.border }}
                        >
                            <MaterialIcons name="add" size={20} color={tokens.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <Text
                        style={{ color: tokens.textSecondary }}
                        className="font-lexend-semibold text-xs uppercase tracking-widest mb-2"
                    >
                        {t('preach:gaze_guide')}
                    </Text>
                    {/* Tres estados EXCLUYENTES: la colometría y la línea al
                                                66 % resuelven lo mismo —dónde levantar la vista— y se
                                                estorban. No son dos niveles de una escala. */}
                    <View className="flex-row flex-wrap mb-5">
                        {GAZE_GUIDES.map((guide) => {
                            const active =
                                guide === 'sense'
                                    ? senseLines
                                    : guide === 'line'
                                        ? gazeLine
                                        : !senseLines && !gazeLine;
                            const label = t(`preach:guide_${guide}`);
                            return (
                                <TouchableOpacity
                                    key={guide}
                                    onPress={() => {
                                        if (guide === 'sense') setSenseLines(true);
                                        else if (guide === 'line') setGazeLine(true);
                                        else {
                                            setSenseLines(false);
                                            setGazeLine(false);
                                        }
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={label}
                                    className="px-4 py-2 rounded-full mr-2 mb-2"
                                    style={{
                                        backgroundColor: active ? tokens.accent : 'transparent',
                                        borderWidth: 1,
                                        borderColor: active ? tokens.accent : tokens.border,
                                    }}
                                >
                                    <Text
                                        style={{ color: active ? tokens.background : tokens.textPrimary }}
                                        className="font-lexend text-sm"
                                    >
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text
                        style={{ color: tokens.textSecondary }}
                        className="font-lexend-semibold text-xs uppercase tracking-widest mb-2"
                    >
                        {t('preach:hanging_indent')}
                    </Text>
                    <View className="flex-row flex-wrap mb-5">
                        {[true, false].map((on) => (
                            <TouchableOpacity
                                key={String(on)}
                                onPress={() => setHangingIndent(on)}
                                accessibilityRole="button"
                                accessibilityLabel={t(on ? 'preach:indent_on' : 'preach:indent_off')}
                                className="px-4 py-2 rounded-full mr-2 mb-2"
                                style={{
                                    backgroundColor: on === hangingIndent ? tokens.accent : 'transparent',
                                    borderWidth: 1,
                                    borderColor: on === hangingIndent ? tokens.accent : tokens.border,
                                }}
                            >
                                <Text
                                    style={{ color: on === hangingIndent ? tokens.background : tokens.textPrimary }}
                                    className="font-lexend text-sm"
                                >
                                    {t(on ? 'preach:indent_on' : 'preach:indent_off')}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Brillo del atril (C7): el púlpito tiene su luz. */}
                    <Text
                        style={{ color: tokens.textSecondary }}
                        className="font-lexend-semibold text-xs uppercase tracking-widest mb-2"
                    >
                        {t('preach:brightness')}
                    </Text>
                    <View className="flex-row flex-wrap mb-5">
                        {BRIGHTNESS_LEVELS.map((level) => {
                            const selected = level === brightness;
                            return (
                                <TouchableOpacity
                                    key={String(level)}
                                    onPress={() => setBrightness(level)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected }}
                                    className="px-4 py-2 rounded-full mr-2 mb-2"
                                    style={{
                                        backgroundColor: selected ? tokens.accent : 'transparent',
                                        borderWidth: 1,
                                        borderColor: selected ? tokens.accent : tokens.border,
                                    }}
                                >
                                    <Text
                                        style={{ color: selected ? tokens.background : tokens.textPrimary }}
                                        className="font-lexend text-sm"
                                    >
                                        {level === null ? t('preach:brightness_system') : `${Math.round(level * 100)} %`}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Página de Lectura (C7): el pasaje antes del sermón. */}
                    <Text
                        style={{ color: tokens.textSecondary }}
                        className="font-lexend-semibold text-xs uppercase tracking-widest mb-1"
                    >
                        {t('preach:reading_page')}
                    </Text>
                    <Text style={{ color: tokens.textSecondary }} className="font-lexend text-xs mb-2">
                        {t('preach:reading_page_hint')}
                    </Text>
                    <View className="flex-row flex-wrap mb-5">
                        {[true, false].map((on) => (
                            <TouchableOpacity
                                key={String(on)}
                                onPress={() => setReadingPage(on)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: on === readingPage }}
                                className="px-4 py-2 rounded-full mr-2 mb-2"
                                style={{
                                    backgroundColor: on === readingPage ? tokens.accent : 'transparent',
                                    borderWidth: 1,
                                    borderColor: on === readingPage ? tokens.accent : tokens.border,
                                }}
                            >
                                <Text
                                    style={{ color: on === readingPage ? tokens.background : tokens.textPrimary }}
                                    className="font-lexend text-sm"
                                >
                                    {t(on ? 'common:on' : 'common:off')}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Foco de lectura (L-3): volver del público al lugar exacto. */}
                    <OnOffSetting
                        tokens={tokens}
                        title={t('preach:reading_focus')}
                        hint={t('preach:reading_focus_hint')}
                        value={readingFocus}
                        onChange={setReadingFocus}
                    />

                    <OnOffSetting
                        tokens={tokens}
                        title={t('preach:collapse_quotes')}
                        hint={t('preach:collapse_quotes_hint')}
                        value={collapseQuotes}
                        onChange={setCollapseQuotes}
                    />

                    {/* DOS INSTRUMENTOS, DOS CONTROLES. La franja de arriba y
                        el tablero de abajo no son dos vistas de lo mismo: quien
                        quiere el riel de movimientos abajo puede no querer el
                        reloj arriba, y al revés. Y "sin números" no es apagar:
                        deja la marca, que es posición sin cifra que leer. */}
                    <Text
                        style={{ color: tokens.textSecondary }}
                        className="font-lexend-semibold text-xs uppercase tracking-widest mb-2"
                    >
                        {t('preach:status_bar')}
                    </Text>
                    <View className="flex-row flex-wrap mb-5">
                        {INSTRUMENT_MODES.map((mode) => (
                            <TouchableOpacity
                                key={`top-${mode.value}`}
                                onPress={() => setStatusBarMode(mode.value)}
                                accessibilityRole="button"
                                accessibilityLabel={t(mode.key)}
                                className="px-4 py-2 rounded-full mr-2 mb-2"
                                style={{
                                    backgroundColor:
                                        mode.value === statusBarMode ? tokens.accent : 'transparent',
                                    borderWidth: 1,
                                    borderColor:
                                        mode.value === statusBarMode ? tokens.accent : tokens.border,
                                }}
                            >
                                <Text
                                    style={{
                                        color:
                                            mode.value === statusBarMode
                                                ? tokens.background
                                                : tokens.textPrimary,
                                    }}
                                    className="font-lexend text-sm"
                                >
                                    {t(mode.key)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text
                        style={{ color: tokens.textSecondary }}
                        className="font-lexend-semibold text-xs uppercase tracking-widest mb-2"
                    >
                        {t('preach:instrument_panel')}
                    </Text>
                    <View className="flex-row flex-wrap mb-5">
                        {INSTRUMENT_MODES.map((mode) => (
                            <TouchableOpacity
                                key={`bottom-${mode.value}`}
                                onPress={() => setPanelMode(mode.value)}
                                accessibilityRole="button"
                                accessibilityLabel={t(mode.key)}
                                className="px-4 py-2 rounded-full mr-2 mb-2"
                                style={{
                                    backgroundColor:
                                        mode.value === panelMode ? tokens.accent : 'transparent',
                                    borderWidth: 1,
                                    borderColor:
                                        mode.value === panelMode ? tokens.accent : tokens.border,
                                }}
                            >
                                <Text
                                    style={{
                                        color:
                                            mode.value === panelMode
                                                ? tokens.background
                                                : tokens.textPrimary,
                                    }}
                                    className="font-lexend text-sm"
                                >
                                    {t(mode.key)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Cuánto se lleva el tablero. Era un tercio fijo, y un
                        tercio es más de lo que el reloj y el riel necesitan:
                        lo que sobraba se lo comía al texto. */}
                    {panelMode === 'full' ? (
                        <View className="flex-row flex-wrap mb-5">
                            {PANEL_SIZES.map((size) => (
                                <TouchableOpacity
                                    key={size.ratio}
                                    onPress={() => setPanelRatio(size.ratio)}
                                    accessibilityRole="button"
                                    accessibilityLabel={t(size.key)}
                                    className="px-4 py-2 rounded-full mr-2 mb-2"
                                    style={{
                                        backgroundColor:
                                            size.ratio === panelRatio ? tokens.accent : 'transparent',
                                        borderWidth: 1,
                                        borderColor:
                                            size.ratio === panelRatio ? tokens.accent : tokens.border,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color:
                                                size.ratio === panelRatio
                                                    ? tokens.background
                                                    : tokens.textPrimary,
                                        }}
                                        className="font-lexend text-sm"
                                    >
                                        {t(size.key)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null}

                    <Text
                        style={{ color: tokens.textSecondary }}
                        className="font-lexend-semibold text-xs uppercase tracking-widest mb-2"
                    >
                        {t('preach:target_duration')}
                    </Text>
                    <View className="flex-row flex-wrap" style={{ opacity: endAt !== null ? 0.4 : 1 }}>
                        {targetMinuteOptions(targetMinutes).map((min) => (
                            <TouchableOpacity
                                key={min}
                                onPress={() => onPickDuration(min)}
                                disabled={endAt !== null}
                                className="px-4 py-2 rounded-full mr-2 mb-2"
                                style={{
                                    backgroundColor: min === targetMinutes ? tokens.accent : 'transparent',
                                    borderWidth: 1,
                                    borderColor: min === targetMinutes ? tokens.accent : tokens.border,
                                }}
                            >
                                <Text
                                    style={{ color: min === targetMinutes ? tokens.background : tokens.textPrimary }}
                                    className="font-lexend text-sm"
                                >
                                    {min}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Hora de término (C7): el culto no empieza a horario y el
                        pastor no decide cuándo sube; «termino a las 11:45» es
                        lo que de verdad sabe. */}
                    <Text
                        style={{ color: tokens.textSecondary }}
                        className="font-lexend-semibold text-xs uppercase tracking-widest mt-3 mb-2"
                    >
                        {t('preach:end_time')}
                    </Text>
                    {endAt === null ? (
                        <TouchableOpacity
                            onPress={onToggleEndAt}
                            accessibilityRole="button"
                            className="flex-row items-center self-start px-4 py-2 rounded-full mb-2"
                            style={{ borderWidth: 1, borderColor: tokens.border }}
                        >
                            <MaterialIcons name="schedule" size={18} color={tokens.textPrimary} />
                            <Text style={{ color: tokens.textPrimary }} className="font-lexend text-sm ml-1.5">
                                {t('preach:end_time_on')}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            <View className="flex-row items-center mb-1">
                                <TouchableOpacity
                                    onPress={() => onShiftEndAt(-5)}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('preach:end_time_earlier')}
                                    hitSlop={8}
                                    className="w-10 h-10 rounded-full items-center justify-center"
                                    style={{ borderWidth: 1, borderColor: tokens.border }}
                                >
                                    <MaterialIcons name="remove" size={20} color={tokens.textPrimary} />
                                </TouchableOpacity>
                                <Text
                                    style={{ color: tokens.textPrimary, fontVariant: ['tabular-nums'] }}
                                    className="font-lexend-semibold text-2xl mx-4"
                                    accessibilityLiveRegion="polite"
                                >
                                    {formatWallTime(endAt)}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => onShiftEndAt(5)}
                                    accessibilityRole="button"
                                    accessibilityLabel={t('preach:end_time_later')}
                                    hitSlop={8}
                                    className="w-10 h-10 rounded-full items-center justify-center"
                                    style={{ borderWidth: 1, borderColor: tokens.border }}
                                >
                                    <MaterialIcons name="add" size={20} color={tokens.textPrimary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={onToggleEndAt} accessibilityRole="button" className="ml-4">
                                    <Text style={{ color: tokens.textSecondary }} className="font-lexend text-sm">
                                        {t('preach:end_time_off')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={{ color: tokens.textSecondary }} className="font-lexend text-xs mb-2">
                                {t('preach:end_time_hint')}
                            </Text>
                        </>
                    )}

                    <TouchableOpacity
                        onPress={() =>
                            Alert.alert(t('preach:reset_clock'), t('preach:reset_clock_confirm'), [
                                { text: t('common:cancel'), style: 'cancel' },
                                { text: t('preach:reset_clock'), style: 'destructive', onPress: onResetClock },
                            ])
                        }
                        accessibilityRole="button"
                        className="flex-row items-center self-start mt-1"
                    >
                        <MaterialIcons name="restart-alt" size={18} color={tokens.textSecondary} />
                        <Text style={{ color: tokens.textSecondary }} className="font-lexend text-sm ml-1.5">
                            {t('preach:reset_clock')}
                        </Text>
                    </TouchableOpacity>

                    {budgets.length > 1 ? (
                        <>
                            <Text
                                style={{ color: tokens.textSecondary }}
                                className="font-lexend-semibold text-xs uppercase tracking-widest mt-5 mb-1"
                            >
                                {t('preach:movement_budget')}
                            </Text>
                            <Text style={{ color: tokens.textSecondary }} className="font-lexend text-xs mb-2">
                                {t('preach:movement_budget_hint')}
                            </Text>
                            <ScrollView style={{ maxHeight: 220 }}>
                                {budgets.map((budget) => (
                                    <View key={budget.slug} className="flex-row items-center py-2">
                                        <Text
                                            numberOfLines={1}
                                            style={{ color: tokens.textPrimary, flex: 1 }}
                                            className="font-lexend text-sm"
                                        >
                                            {budget.title}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => onSetBudget(budget.slug, Math.max(30, budget.seconds - 60))}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('preach:budget_less')}
                                            className="px-3 py-1 rounded-lg"
                                            style={{ borderWidth: 1, borderColor: tokens.border }}
                                        >
                                            <MaterialIcons name="remove" size={16} color={tokens.textPrimary} />
                                        </TouchableOpacity>
                                        <Text
                                            style={{
                                                color: budget.pinned ? tokens.accent : tokens.textSecondary,
                                                width: 60,
                                                textAlign: 'center',
                                                fontVariant: ['tabular-nums'],
                                            }}
                                            className="font-lexend text-sm"
                                        >
                                            {t('preach:minutes_short', { count: Math.round(budget.seconds / 60) })}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => onSetBudget(budget.slug, budget.seconds + 60)}
                                            accessibilityRole="button"
                                            accessibilityLabel={t('preach:budget_more')}
                                            className="px-3 py-1 rounded-lg"
                                            style={{ borderWidth: 1, borderColor: tokens.border }}
                                        >
                                            <MaterialIcons name="add" size={16} color={tokens.textPrimary} />
                                        </TouchableOpacity>
                                        {budget.pinned ? (
                                            <TouchableOpacity
                                                onPress={() => onSetBudget(budget.slug, null)}
                                                accessibilityRole="button"
                                                accessibilityLabel={t('preach:budget_auto')}
                                                className="ml-2"
                                            >
                                                <MaterialIcons name="undo" size={18} color={tokens.textSecondary} />
                                            </TouchableOpacity>
                                        ) : (
                                            <View style={{ width: 26 }} />
                                        )}
                                    </View>
                                ))}
                            </ScrollView>
                        </>
                    ) : null}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

/** Un ajuste de sí o no, con su explicación: el mismo formato en toda la hoja. */
function OnOffSetting({
    tokens,
    title,
    hint,
    value,
    onChange,
}: {
    tokens: ReadingModeTokens;
    title: string;
    hint: string;
    value: boolean;
    onChange: (on: boolean) => void;
}) {
    const { t } = useTranslation();
    return (
        <>
            <Text style={{ color: tokens.textSecondary }} className="font-lexend-semibold text-xs uppercase tracking-widest mb-1">
                {title}
            </Text>
            <Text style={{ color: tokens.textSecondary }} className="font-lexend text-xs mb-2">
                {hint}
            </Text>
            <View className="flex-row flex-wrap mb-5">
                {[true, false].map((on) => (
                    <TouchableOpacity
                        key={String(on)}
                        onPress={() => onChange(on)}
                        accessibilityRole="button"
                        accessibilityLabel={`${title}: ${t(on ? 'common:on' : 'common:off')}`}
                        accessibilityState={{ selected: on === value }}
                        className="px-4 py-2 rounded-full mr-2 mb-2"
                        style={{
                            backgroundColor: on === value ? tokens.accent : 'transparent',
                            borderWidth: 1,
                            borderColor: on === value ? tokens.accent : tokens.border,
                        }}
                    >
                        <Text style={{ color: on === value ? tokens.background : tokens.textPrimary }} className="font-lexend text-sm">
                            {t(on ? 'common:on' : 'common:off')}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </>
    );
}

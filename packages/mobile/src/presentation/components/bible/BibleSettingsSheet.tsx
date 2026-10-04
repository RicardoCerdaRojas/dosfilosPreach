import React from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { READING_MODES, READING_MODE_LABEL_KEYS } from '@/core/theme/readingModes';
import type { ReadingMode, ReadingModeTokens } from '@/core/theme/readingModes';
import { DELIVERY_FACES, FACE_CLASS } from '@/core/theme/typography';
import type { DeliveryFace } from '@/core/theme/typography';
import { useReaderSettingsStore } from '@/presentation/state/readerSettings.store';

interface Props {
    visible: boolean;
    tokens: ReadingModeTokens;
    onClose: () => void;
}

/** Cuerpo del lector: sentado y en silencio admite menos que el atril. */
const SIZE = { min: 14, max: 34 };
/** Interlínea, de apretada a aireada. La del medio es la del atril. */
const SPACINGS = [0.85, 1, 1.2, 1.4];

/**
 * Los ajustes del lector de Biblia.
 *
 * Estaban repartidos: el cuerpo y el modo de luz sólo se tocaban desde el
 * perfil o desde el atril, y la Biblia —que es donde más horas pasa el
 * pastor— no tenía ninguno a mano. Acá van los que toda app de lectura tiene
 * y algunos que casi ninguna: la interlínea, los números de versículo y que la
 * pantalla no se apague.
 *
 * SON AJUSTES PROPIOS, NO LOS DEL PÚLPITO. Cuerpo y familia se guardan aparte:
 * predicar de pie a 70 cm y estudiar sentado no piden lo mismo, y compartir un
 * solo valor hacía que tocar uno cambiara el otro por la espalda.
 */
export function BibleSettingsSheet({ visible, tokens, onClose }: Props) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const fontSize = useReaderSettingsStore((s) => s.fontSize);
    const setFontSize = useReaderSettingsStore((s) => s.setFontSize);
    const lineSpacing = useReaderSettingsStore((s) => s.lineSpacing);
    const setLineSpacing = useReaderSettingsStore((s) => s.setLineSpacing);
    const bibleFace = useReaderSettingsStore((s) => s.bibleFace);
    const setBibleFace = useReaderSettingsStore((s) => s.setBibleFace);
    const verseNumbers = useReaderSettingsStore((s) => s.verseNumbers);
    const setVerseNumbers = useReaderSettingsStore((s) => s.setVerseNumbers);
    const keepAwake = useReaderSettingsStore((s) => s.keepAwake);
    const setKeepAwake = useReaderSettingsStore((s) => s.setKeepAwake);
    const readingMode = useReaderSettingsStore((s) => s.readingMode);
    const setReadingMode = useReaderSettingsStore((s) => s.setReadingMode);
    const fullWidth = useReaderSettingsStore((s) => s.fullWidth);
    const setFullWidth = useReaderSettingsStore((s) => s.setFullWidth);

    const label = (text: string) => (
        <Text
            style={{ color: tokens.textSecondary, fontSize: 11, letterSpacing: 1.2, marginTop: 26 }}
            className="font-lexend-semibold uppercase"
        >
            {text}
        </Text>
    );

    const cell = (
        key: string,
        active: boolean,
        onPress: () => void,
        content: React.ReactNode,
        width?: number,
    ) => (
        <TouchableOpacity
            key={key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className="items-center justify-center rounded-xl mr-2"
            style={{
                width: width ?? 62,
                height: 50,
                backgroundColor: active ? tokens.accent : tokens.background,
                borderWidth: 1,
                borderColor: active ? tokens.accent : tokens.border,
            }}
        >
            {content}
        </TouchableOpacity>
    );

    const toggleRow = (
        key: string,
        text: string,
        hint: string,
        value: boolean,
        onToggle: () => void,
    ) => (
        <TouchableOpacity
            key={key}
            onPress={onToggle}
            accessibilityRole="switch"
            accessibilityState={{ checked: value }}
            className="flex-row items-center py-3.5"
        >
            <View className="flex-1 pr-4">
                <Text
                    style={{ color: tokens.textPrimary, fontSize: 15 }}
                    className="font-lexend-semibold"
                >
                    {text}
                </Text>
                <Text
                    style={{ color: tokens.textSecondary, fontSize: 12, lineHeight: 17 }}
                    className="font-lexend mt-0.5"
                >
                    {hint}
                </Text>
            </View>
            <View
                className="items-center justify-center rounded-full"
                style={{
                    width: 30,
                    height: 30,
                    backgroundColor: value ? tokens.accent : 'transparent',
                    borderWidth: 1,
                    borderColor: value ? tokens.accent : tokens.border,
                }}
            >
                {value ? (
                    <MaterialIcons name="check" size={17} color={tokens.background} />
                ) : null}
            </View>
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} transparent animationType={tokens.animations ? 'fade' : 'none'} onRequestClose={onClose}>
            {/* Cajón derecho, como los ajustes del atril: el texto queda a la
                vista mientras se ajusta, que es la única forma de saber si el
                ajuste sirve. */}
            <Pressable
                style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)' }}
                onPress={onClose}
            >
                <View style={{ flex: 1 }} />
                <Pressable
                    onPress={() => undefined}
                    style={{
                        width: '42%',
                        minWidth: 340,
                        backgroundColor: tokens.surface,
                        borderLeftWidth: 1,
                        borderLeftColor: tokens.border,
                        paddingTop: insets.top + 16,
                        paddingHorizontal: 22,
                    }}
                >
                    <View className="flex-row items-center justify-between">
                        <Text
                            style={{ color: tokens.textPrimary, fontSize: 18 }}
                            className="font-lexend-bold"
                        >
                            {t('bible:reader_settings')}
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel={t('common:close')}
                        >
                            <MaterialIcons name="close" size={22} color={tokens.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                    >
                        {label(t('bible:font_size'))}
                        <View className="flex-row items-center mt-3">
                            <TouchableOpacity
                                onPress={() => setFontSize(Math.max(SIZE.min, fontSize - 1))}
                                accessibilityRole="button"
                                accessibilityLabel={t('preach:font_smaller')}
                                className="items-center justify-center rounded-full"
                                style={{ width: 44, height: 44, backgroundColor: tokens.background }}
                            >
                                <MaterialIcons name="remove" size={20} color={tokens.textPrimary} />
                            </TouchableOpacity>
                            <Text
                                style={{ color: tokens.textPrimary, fontSize: 16, width: 64 }}
                                className="font-lexend-semibold text-center"
                            >
                                {fontSize}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setFontSize(Math.min(SIZE.max, fontSize + 1))}
                                accessibilityRole="button"
                                accessibilityLabel={t('preach:font_bigger')}
                                className="items-center justify-center rounded-full"
                                style={{ width: 44, height: 44, backgroundColor: tokens.background }}
                            >
                                <MaterialIcons name="add" size={20} color={tokens.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        {label(t('bible:line_spacing'))}
                        <View className="flex-row mt-3">
                            {SPACINGS.map((value) =>
                                cell(
                                    `sp-${value}`,
                                    lineSpacing === value,
                                    () => setLineSpacing(value),
                                    <MaterialIcons
                                        name="format-line-spacing"
                                        size={20}
                                        color={
                                            lineSpacing === value
                                                ? tokens.background
                                                : tokens.textSecondary
                                        }
                                        style={{ transform: [{ scaleY: 0.7 + value * 0.3 }] }}
                                    />,
                                ),
                            )}
                        </View>

                        {label(t('bible:typeface'))}
                        <View className="flex-row mt-3">
                            {DELIVERY_FACES.map((face: DeliveryFace) =>
                                cell(
                                    face,
                                    bibleFace === face,
                                    () => setBibleFace(face),
                                    <Text
                                        style={{
                                            color:
                                                bibleFace === face
                                                    ? tokens.background
                                                    : tokens.textPrimary,
                                            fontSize: 17,
                                        }}
                                        className={FACE_CLASS[face].semibold}
                                    >
                                        Aa
                                    </Text>,
                                ),
                            )}
                        </View>

                        {label(t('preach:reading_mode'))}
                        <View className="flex-row mt-3">
                            {(Object.keys(READING_MODE_LABEL_KEYS) as ReadingMode[]).map((mode) =>
                                cell(
                                    mode,
                                    readingMode === mode,
                                    () => setReadingMode(mode),
                                    <View
                                        style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: 11,
                                            backgroundColor: READING_MODES[mode].background,
                                            borderWidth: 1,
                                            borderColor: tokens.border,
                                        }}
                                    />,
                                    52,
                                ),
                            )}
                        </View>

                        {label(t('bible:page'))}
                        <View style={{ marginTop: 4 }}>
                            {toggleRow(
                                'numbers',
                                t('bible:verse_numbers'),
                                t('bible:verse_numbers_hint'),
                                verseNumbers,
                                () => setVerseNumbers(!verseNumbers),
                            )}
                            {toggleRow(
                                'width',
                                t('bible:full_width'),
                                t('bible:full_width_hint'),
                                fullWidth,
                                () => setFullWidth(!fullWidth),
                            )}
                            {toggleRow(
                                'awake',
                                t('bible:keep_awake'),
                                t('bible:keep_awake_hint'),
                                keepAwake,
                                () => setKeepAwake(!keepAwake),
                            )}
                        </View>
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

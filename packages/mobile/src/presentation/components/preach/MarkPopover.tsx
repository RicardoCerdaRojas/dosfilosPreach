import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { HIGHLIGHT_COLORS, PREACHER_GLYPHS } from '@dosfilos/domain';
import type { HighlightColor, MarkStyle, PreacherGlyph } from '@dosfilos/domain';

import { ReadingModeTokens } from '@/core/theme/readingModes';
import { GLYPH_SYMBOL } from '@/core/theme/preacherGlyphs';

interface Props {
    visible: boolean;
    tokens: ReadingModeTokens;
    /** Y en pantalla donde terminó la selección, para no taparla. */
    anchorY: number;
    screenHeight: number;
    /** Marca existente bajo la selección, si la hay. */
    currentColor: HighlightColor | null;
    currentStyle: MarkStyle | null;
    onPick: (color: HighlightColor, style: MarkStyle) => void;
    onRemove: () => void;
    onClose: () => void;
    /**
     * Acción propia del contexto, a la derecha de las marcas.
     *
     * En la Biblia es "al sermón": lo que se hace con un pasaje elegido, más
     * que marcarlo, es llevárselo. En el púlpito no existe.
     */
    extraAction?: { icon: keyof typeof MaterialIcons.glyphMap; label: string; onPress: () => void };
    /**
     * Marcas de predicador (C7): una segunda fila con los glifos. Sólo en el
     * púlpito; la Biblia no la tiene.
     */
    glyphs?: { current: PreacherGlyph | null; onPick: (glyph: PreacherGlyph) => void };
}

const STYLE_ICONS: Record<MarkStyle, keyof typeof MaterialIcons.glyphMap> = {
    highlight: 'border-color',
    underline: 'format-underlined',
    strike: 'format-strikethrough',
};

/**
 * Popover CONTEXTUAL de marcas, junto al texto seleccionado.
 *
 * Reemplaza al panel que subía desde abajo. La diferencia no es estética: un
 * panel inferior tapa justo el tercio donde vive el tablero y obliga a mirar
 * a otro lado del que se está marcando. El popover aparece al lado de lo que
 * seleccionaste, que es donde ya tenés puesta la vista.
 *
 * Se coloca arriba o abajo de la selección según dónde haya lugar — nunca
 * encima del texto que el pastor acaba de elegir.
 */
export function MarkPopover({
    visible,
    tokens,
    anchorY,
    screenHeight,
    currentColor,
    currentStyle,
    onPick,
    onRemove,
    onClose,
    extraAction,
    glyphs,
}: Props) {
    const { t } = useTranslation();
    const below = anchorY < screenHeight * 0.6;
    const style: MarkStyle = currentStyle ?? 'highlight';

    return (
        <Modal visible={visible} transparent animationType={tokens.animations ? 'fade' : 'none'} onRequestClose={onClose}>
            <Pressable className="flex-1" onPress={onClose}>
                <View
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        [below ? 'top' : 'bottom']: below
                            ? anchorY + 56
                            : screenHeight - anchorY + 56,
                        alignItems: 'center',
                    }}
                >
                    <View
                        className="flex-row items-center rounded-2xl px-3 py-2"
                        style={{
                            backgroundColor: tokens.surface,
                            borderWidth: 1,
                            borderColor: tokens.border,
                            shadowColor: '#000',
                            shadowOpacity: 0.25,
                            shadowRadius: 12,
                            shadowOffset: { width: 0, height: 4 },
                        }}
                    >
                        {HIGHLIGHT_COLORS.map((color) => (
                            <Pressable
                                key={color}
                                onPress={() => onPick(color, style)}
                                accessibilityRole="button"
                                accessibilityLabel={t(`preach:color_${color}`)}
                                className="items-center justify-center mr-2"
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: tokens.highlightColors[color],
                                    borderWidth: color === currentColor ? 3 : 1,
                                    borderColor:
                                        color === currentColor ? tokens.accent : tokens.border,
                                }}
                            >
                                {tokens.highlightUnderline ? (
                                    <Text
                                        style={{ color: tokens.textPrimary }}
                                        className="font-lexend-semibold text-sm"
                                    >
                                        {t(`preach:color_${color}`).charAt(0).toUpperCase()}
                                    </Text>
                                ) : null}
                            </Pressable>
                        ))}

                        <View
                            style={{ width: 1, height: 28, backgroundColor: tokens.border }}
                            className="mx-1"
                        />

                        {(Object.keys(STYLE_ICONS) as MarkStyle[]).map((option) => (
                            <Pressable
                                key={option}
                                onPress={() => onPick(currentColor ?? 'yellow', option)}
                                accessibilityRole="button"
                                accessibilityLabel={t(`preach:style_${option}`)}
                                className="items-center justify-center ml-1"
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    backgroundColor:
                                        option === currentStyle ? tokens.accent : 'transparent',
                                }}
                            >
                                <MaterialIcons
                                    name={STYLE_ICONS[option]}
                                    size={20}
                                    color={
                                        option === currentStyle
                                            ? tokens.background
                                            : tokens.textPrimary
                                    }
                                />
                            </Pressable>
                        ))}

                        {currentColor ? (
                            <Pressable
                                onPress={onRemove}
                                accessibilityRole="button"
                                accessibilityLabel={t('preach:remove_highlight')}
                                className="items-center justify-center ml-2"
                                style={{ width: 40, height: 40 }}
                            >
                                <MaterialIcons
                                    name="format-clear"
                                    size={20}
                                    color={tokens.textSecondary}
                                />
                            </Pressable>
                        ) : null}

                        {extraAction ? (
                            <Pressable
                                onPress={extraAction.onPress}
                                accessibilityRole="button"
                                accessibilityLabel={extraAction.label}
                                className="flex-row items-center ml-2 px-3 rounded-full"
                                style={{ height: 40, backgroundColor: tokens.accent }}
                            >
                                <MaterialIcons
                                    name={extraAction.icon}
                                    size={17}
                                    color={tokens.background}
                                />
                                <Text
                                    style={{ color: tokens.background, fontSize: 13 }}
                                    className="font-lexend-semibold ml-1.5"
                                >
                                    {extraAction.label}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                    {glyphs ? (
                        <View
                            className="flex-row items-center rounded-2xl px-3 py-2 mt-2"
                            style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border }}
                        >
                            {PREACHER_GLYPHS.map((glyph) => {
                                const on = glyph === glyphs.current;
                                return (
                                    <Pressable
                                        key={glyph}
                                        onPress={() => glyphs.onPick(glyph)}
                                        accessibilityRole="button"
                                        accessibilityLabel={t(`preach:glyph_${glyph}`)}
                                        accessibilityState={{ selected: on }}
                                        className="items-center justify-center mx-1"
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 10,
                                            backgroundColor: on ? tokens.accent : 'transparent',
                                        }}
                                    >
                                        <Text style={{ color: on ? tokens.background : tokens.textPrimary, fontSize: 20 }}>
                                            {GLYPH_SYMBOL[glyph]}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    ) : null}
                </View>
            </Pressable>
        </Modal>
    );
}

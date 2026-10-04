import React from 'react';
import { Alert, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { InkColor, InkTool } from '@dosfilos/domain';

import type { ReadingModeTokens } from '@/core/theme/readingModes';
import type { PenWidth } from '@/presentation/hooks/useInkNotes';

/** Lo que la barra necesita de la tinta, sea del sermón o de la Biblia. */
export interface InkControls {
    tool: InkTool;
    setTool: (tool: InkTool) => void;
    width: PenWidth;
    setWidth: (width: PenWidth) => void;
    penColor: InkColor;
    setPenColor: (color: InkColor) => void;
    eraser: boolean;
    setEraser: (on: boolean) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

interface Props {
    tokens: ReadingModeTokens;
    ink: InkControls;
    /** La tinta se ve (T-8). Ocultarla no la borra. */
    visible: boolean;
    onToggleVisible: () => void;
    /** Qué se puede limpiar acá: «esta página», «todo el sermón», «este capítulo»… */
    clearOptions: { label: string; onPress: () => void }[];
    onDone: () => void;
    /**
     * Sólo Apple Pencil (T-9): el lápiz escribe y el dedo navega. Sólo donde
     * se puede: en el atril. En la Biblia el dedo tendría que desplazar el
     * capítulo por debajo de la capa, y eso queda para después.
     */
    pencilOnly?: { on: boolean; toggle: () => void };
    style?: StyleProp<ViewStyle>;
}

const COLORS: InkColor[] = ['ink', 'blue', 'red'];

/**
 * La barra de la tinta, la misma en el púlpito y en la Biblia (T-5 a T-8).
 *
 * Una herramienta activa a la vez, y se VE cuál: lápiz, resaltador o goma.
 * La goma tenía el ícono de una varita y el fundador la confundía con un
 * lápiz: ahora es una goma. Deshacer y rehacer están siempre a mano, y
 * limpiar pide confirmación pero también se puede deshacer.
 */
export function InkToolbar({ tokens, ink, visible, onToggleVisible, clearOptions, onDone, pencilOnly, style }: Props) {
    const { t } = useTranslation();
    const colorOf = (c: InkColor) => (c === 'red' ? tokens.timerOver : c === 'blue' ? tokens.accent : tokens.textPrimary);

    const toolButton = (
        key: string,
        icon: keyof typeof MaterialCommunityIcons.glyphMap,
        label: string,
        active: boolean,
        onPress: () => void,
        disabled = false,
    ) => (
        <Pressable
            key={key}
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active, disabled }}
            className="items-center justify-center mx-0.5"
            style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: active ? tokens.accent : 'transparent',
                opacity: disabled ? 0.35 : 1,
            }}
        >
            <MaterialCommunityIcons name={icon} size={21} color={active ? tokens.background : tokens.textPrimary} />
        </Pressable>
    );

    const divider = (key: string) => (
        <View key={key} style={{ width: 1, height: 24, backgroundColor: tokens.border }} className="mx-1.5" />
    );

    const pick = (tool: InkTool) => {
        ink.setTool(tool);
        ink.setEraser(false);
    };

    const clear = () =>
        Alert.alert(t('preach:ink_clear'), t('preach:ink_clear_hint'), [
            ...clearOptions.map((o) => ({ text: o.label, style: 'destructive' as const, onPress: o.onPress })),
            { text: t('common:cancel'), style: 'cancel' as const },
        ]);

    return (
        <View
            className="flex-row items-center rounded-full px-2 py-1.5"
            style={[{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border }, style]}
        >
            {toolButton('pen', 'pen', t('preach:pen'), !ink.eraser && ink.tool === 'pen', () => pick('pen'))}
            {toolButton('marker', 'marker', t('preach:ink_highlighter'), !ink.eraser && ink.tool === 'highlighter', () =>
                pick('highlighter'),
            )}
            {toolButton('eraser', 'eraser', t('preach:eraser'), ink.eraser, () => ink.setEraser(!ink.eraser))}

            {!ink.eraser && ink.tool === 'pen' ? (
                <>
                    {divider('d-width')}
                    {toolButton('fine', 'circle-small', t('preach:ink_fine'), ink.width === 'fine', () => ink.setWidth('fine'))}
                    {toolButton('bold', 'circle-medium', t('preach:ink_bold'), ink.width === 'bold', () => ink.setWidth('bold'))}
                </>
            ) : null}

            {!ink.eraser ? (
                <>
                    {divider('d-colors')}
                    {COLORS.map((c) => (
                        <Pressable
                            key={c}
                            onPress={() => ink.setPenColor(c)}
                            accessibilityRole="button"
                            accessibilityLabel={t(`preach:ink_${c}`)}
                            accessibilityState={{ selected: c === ink.penColor }}
                            className="mx-1"
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                backgroundColor: colorOf(c),
                                opacity: ink.tool === 'highlighter' ? 0.55 : 1,
                                borderWidth: c === ink.penColor ? 3 : 0,
                                borderColor: tokens.background,
                            }}
                        />
                    ))}
                </>
            ) : null}

            {divider('d-history')}
            {toolButton('undo', 'undo', t('preach:ink_undo'), false, ink.undo, !ink.canUndo)}
            {toolButton('redo', 'redo', t('preach:ink_redo'), false, ink.redo, !ink.canRedo)}

            {divider('d-page')}
            {pencilOnly
                ? toolButton('pencil-only', 'pencil-lock', t('preach:ink_pencil_only'), pencilOnly.on, pencilOnly.toggle)
                : null}
            {toolButton(
                'visible',
                visible ? 'eye-outline' : 'eye-off-outline',
                t(visible ? 'preach:ink_hide' : 'preach:ink_show'),
                !visible,
                onToggleVisible,
            )}
            {toolButton('clear', 'delete-sweep-outline', t('preach:ink_clear'), false, clear, clearOptions.length === 0)}

            <Pressable onPress={onDone} accessibilityRole="button" accessibilityLabel={t('preach:pen_done')} className="px-3 py-1">
                <Text style={{ color: tokens.accent }} className="font-lexend-semibold text-sm">
                    {t('preach:pen_done')}
                </Text>
            </Pressable>
        </View>
    );
}

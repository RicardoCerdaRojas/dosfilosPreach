import React from 'react';
import { Text, View } from 'react-native';
import type { OutlineItem } from '@dosfilos/domain';

import type { ReadingModeTokens } from '@/core/theme/readingModes';
import { FACE_CLASS, type DeliveryFace } from '@/core/theme/typography';

interface Props {
    items: OutlineItem[];
    tokens: ReadingModeTokens;
    fontSize: number;
    face: DeliveryFace;
    /** Toques sobre el texto: pasan página igual que en el manuscrito. */
    onTapAt: (pageX: number) => void;
}

/**
 * El movimiento en bosquejo (C7): lo que el pastor no puede olvidar, y nada
 * más. Se deriva del manuscrito (`buildOutline`), así que no hay nada que
 * preparar aparte.
 *
 * Jerarquía de un vistazo, que es para lo que existe:
 * - subtítulo: versalitas, color del acento;
 * - punto y frase en negrita: cuerpo pleno, en semibold;
 * - pie (primera oración de un párrafo sin negritas): más chico y atenuado,
 *   porque sólo sirve para reconocer el párrafo;
 * - cita: con filete, como recordatorio de qué se lee.
 */
export function PreachOutline({ items, tokens, fontSize, face, onTapAt }: Props) {
    const lineHeight = fontSize * 1.35;
    const gap = fontSize * 0.55;
    const tap = (e: { nativeEvent: { pageX: number } }) => onTapAt(e.nativeEvent.pageX);

    return (
        <View>
            {items.map((item, i) => {
                const key = `${i}-${item.kind}`;
                if (item.kind === 'heading') {
                    return (
                        <Text
                            key={key}
                            onPress={tap}
                            suppressHighlighting
                            style={{
                                color: tokens.accent,
                                fontSize: fontSize * 0.62,
                                letterSpacing: 1.5,
                                marginTop: i === 0 ? 0 : gap * 1.6,
                                marginBottom: gap * 0.6,
                            }}
                            className="font-lexend-semibold uppercase"
                        >
                            {item.text}
                        </Text>
                    );
                }
                if (item.kind === 'quote') {
                    return (
                        <View
                            key={key}
                            style={{
                                borderLeftWidth: 3,
                                borderLeftColor: tokens.border,
                                paddingLeft: fontSize * 0.5,
                                marginBottom: gap,
                            }}
                        >
                            <Text
                                onPress={tap}
                                suppressHighlighting
                                style={{ color: tokens.textSecondary, fontSize: fontSize * 0.85, lineHeight: fontSize * 1.25 }}
                                className={FACE_CLASS[face].regular}
                            >
                                {item.text}
                            </Text>
                        </View>
                    );
                }
                if (item.kind === 'cue') {
                    return (
                        <Text
                            key={key}
                            onPress={tap}
                            suppressHighlighting
                            style={{
                                color: tokens.textSecondary,
                                fontSize: fontSize * 0.78,
                                lineHeight: fontSize * 1.15,
                                marginBottom: gap,
                            }}
                            className={FACE_CLASS[face].regular}
                        >
                            {item.text}
                        </Text>
                    );
                }
                // Punto o frase en negrita: lo que se dice.
                const marker = item.kind === 'point' ? (item.ordinal ? `${item.ordinal}.` : '•') : null;
                return (
                    <View key={key} className="flex-row" style={{ marginBottom: gap }}>
                        {marker ? (
                            <Text
                                style={{ color: tokens.textSecondary, fontSize, lineHeight, width: fontSize * 1.3 }}
                                className={FACE_CLASS[face].semibold}
                            >
                                {marker}
                            </Text>
                        ) : null}
                        <Text
                            onPress={tap}
                            suppressHighlighting
                            style={{ color: tokens.textPrimary, fontSize, lineHeight, flex: 1 }}
                            className={FACE_CLASS[face].semibold}
                        >
                            {item.text}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

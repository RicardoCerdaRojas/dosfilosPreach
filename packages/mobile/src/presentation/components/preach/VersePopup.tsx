import React from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ReadingModeTokens } from '@/core/theme/readingModes';
import { FACE_FAMILY, type DeliveryFace } from '@/core/theme/typography';
import type { ReadingPassage } from '@/data/repositories/bible/BibleVersionFactory';

interface Props {
    /** La referencia tocada, o `null` si está cerrado. */
    reference: string | null;
    passage: ReadingPassage | null;
    tokens: ReadingModeTokens;
    /** El cuerpo del atril: el versículo se lee casi al mismo tamaño. */
    fontSize: number;
    face: DeliveryFace;
    onOpenInBible: () => void;
    onClose: () => void;
}

/** Interlineado de lectura: el del atril (1,55), no el de un rótulo. */
const LINE = 1.6;

/**
 * El versículo de una referencia tocada en el manuscrito (C7), sin salir de
 * la página.
 *
 * Lo vio el fundador: el texto salía comprimido y con el interlineado muy
 * estrecho. Era un solo bloque, sin números de versículo, a tres cuartos del
 * cuerpo, en una caja angosta, con el interlineado puesto junto a una clase
 * de NativeWind, que es la combinación donde la clase a veces no aplica.
 * Ahora:
 * - un versículo por renglón de lectura, con su número discreto;
 * - el 90 % del cuerpo del atril;
 * - interlineado de lectura;
 * - la familia elegida para predicar, por estilo;
 * - una caja ancha, que se desplaza si el pasaje es largo.
 */
export function VersePopup({ reference, passage, tokens, fontSize, face, onOpenInBible, onClose }: Props) {
    const { t } = useTranslation();
    const { width, height } = useWindowDimensions();
    const size = Math.max(19, Math.round(fontSize * 0.9));
    const family = FACE_FAMILY[face];

    return (
        <Modal visible={reference !== null} transparent animationType={tokens.animations ? 'fade' : 'none'} onRequestClose={onClose}>
            <Pressable
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                onPress={onClose}
            >
                <Pressable
                    onPress={() => undefined}
                    style={{
                        backgroundColor: tokens.surface,
                        borderRadius: 18,
                        width: Math.min(width - 48, 860),
                        maxHeight: height * 0.75,
                        paddingHorizontal: 32,
                        paddingTop: 26,
                        paddingBottom: 20,
                    }}
                >
                    <Text style={{ color: tokens.accent, fontFamily: family.semibold, fontSize: size * 0.8, marginBottom: size * 0.5 }}>
                        {passage?.title ?? reference}
                    </Text>
                    <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator>
                        {passage ? (
                            passage.verses.map((verse) => (
                                <Text
                                    key={verse.number}
                                    style={{
                                        color: tokens.textPrimary,
                                        fontFamily: family.regular,
                                        fontSize: size,
                                        lineHeight: size * LINE,
                                        marginBottom: size * 0.35,
                                    }}
                                >
                                    {verse.number > 0 ? (
                                        <Text style={{ color: tokens.textSecondary, fontFamily: family.semibold, fontSize: size * 0.6 }}>
                                            {`${verse.number}  `}
                                        </Text>
                                    ) : null}
                                    {verse.text}
                                </Text>
                            ))
                        ) : (
                            <Text style={{ color: tokens.textSecondary, fontFamily: family.regular, fontSize: size * 0.8, lineHeight: size * 0.8 * LINE }}>
                                {t('preach:verse_unreadable')}
                            </Text>
                        )}
                    </ScrollView>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                        {/* Cerrar con un botón: VoiceOver no puede «tocar el fondo». */}
                        <TouchableOpacity onPress={onClose} accessibilityRole="button" style={{ paddingVertical: 8, paddingRight: 16 }}>
                            <Text style={{ color: tokens.textSecondary, fontFamily: 'Lexend-SemiBold', fontSize: 14 }}>{t('common:close')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onOpenInBible}
                            accessibilityRole="button"
                            style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }}
                        >
                            <Text style={{ color: tokens.textPrimary, fontFamily: 'Lexend-SemiBold', fontSize: 14 }}>
                                {t('preach:open_in_bible')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

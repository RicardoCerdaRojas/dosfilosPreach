import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReadingModeTokens } from '@/core/theme/readingModes';
import { FACE_CLASS } from '@/core/theme/typography';
import type { DeliveryFace } from '@/core/theme/typography';

interface Props {
    visible: boolean;
    tokens: ReadingModeTokens;
    face: DeliveryFace;
    books: { id: string; name: string; chapters: number }[];
    bookId: string;
    chapter: number;
    versionId: string;
    onPick: (bookId: string, chapter: number) => void;
    onPickVersion: (versionId: string) => void;
    onClose: () => void;
}

const VERSIONS = [
    { id: 'rvr1960', label: 'RVR1960' },
    { id: 'asv', label: 'ASV' },
];

/**
 * Selector de pasaje: libro y capítulo en dos grillas, sin navegación.
 *
 * Era una pantalla ("biblioteca") y pasa a ser un control. La diferencia
 * importa: elegir un libro no es un destino al que se viaja, es un ajuste del
 * lector que ya está abierto. La versión vive acá por la misma razón.
 */
export function BiblePickerSheet({
    visible,
    tokens,
    face,
    books,
    bookId,
    chapter,
    versionId,
    onPick,
    onPickVersion,
    onClose,
}: Props) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [pendingBook, setPendingBook] = useState<string | null>(null);

    const chosen = pendingBook ?? bookId;
    const book = books.find((b) => b.id === chosen);

    return (
        <Modal visible={visible} transparent animationType={tokens.animations ? 'fade' : 'none'} onRequestClose={onClose}>
            <Pressable className="flex-1 bg-black/40" onPress={onClose}>
                <Pressable
                    className="mt-auto rounded-t-3xl px-6 pt-5"
                    onPress={() => undefined}
                    style={{
                        backgroundColor: tokens.surface,
                        paddingBottom: insets.bottom + 20,
                        maxHeight: '82%',
                    }}
                >
                    <View className="flex-row items-center mb-4">
                        <Text
                            style={{ color: tokens.textPrimary }}
                            className={`${FACE_CLASS[face].semibold} text-lg flex-1`}
                        >
                            {t('bible:pick_passage')}
                        </Text>
                        {VERSIONS.map((version) => (
                            <TouchableOpacity
                                key={version.id}
                                onPress={() => onPickVersion(version.id)}
                                accessibilityRole="button"
                                accessibilityLabel={version.label}
                                className="px-3 py-1.5 rounded-full ml-2"
                                style={{
                                    backgroundColor:
                                        version.id === versionId ? tokens.accent : 'transparent',
                                    borderWidth: 1,
                                    borderColor:
                                        version.id === versionId ? tokens.accent : tokens.border,
                                }}
                            >
                                <Text
                                    style={{
                                        color:
                                            version.id === versionId
                                                ? tokens.background
                                                : tokens.textPrimary,
                                    }}
                                    className="font-lexend text-xs"
                                >
                                    {version.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View className="flex-row flex-wrap">
                            {books.map((b) => (
                                <TouchableOpacity
                                    key={b.id}
                                    onPress={() => setPendingBook(b.id)}
                                    accessibilityRole="button"
                                    accessibilityLabel={b.name}
                                    className="px-3 py-2 rounded-lg mr-2 mb-2"
                                    style={{
                                        backgroundColor:
                                            b.id === chosen ? tokens.accent : 'transparent',
                                        borderWidth: 1,
                                        borderColor: b.id === chosen ? tokens.accent : tokens.border,
                                    }}
                                >
                                    <Text
                                        style={{
                                            color:
                                                b.id === chosen
                                                    ? tokens.background
                                                    : tokens.textPrimary,
                                        }}
                                        className="font-lexend text-sm"
                                    >
                                        {b.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {book ? (
                            <>
                                <Text
                                    style={{ color: tokens.textSecondary }}
                                    className="font-lexend-semibold text-xs uppercase tracking-widest mt-5 mb-2"
                                >
                                    {t('bible:chapter')}
                                </Text>
                                <View className="flex-row flex-wrap">
                                    {Array.from({ length: book.chapters }, (_, i) => i + 1).map(
                                        (n) => (
                                            <TouchableOpacity
                                                key={n}
                                                onPress={() => onPick(book.id, n)}
                                                accessibilityRole="button"
                                                accessibilityLabel={`${book.name} ${n}`}
                                                className="items-center justify-center mr-2 mb-2 rounded-lg"
                                                style={{
                                                    width: 46,
                                                    height: 42,
                                                    borderWidth: 1,
                                                    borderColor:
                                                        book.id === bookId && n === chapter
                                                            ? tokens.accent
                                                            : tokens.border,
                                                }}
                                            >
                                                <Text
                                                    style={{ color: tokens.textPrimary }}
                                                    className="font-lexend text-sm"
                                                >
                                                    {n}
                                                </Text>
                                            </TouchableOpacity>
                                        ),
                                    )}
                                </View>
                            </>
                        ) : null}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

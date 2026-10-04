import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { parseBibleReferenceParts } from '@dosfilos/domain';

import { ReadingModeTokens } from '@/core/theme/readingModes';
import { FACE_CLASS } from '@/core/theme/typography';
import type { DeliveryFace } from '@/core/theme/typography';
import { useBibleMarks } from '@/presentation/hooks/useBibleMarks';
import { SelectableVerses } from '@/presentation/components/bible/SelectableVerses';
import { BiblePickerSheet } from '@/presentation/components/bible/BiblePickerSheet';
import { BibleVersionFactory } from '@/data/repositories/bible/BibleVersionFactory';

interface Props {
    visible: boolean;
    tokens: ReadingModeTokens;
    face: DeliveryFace;
    fontSize: number;
    /** Referencias del sermón: la primera decide dónde abre. */
    references: string[];
    onClose: () => void;
}

/**
 * La Biblia DENTRO del sermón.
 *
 * El módulo aparte sigue estando —a veces sólo se quiere leer— pero en el
 * atril salir del sermón para buscar un pasaje es exactamente lo que no se
 * puede hacer con gente mirando. Por eso entra como cajón lateral: el sermón
 * no se pierde de vista, y se cierra con un toque.
 *
 * Abre en la referencia del sermón, no en Génesis 1: el pasaje que se está
 * predicando es el que se va a consultar en el 90% de los casos.
 *
 * Muestra las marcas hechas al estudiar. Eso es la mitad del valor: lo que el
 * pastor subrayó el martes aparece solo el domingo.
 */
export function BibleConsultSheet({
    visible,
    tokens,
    face,
    fontSize,
    references,
    onClose,
}: Props) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { data: marks } = useBibleMarks();

    const opening = references.map(parseBibleReferenceParts).find((parts) => parts !== null);
    const [versionId, setVersionId] = useState('rvr1960');
    const [chapter, setChapter] = useState(opening?.chapter ?? 1);
    const [showPicker, setShowPicker] = useState(false);

    const repo = BibleVersionFactory.getByVersion(versionId);
    /**
     * La referencia del sermón trae el id del DOMINIO (`jon`), que no es el
     * del juego de datos (`jn`). Se traduce por el NOMBRE, que es lo único que
     * las dos tablas comparten; sin traducir, el pasaje del sermón abría en
     * otro libro.
     */
    const [bookId, setBookId] = useState(
        opening ? (repo?.resolveBookId(opening.bookKey) ?? 'jn') : 'jn',
    );
    const books = repo?.getBooks() ?? [];
    const book = books.find((b) => b.id === bookId) ?? books[0];
    const verses = repo?.getChapterContent(bookId, chapter) ?? [];
    const chapterCount = repo?.getChapterCount(bookId) ?? 1;

    const goChapter = (delta: number) => {
        const next = chapter + delta;
        if (next >= 1 && next <= chapterCount) setChapter(next);
    };

    return (
        <Modal visible={visible} transparent animationType={tokens.animations ? 'fade' : 'none'} onRequestClose={onClose}>
            <Pressable className="flex-1 flex-row bg-black/40" onPress={onClose}>
                <View className="flex-1" />
                <Pressable
                    onPress={() => undefined}
                    style={{
                        width: '46%',
                        minWidth: 380,
                        backgroundColor: tokens.surface,
                        borderLeftWidth: 1,
                        borderLeftColor: tokens.border,
                        paddingTop: insets.top + 10,
                    }}
                >
                    <View className="flex-row items-center px-5 pb-3">
                        <TouchableOpacity
                            onPress={() => setShowPicker(true)}
                            accessibilityRole="button"
                            accessibilityLabel={t('bible:pick_passage')}
                            className="flex-row items-center"
                        >
                            <Text
                                style={{ color: tokens.textPrimary }}
                                className={`${FACE_CLASS[face].semibold} text-lg`}
                            >
                                {book?.name ?? ''} {chapter}
                            </Text>
                            <MaterialIcons
                                name="expand-more"
                                size={20}
                                color={tokens.textSecondary}
                            />
                        </TouchableOpacity>

                        <View className="flex-1" />

                        <TouchableOpacity
                            onPress={() => goChapter(-1)}
                            disabled={chapter <= 1}
                            accessibilityRole="button"
                            accessibilityLabel={t('bible:previous_chapter')}
                            style={{ opacity: chapter <= 1 ? 0.3 : 1 }}
                        >
                            <MaterialIcons
                                name="chevron-left"
                                size={26}
                                color={tokens.textSecondary}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => goChapter(1)}
                            disabled={chapter >= chapterCount}
                            accessibilityRole="button"
                            accessibilityLabel={t('bible:next_chapter')}
                            className="ml-3 mr-4"
                            style={{ opacity: chapter >= chapterCount ? 0.3 : 1 }}
                        >
                            <MaterialIcons
                                name="chevron-right"
                                size={26}
                                color={tokens.textSecondary}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel={t('common:close')}
                        >
                            <MaterialIcons name="close" size={22} color={tokens.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        contentContainerStyle={{
                            paddingHorizontal: 20,
                            paddingBottom: insets.bottom + 40,
                        }}
                    >
                        <SelectableVerses
                            bookId={bookId}
                            chapter={chapter}
                            verses={verses}
                            marks={marks ?? new Map()}
                            tokens={tokens}
                            face={face}
                            // Un punto menos que el sermón: es texto de apoyo,
                            // no lo que se está leyendo en voz alta.
                            fontSize={Math.max(16, fontSize - 4)}
                            selection={null}
                            onSelectionChange={NOOP}
                            onSelectionEnd={NOOP}
                        />
                    </ScrollView>

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
                            setShowPicker(false);
                        }}
                        onPickVersion={setVersionId}
                        onClose={() => setShowPicker(false)}
                    />
                </Pressable>
            </Pressable>
        </Modal>
    );
}

/** Constante fuera del render: en el atril no se marca, se lee. */
const NOOP = () => undefined;

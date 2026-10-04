import React, { useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReadingModeTokens } from '@/core/theme/readingModes';
import { FACE_CLASS } from '@/core/theme/typography';
import type { DeliveryFace } from '@/core/theme/typography';
import { BibleVersionFactory } from '@/data/repositories/bible/BibleVersionFactory';
import { AUTHOR_KEYS, bookIdsForScope, type SearchScope } from '@/domain/bible/utils/BibleScopes';
import { splitByMatches } from '@dosfilos/domain';
import { useReaderSettingsStore } from '@/presentation/state/readerSettings.store';

interface Props {
    visible: boolean;
    tokens: ReadingModeTokens;
    face: DeliveryFace;
    versionId: string;
    /** Libro abierto: es el ámbito más útil y por eso tiene chip propio. */
    currentBookId: string;
    currentBookName: string;
    /** Abre en el versículo exacto, no sólo en el capítulo. */
    onOpen: (bookId: string, chapter: number, verse: number) => void;
    onClose: () => void;
}

/**
 * Búsqueda con CONTEXTO, no un índice de referencias.
 *
 * Una lista de "Salmo 23:4 · Jeremías 23:23" obliga a abrir cada una para
 * saber si servía. Acá cada resultado trae el versículo entero: buscar es una
 * forma de leer, no un paso previo a leer.
 */
/** Tope de resultados: más que esto no se lee, se refina la búsqueda. */
const RESULT_LIMIT = 40;

export function BibleSearchSheet({
    visible,
    tokens,
    face,
    versionId,
    currentBookId,
    currentBookName,
    onOpen,
    onClose,
}: Props) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState<SearchScope>({ kind: 'all' });
    const recentSearches = useReaderSettingsStore((s) => s.recentSearches);
    const rememberSearch = useReaderSettingsStore((s) => s.rememberSearch);

    const repo = BibleVersionFactory.getByVersion(versionId);
    const scopeIds = repo ? bookIdsForScope(scope, repo.getBooks(), versionId) : null;
    // Sin debounce: con el índice (C1) cada búsqueda tarda 1-4 ms (medido en
    // Node). Esperar acá sería fingir una latencia que no existe.
    const results =
        query.trim().length >= 3
            ? (repo?.search(query.trim(), RESULT_LIMIT, scopeIds ?? undefined) ?? [])
            : [];

    // El índice se arma al ABRIR la hoja (~300 ms una vez), no en la primera
    // tecla: así el pastor no ve el primer carácter trabarse.
    useEffect(() => {
        if (!visible || !repo) return;
        const timer = setTimeout(() => repo.warmSearch(), 50);
        return () => clearTimeout(timer);
    }, [visible, repo]);

    /** Chip de ámbito. El elegido lleva fondo, no sólo color. */
    const chip = (key: string, label: string, active: boolean, onPress: () => void) => (
        <TouchableOpacity
            key={key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className="px-3.5 rounded-full mr-2 justify-center"
            style={{
                height: 34,
                backgroundColor: active ? tokens.accent : tokens.background,
                borderWidth: 1,
                borderColor: active ? tokens.accent : tokens.border,
            }}
        >
            <Text
                style={{ color: active ? tokens.background : tokens.textSecondary }}
                className={`${FACE_CLASS[face].semibold} text-xs`}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} transparent animationType={tokens.animations ? 'fade' : 'none'} onRequestClose={onClose}>
            {/* El teclado tapaba media lista: la hoja se levanta con él en vez
                de quedarse clavada al 80 % de la pantalla. */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose}>
                    <Pressable
                        onPress={() => undefined}
                        style={{
                            marginTop: 'auto',
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            paddingHorizontal: 24,
                            paddingTop: 20,
                            backgroundColor: tokens.surface,
                            paddingBottom: insets.bottom + 16,
                            // Alto máximo, no alto fijo: con pocos resultados la
                            // hoja no tiene por qué ocupar la pantalla entera.
                            maxHeight: '86%',
                        }}
                    >
                        <View
                            style={{
                                alignSelf: 'center',
                                width: 44,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: tokens.border,
                                marginBottom: 16,
                            }}
                        />
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        autoFocus
                        placeholder={t('bible:search_placeholder')}
                        placeholderTextColor={tokens.textSecondary}
                        style={{
                            color: tokens.textPrimary,
                            borderColor: tokens.border,
                            borderWidth: 1,
                            borderRadius: 12,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                        }}
                        className={`${FACE_CLASS[face].regular} text-base`}
                    />

                    {/* Ámbito. Buscar en los 66 libros sirve para recordar una
                        frase; para trabajar hay que poder acotar. */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        // `flexGrow: 0` y alto propio: un ScrollView horizontal
                        // dentro de una columna se estira a todo lo alto que
                        // encuentre, y sus hijos con él. Sin esto los chips
                        // salían como columnas de 300 puntos.
                        style={{ flexGrow: 0, marginTop: 12 }}
                        contentContainerStyle={{ alignItems: 'center', paddingVertical: 2 }}
                    >
                        {chip('all', t('bible:scope_all'), scope.kind === 'all', () =>
                            setScope({ kind: 'all' }),
                        )}
                        {chip(
                            'book',
                            currentBookName,
                            scope.kind === 'book',
                            () => setScope({ kind: 'book', bookId: currentBookId }),
                        )}
                        {chip(
                            'old',
                            t('bible:old_testament_full'),
                            scope.kind === 'testament' && scope.value === 'Old',
                            () => setScope({ kind: 'testament', value: 'Old' }),
                        )}
                        {chip(
                            'new',
                            t('bible:new_testament_full'),
                            scope.kind === 'testament' && scope.value === 'New',
                            () => setScope({ kind: 'testament', value: 'New' }),
                        )}
                        {AUTHOR_KEYS.map((author) =>
                            chip(
                                author,
                                t(`bible:author_${author}`),
                                scope.kind === 'author' && scope.value === author,
                                () => setScope({ kind: 'author', value: author }),
                            ),
                        )}
                    </ScrollView>

                    {results.length > 0 ? (
                        <Text
                            style={{ color: tokens.textSecondary }}
                            className={`${FACE_CLASS[face].regular} text-xs mt-2`}
                        >
                            {results.length >= RESULT_LIMIT
                                ? t('bible:results_in_scope_more', { count: RESULT_LIMIT })
                                : t('bible:results_in_scope', { count: results.length })}
                        </Text>
                    ) : null}

                    {scope.kind === 'author' ? (
                        // Se dice, no se sobreentiende: varias de estas
                        // atribuciones se discuten, y la interfaz no debería
                        // afirmar lo que el pastor no afirmaría predicando.
                        <Text
                            style={{ color: tokens.textSecondary }}
                            className={`${FACE_CLASS[face].regular} text-xs mt-1`}
                        >
                            {t('bible:author_note')}
                        </Text>
                    ) : null}

                    <ScrollView className="mt-3" keyboardShouldPersistTaps="handled">
                        {results.length === 0 && query.trim().length >= 3 ? (
                            <Text
                                style={{ color: tokens.textSecondary }}
                                className={`${FACE_CLASS[face].regular} text-sm mt-4`}
                            >
                                {t('bible:no_results')}
                            </Text>
                        ) : null}

                        {/* Con menos de tres letras no hay búsqueda: en vez de
                            una lista vacía, lo último que se buscó. */}
                        {query.trim().length < 3 ? (
                            <View className="mt-4">
                                <Text
                                    style={{ color: tokens.textSecondary }}
                                    className={`${FACE_CLASS[face].regular} text-xs mb-3`}
                                >
                                    {t('bible:search_hint')}
                                </Text>
                                {recentSearches.length > 0 ? (
                                    <>
                                        <Text
                                            style={{ color: tokens.textSecondary }}
                                            className={`${FACE_CLASS[face].semibold} text-xs mb-2`}
                                        >
                                            {t('bible:recent_searches')}
                                        </Text>
                                        {recentSearches.map((recent) => (
                                            <TouchableOpacity
                                                key={recent}
                                                onPress={() => setQuery(recent)}
                                                accessibilityRole="button"
                                                className="flex-row items-center py-2.5"
                                            >
                                                <Text
                                                    style={{ color: tokens.textPrimary }}
                                                    className={`${FACE_CLASS[face].regular} text-base`}
                                                >
                                                    {recent}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </>
                                ) : null}
                            </View>
                        ) : null}

                        {results.map((result, index) => (
                            <TouchableOpacity
                                key={`${result.reference}-${index}`}
                                onPress={() => {
                                    // La dirección viene EN el resultado: no
                                    // hay que re-interpretar la referencia
                                    // escrita, que es de donde salía el caer
                                    // siempre en Génesis.
                                    rememberSearch(query.trim());
                                    onOpen(result.bookId, result.chapter, result.verse);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={result.reference}
                                className="py-3"
                                style={{ borderBottomWidth: 1, borderBottomColor: tokens.border }}
                            >
                                <Text
                                    style={{ color: tokens.accent }}
                                    className={`${FACE_CLASS[face].semibold} text-xs mb-1`}
                                >
                                    {result.reference}
                                </Text>
                                <Text
                                    style={{ color: tokens.textPrimary }}
                                    className={`${FACE_CLASS[face].regular} text-base leading-6`}
                                >
                                    {/* Lo encontrado va resaltado: sin eso hay
                                        que releer el versículo entero para ver
                                        por qué apareció en la lista. */}
                                    {splitByMatches(result.text, result.ranges).map((part, i) =>
                                        part.match ? (
                                            <Text
                                                key={i}
                                                style={{
                                                    backgroundColor: tokens.highlightColors.yellow,
                                                    color: tokens.textPrimary,
                                                }}
                                                className={FACE_CLASS[face].semibold}
                                            >
                                                {part.text}
                                            </Text>
                                        ) : (
                                            <Text key={i}>{part.text}</Text>
                                        ),
                                    )}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}

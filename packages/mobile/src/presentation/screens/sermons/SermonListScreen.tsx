import React, { useMemo, useState } from 'react';
import { RefreshControl, SectionList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useAppTheme } from '@/core/theme/appTheme';
import { useLayout } from '@/core/theme/layout';
import { usePublishedSermons } from '@/presentation/hooks/useSermons';
import { OfflineNotice } from '@/presentation/components/OfflineNotice';
import { SermonCard } from '@/presentation/components/SermonCard';
import { SermonDetailView } from '@/presentation/screens/sermons/SermonDetailView';
import { EmptyState, SectionLabel, Skeleton } from '@/presentation/components/ui/kit';
import { SermonSummary } from '@/domain/models/sermon.model';

/** Ancho de la lista en panel dividido: entra un título de dos renglones. */
const LIST_PANE = 360;

/**
 * La biblioteca de sermones.
 *
 * EN TABLET ANCHA SON DOS PANELES. Una lista a pantalla completa en un iPad
 * deja renglones de mil píxeles y obliga a entrar y volver por cada sermón que
 * se quiere mirar. Con lista y detalle a la vez, comparar dos sermones de una
 * serie es un toque en vez de cuatro. En teléfono, o en vertical angosto,
 * sigue siendo una lista que navega — el mismo código, distinta forma.
 */
export default function SermonListScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useAppTheme();
    const { isSplit, gutter } = useLayout();
    const { data: groups, isLoading, isRefetching, error, refetch } = usePublishedSermons();
    const [searchQuery, setSearchQuery] = useState('');
    const [openId, setOpenId] = useState<string | null>(null);

    const sections = useMemo(() => {
        if (!groups) return [];
        const q = searchQuery.trim().toLowerCase();
        const matches = (s: SermonSummary) =>
            !q ||
            s.title.toLowerCase().includes(q) ||
            s.bibleReferences.some((r) => r.toLowerCase().includes(q));
        return groups
            .map((g) => ({
                // "Plan" y no "serie": es la palabra que ve el pastor en la
                // web y en el planificador. El dominio los llama `seriesId` y
                // la colección `series`, pero la interfaz no tiene por qué
                // heredar el nombre de la tabla.
                title: g.seriesTitle ?? t('sermons:no_series'),
                data: g.sermons.filter(matches),
            }))
            .filter((sec) => sec.data.length > 0);
    }, [groups, searchQuery, t]);

    // El primero de la lista abre el panel: en pantalla ancha, un panel vacío
    // al entrar es media pantalla desperdiciada.
    const firstId = sections[0]?.data[0]?.id ?? null;
    const selectedId = openId ?? firstId;

    const list = (
        <View
            className="flex-1"
            style={{
                backgroundColor: theme.background,
                paddingTop: insets.top,
                width: isSplit ? LIST_PANE : undefined,
                borderRightWidth: isSplit ? 1 : 0,
                borderRightColor: theme.border,
            }}
        >
            <View style={{ paddingHorizontal: isSplit ? 16 : gutter, paddingTop: 8, paddingBottom: 12 }}>
                <Text
                    style={{ color: theme.textPrimary, fontSize: 26 }}
                    className="font-lexend-bold mb-3"
                >
                    {t('sermons:title')}
                </Text>
                <View
                    className="flex-row items-center px-3 rounded-xl"
                    style={{
                        backgroundColor: theme.surfaceSunken,
                        borderWidth: 1,
                        borderColor: theme.border,
                    }}
                >
                    <MaterialIcons name="search" size={19} color={theme.textMuted} />
                    <TextInput
                        className="flex-1 px-2 py-2.5 font-lexend"
                        style={{ color: theme.textPrimary, fontSize: 15 }}
                        placeholder={t('sermons:search_placeholder')}
                        placeholderTextColor={theme.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCorrect={false}
                    />
                    {searchQuery ? (
                        <TouchableOpacity
                            onPress={() => setSearchQuery('')}
                            accessibilityRole="button"
                        >
                            <MaterialIcons name="close" size={18} color={theme.textMuted} />
                        </TouchableOpacity>
                    ) : null}
                </View>
                <View style={{ marginTop: 12 }}>
                    <OfflineNotice />
                </View>
            </View>

            {isLoading ? (
                <View style={{ paddingHorizontal: isSplit ? 16 : gutter }}>
                    {[0, 1, 2, 3].map((i) => (
                        <View
                            key={i}
                            className="px-5 py-4 mb-2.5"
                            style={{
                                backgroundColor: theme.surface,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: theme.border,
                            }}
                        >
                            <Skeleton theme={theme} height={11} width={110} />
                            <Skeleton theme={theme} height={18} style={{ marginTop: 10 }} />
                            <Skeleton theme={theme} height={11} width={80} style={{ marginTop: 12 }} />
                        </View>
                    ))}
                </View>
            ) : error ? (
                <EmptyState
                    theme={theme}
                    title={t('sermons:error_loading_list')}
                    action={
                        <TouchableOpacity
                            onPress={() => refetch()}
                            accessibilityRole="button"
                            className="px-6 py-3 rounded-full active:opacity-85"
                            style={{ backgroundColor: theme.accent }}
                        >
                            <Text
                                style={{ color: theme.onAccent }}
                                className="font-lexend-semibold"
                            >
                                {t('common:retry')}
                            </Text>
                        </TouchableOpacity>
                    }
                />
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <SermonCard
                            sermon={item}
                            active={isSplit && item.id === selectedId}
                            onPress={
                                isSplit
                                    ? () => setOpenId(item.id)
                                    : () => router.push(`/sermon/${item.id}`)
                            }
                        />
                    )}
                    renderSectionHeader={({ section }) => (
                        <SectionLabel theme={theme} style={{ marginTop: 18, marginBottom: 8 }}>
                            {section.title}
                        </SectionLabel>
                    )}
                    contentContainerStyle={{
                        paddingHorizontal: isSplit ? 16 : gutter,
                        paddingBottom: insets.bottom + 24,
                    }}
                    stickySectionHeadersEnabled={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching}
                            onRefresh={refetch}
                            tintColor={theme.textMuted}
                        />
                    }
                    ListEmptyComponent={
                        <EmptyState
                            theme={theme}
                            title={
                                searchQuery
                                    ? t('sermons:no_results')
                                    : t('home:no_sermons_title')
                            }
                            hint={searchQuery ? undefined : t('home:no_sermons_hint')}
                        />
                    }
                />
            )}
        </View>
    );

    if (!isSplit) return list;

    return (
        <View className="flex-1 flex-row" style={{ backgroundColor: theme.background }}>
            {list}
            <View className="flex-1">
                {selectedId ? (
                    <SermonDetailView key={selectedId} sermonId={selectedId} showBack={false} />
                ) : (
                    <View className="flex-1 justify-center">
                        <EmptyState theme={theme} title={t('sermons:pick_one')} />
                    </View>
                )}
            </View>
        </View>
    );
}

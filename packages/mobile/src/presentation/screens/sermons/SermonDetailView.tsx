import React, { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { buildReadingBlocks, formatRuns, type ReadingBlock } from '@dosfilos/domain';

import { useAppTheme } from '@/core/theme/appTheme';
import { STUDY_COLUMN, useLayout } from '@/core/theme/layout';
import { READING_MODES } from '@/core/theme/readingModes';
import { FACE_FAMILY, formattedFont } from '@/core/theme/typography';
import { extractSectionsWithBody } from '@/core/utils/sermonSections';
import { useAddPreachingLog, useRemovePreachingLog, useSermon } from '@/presentation/hooks/useSermons';
import { useUIStore } from '@/presentation/state/ui.store';
import { useBriefcase, usePrepareBriefcase, useRemoveBriefcase } from '@/presentation/hooks/useSermonBriefcase';
import { OfflineNotice } from '@/presentation/components/OfflineNotice';
import { TABLET_EDITING } from '@/core/config/features';
import { useReaderSettingsStore } from '@/presentation/state/readerSettings.store';
import { BibleConsultSheet } from '@/presentation/components/bible/BibleConsultSheet';
import { Chip, EmptyState, SectionLabel, Skeleton } from '@/presentation/components/ui/kit';

interface Props {
    sermonId: string;
    /** En panel dividido no hay atrás: la lista ya está a la izquierda. */
    showBack?: boolean;
}

/**
 * El sermón para ESTUDIAR — la vista previa al atril.
 *
 * Es una vista y no una pantalla porque en tablet ancha vive al lado de la
 * lista. Antes era sólo una ruta, y eso obligaba a ir y volver por cada
 * sermón que se quería mirar.
 *
 * TRES DECISIONES DE LECTURA:
 *
 * 1. El cuerpo va en SERIF (Literata). El atril usa la familia que el
 *    predicador eligió para leer de pie; acá se lee sentado, largo y en
 *    silencio, que es exactamente para lo que la serif está hecha.
 * 2. La columna se corta en `STUDY_COLUMN`. Un renglón del ancho de la tablet
 *    hace perder la línea al volver — el mismo problema que el púlpito
 *    resuelve midiendo en caracteres.
 * 3. La referencia va ARRIBA del título. Es lo que el pastor busca.
 */
export function SermonDetailView({ sermonId, showBack = true }: Props) {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const theme = useAppTheme();
    const { gutter } = useLayout();

    const { data: sermon, isLoading, error } = useSermon(sermonId);
    const readingMode = useReaderSettingsStore((s) => s.readingMode);
    const deliveryFace = useReaderSettingsStore((s) => s.deliveryFace);
    const fontSize = useReaderSettingsStore((s) => s.deliveryFontSize);
    const { data: briefcase } = useBriefcase(sermonId);
    const prepare = usePrepareBriefcase(sermonId);
    const removeSaved = useRemoveBriefcase(sermonId);
    const addLog = useAddPreachingLog(sermonId);
    const removeLog = useRemovePreachingLog(sermonId);
    const showToast = useUIStore((s) => s.showToast);
    const [showBible, setShowBible] = useState(false);

    // Sin useMemo: el compilador de React memoiza solo (y la regla de lint
    // rechaza memoización manual que no puede preservar).
    const sections = sermon?.content ? extractSectionsWithBody(sermon.content) : [];

    if (isLoading) {
        return (
            <View
                className="flex-1"
                style={{ backgroundColor: theme.background, padding: gutter, paddingTop: insets.top + 32 }}
            >
                <Skeleton theme={theme} height={13} width={140} />
                <Skeleton theme={theme} height={34} style={{ marginTop: 16 }} />
                <Skeleton theme={theme} height={34} width="60%" style={{ marginTop: 8 }} />
                <Skeleton theme={theme} height={16} style={{ marginTop: 40 }} />
                <Skeleton theme={theme} height={16} style={{ marginTop: 10 }} />
                <Skeleton theme={theme} height={16} width="80%" style={{ marginTop: 10 }} />
            </View>
        );
    }

    if (error || !sermon) {
        return (
            <View className="flex-1 justify-center" style={{ backgroundColor: theme.background }}>
                <EmptyState theme={theme} title={t('sermons:error_loading')} />
            </View>
        );
    }

    const preachedTimes = sermon.preachingHistory?.length ?? 0;
    const lastPreached = sermon.preachingHistory?.length
        ? new Date(
              Math.max(...sermon.preachingHistory.map((log) => new Date(log.date).getTime())),
          ).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })
        : '';

    const publishedDate = sermon.publishedAt
        ? new Date(sermon.publishedAt).toLocaleDateString(i18n.language, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : null;

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <View
                className="flex-row items-center px-3 pb-2"
                style={{
                    paddingTop: insets.top + 4,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                }}
            >
                {showBack ? (
                    <TouchableOpacity
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel={t('common:back')}
                        className="p-2 active:opacity-60"
                    >
                        <MaterialIcons name="arrow-back" size={23} color={theme.textSecondary} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 12 }} />
                )}
                <Text
                    style={{ color: theme.textSecondary, fontSize: 14 }}
                    className="flex-1 font-lexend-semibold ml-1"
                    numberOfLines={1}
                >
                    {sermon.title}
                </Text>
                {/* La Biblia al lado del sermón también acá: al preparar se
                    consulta más que al predicar. */}
                <TouchableOpacity
                    onPress={() => setShowBible(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('bible:title')}
                    className="p-2 active:opacity-60"
                >
                    <MaterialIcons name="menu-book" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
            </View>

            <BibleConsultSheet
                visible={showBible}
                tokens={READING_MODES[readingMode]}
                face={deliveryFace}
                fontSize={fontSize}
                references={sermon.bibleReferences ?? []}
                onClose={() => setShowBible(false)}
            />

            <ScrollView
                className="flex-1"
                contentContainerStyle={{
                    paddingHorizontal: gutter,
                    paddingBottom: insets.bottom + 104,
                }}
            >
                <View style={{ width: '100%', maxWidth: STUDY_COLUMN, alignSelf: 'center' }}>
                    <View style={{ marginTop: 16 }}>
                        <OfflineNotice />
                    </View>
                    {sermon.bibleReferences.length > 0 ? (
                        <Text
                            style={{
                                color: theme.accent,
                                fontSize: 13,
                                letterSpacing: 0.6,
                                marginTop: 28,
                            }}
                            className="font-lexend-semibold"
                        >
                            {sermon.bibleReferences.join(' · ').toUpperCase()}
                        </Text>
                    ) : null}

                    <Text
                        style={{ color: theme.textPrimary, fontSize: 32, lineHeight: 40, marginTop: 6 }}
                        className="font-lexend-bold"
                    >
                        {sermon.title}
                    </Text>

                    <View className="flex-row items-center flex-wrap mt-3">
                        {/* Predicado: el estado que decide qué queda por
                            delante. Se marca acá y no sólo al salir del atril,
                            porque se predica sin la tablet más seguido de lo
                            que uno cree. */}
                        <TouchableOpacity
                            onPress={() => {
                                if (addLog.isPending) return;
                                const record = () => {
                                    const log = {
                                        date: new Date(),
                                        // Sin lugar: el registro completo se
                                        // pide al salir del púlpito. Exigirlo
                                        // acá haría que marcar cueste más que
                                        // predicar.
                                        location: '',
                                        durationMinutes: 0,
                                    };
                                    addLog.mutate(log);
                                    // Un toque de más se deshace desde el
                                    // aviso: antes no había vuelta atrás (A5).
                                    showToast(t('sermons:marked_preached'), 'success', 6000, {
                                        label: t('common:undo'),
                                        onPress: () => removeLog.mutate(log),
                                    });
                                };
                                // Ya marcado, se pregunta: un toque de más no
                                // debería inventar una predicación que no
                                // ocurrió, y un sermón SÍ se predica dos veces.
                                if (preachedTimes > 0) {
                                    Alert.alert(
                                        t('sermons:mark_preached'),
                                        t('sermons:mark_preached_again'),
                                        [
                                            { text: t('common:cancel'), style: 'cancel' },
                                            { text: t('sermons:mark_preached'), onPress: record },
                                        ],
                                    );
                                    return;
                                }
                                record();
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t('sermons:mark_preached')}
                            className="mr-3 mb-1"
                        >
                            <Chip
                                theme={theme}
                                tone={preachedTimes > 0 ? 'positive' : 'neutral'}
                                label={
                                    preachedTimes > 1
                                        ? t('sermons:preached_times', { count: preachedTimes })
                                        : preachedTimes === 1
                                          ? t('sermons:preached_on', { date: lastPreached })
                                          : t('sermons:mark_preached')
                                }
                                icon={
                                    <MaterialIcons
                                        name={preachedTimes > 0 ? 'check-circle' : 'add-task'}
                                        size={13}
                                        color={
                                            preachedTimes > 0 ? theme.positive : theme.textSecondary
                                        }
                                    />
                                }
                            />
                        </TouchableOpacity>
                        {publishedDate ? (
                            <Text
                                style={{ color: theme.textMuted, fontSize: 13 }}
                                className="font-lexend mr-3"
                            >
                                {publishedDate}
                            </Text>
                        ) : null}
                        {/* M-03 — el maletín. El pastor VE que el sermón está
                            garantizado antes de subir al púlpito; no tiene que
                            confiar en que la caché "probablemente" lo tenga. */}
                        <TouchableOpacity
                            onPress={() => {
                                if (!briefcase) {
                                    prepare.mutate();
                                    return;
                                }
                                // Ya guardado: se renueva o se quita. Antes el
                                // chip quedaba deshabilitado para siempre y la
                                // copia no se podía poner al día.
                                const date = new Date(briefcase.savedAt).toLocaleString(i18n.language, {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                });
                                Alert.alert(
                                    t('sermons:ready_offline'),
                                    t('sermons:offline_saved_on', { date }),
                                    [
                                        { text: t('common:cancel'), style: 'cancel' },
                                        { text: t('sermons:offline_remove'), style: 'destructive', onPress: () => removeSaved.mutate() },
                                        { text: t('sermons:offline_update'), onPress: () => prepare.mutate() },
                                    ],
                                );
                            }}
                            disabled={prepare.isPending}
                            accessibilityRole="button"
                            accessibilityLabel={t(
                                briefcase ? 'sermons:ready_offline' : 'sermons:prepare_offline',
                            )}
                        >
                            <Chip
                                theme={theme}
                                tone={briefcase ? 'positive' : 'neutral'}
                                label={
                                    prepare.isPending
                                        ? t('sermons:preparing_offline')
                                        : briefcase
                                          ? t('sermons:ready_offline')
                                          : t('sermons:prepare_offline')
                                }
                                icon={
                                    <MaterialIcons
                                        name={
                                            prepare.isPending
                                                ? 'cloud-download'
                                                : briefcase
                                                  ? 'offline-pin'
                                                  : 'cloud-off'
                                        }
                                        size={13}
                                        color={briefcase ? theme.positive : theme.textSecondary}
                                    />
                                }
                            />
                        </TouchableOpacity>
                    </View>

                    {sections.length === 0 ? (
                        <EmptyState theme={theme} title={t('sermons:no_content')} />
                    ) : (
                        sections.map((section) => (
                            <View key={section.slug} style={{ marginTop: 34 }}>
                                {section.title ? (
                                    <>
                                        <SectionLabel theme={theme}>
                                            {t('sermons:movement')}
                                        </SectionLabel>
                                        <Text
                                            style={{
                                                color: theme.textPrimary,
                                                fontSize: 21,
                                                lineHeight: 28,
                                                marginTop: 4,
                                                marginBottom: 12,
                                            }}
                                            className="font-lexend-semibold"
                                        >
                                            {section.title}
                                        </Text>
                                    </>
                                ) : null}
                                {buildReadingBlocks(section.body).map((block, i) =>
                                    block.kind === 'subheading' ? (
                                        <Text
                                            key={i}
                                            style={{
                                                color: theme.textSecondary,
                                                fontSize: 15,
                                                marginTop: 20,
                                                marginBottom: 6,
                                            }}
                                            className="font-lexend-semibold"
                                        >
                                            <FormattedBlock block={block} />
                                        </Text>
                                    ) : block.kind === 'quote' ? (
                                        // El detalle es la vista de ESTUDIO: acá la
                                        // cita del comentario sí va en el flujo. La
                                        // que se colapsa es la del púlpito (P5).
                                        <View
                                            key={i}
                                            style={{
                                                borderLeftWidth: 2,
                                                borderLeftColor: theme.borderStrong,
                                                paddingLeft: 14,
                                                marginBottom: 14,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: theme.textSecondary,
                                                    fontSize: 16,
                                                    lineHeight: 27,
                                                }}
                                                className="font-literata italic"
                                            >
                                                <FormattedBlock block={block} />
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text
                                            key={i}
                                            style={{
                                                color: theme.textPrimary,
                                                fontSize: 17,
                                                lineHeight: 29,
                                                marginBottom: 14,
                                            }}
                                            className="font-literata"
                                        >
                                            {block.kind === 'listitem' ? '•  ' : ''}
                                            <FormattedBlock block={block} />
                                        </Text>
                                    ),
                                )}
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Las dos salidas del estudio: corregir, o subir. */}
            <View
                className="absolute left-0 right-0 flex-row items-center justify-center px-6"
                style={{
                    bottom: 0,
                    paddingTop: 12,
                    paddingBottom: insets.bottom + 14,
                    backgroundColor: theme.surface,
                    borderTopWidth: 1,
                    borderTopColor: theme.border,
                }}
            >
                {/* Editar vive acá, en la vista de estudio — no en el púlpito.
                    Predicando no se corrige: se predica. Apagado en la v1
                    (TABLET_EDITING, decisión D5). */}
                {TABLET_EDITING ? (
                    <TouchableOpacity
                        onPress={() => router.push(`/sermon/edit/${sermon.id}`)}
                        accessibilityRole="button"
                        accessibilityLabel={t('sermons:edit')}
                        className="flex-row items-center px-6 py-3.5 rounded-full mr-3 active:opacity-80"
                        style={{ borderWidth: 1, borderColor: theme.borderStrong }}
                    >
                        <MaterialIcons name="edit" size={18} color={theme.textSecondary} />
                        <Text
                            style={{ color: theme.textPrimary, fontSize: 15 }}
                            className="font-lexend-semibold ml-2"
                        >
                            {t('sermons:edit')}
                        </Text>
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                    onPress={() => router.push(`/preach/${sermon.id}`)}
                    disabled={sections.length === 0}
                    accessibilityRole="button"
                    className="flex-row items-center px-8 py-3.5 rounded-full active:opacity-85"
                    style={{
                        backgroundColor: theme.accent,
                        opacity: sections.length === 0 ? 0.4 : 1,
                    }}
                >
                    <MaterialIcons name="record-voice-over" size={19} color={theme.onAccent} />
                    <Text
                        style={{ color: theme.onAccent, fontSize: 15 }}
                        className="font-lexend-semibold ml-2"
                    >
                        {t('sermons:enter_preach_mode')}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

/**
 * El texto de un bloque con el formato que el pastor marcó en el editor:
 * negrita, cursiva y subrayado (`INLINE_FORMAT_RULE`). Antes era texto plano,
 * y el subrayado llegaba como «<u>…</u>».
 */
function FormattedBlock({ block }: { block: ReadingBlock }) {
    return (
        <>
            {formatRuns(block.text, block.marks).map((run, i) =>
                run.bold || run.italic || run.underline ? (
                    <Text
                        key={i}
                        style={{
                            ...formattedFont(FACE_FAMILY.literata, run),
                            textDecorationLine: run.underline ? 'underline' : 'none',
                        }}
                    >
                        {run.text}
                    </Text>
                ) : (
                    run.text
                ),
            )}
        </>
    );
}

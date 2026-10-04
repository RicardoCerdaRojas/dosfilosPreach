import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { defaultTargetMinutes, estimateSpokenMinutes, targetMinuteOptions } from '@dosfilos/domain';
import { useQuery } from '@tanstack/react-query';

import { useAppTheme, type AppTheme } from '@/core/theme/appTheme';
import { useLayout } from '@/core/theme/layout';
import { SermonSummary } from '@/domain/models/sermon.model';
import { useAuthStore } from '@/presentation/state/auth.store';
import { useReaderSettingsStore } from '@/presentation/state/readerSettings.store';
import { usePublishedSermons, useSermon } from '@/presentation/hooks/useSermons';
import { usePlanBoard, type PlanBoard } from '@/presentation/hooks/usePlanBoard';
import { useBriefcase, usePrepareBriefcase } from '@/presentation/hooks/useSermonBriefcase';
import { OfflineNotice } from '@/presentation/components/OfflineNotice';
import { useBibleMarks } from '@/presentation/hooks/useBibleMarks';
import { BibleVersionFactory, readingPassageFor } from '@/data/repositories/bible/BibleVersionFactory';
import { isReady, sundayReadiness, type ReadinessItem } from '@/core/utils/sundayReadiness';
import { SermonCard } from '@/presentation/components/SermonCard';
import { UserAvatar } from '@/presentation/components/UserAvatar';
import { Card, Chip, EmptyState, SectionLabel, Skeleton } from '@/presentation/components/ui/kit';

/**
 * El tablero de inicio.
 *
 * QUÉ RESPONDE, EN ESTE ORDEN: qué predico ahora, cuánto dura, si está
 * garantizado sin conexión, dónde iba leyendo, qué marqué últimamente, y en
 * qué punto de la serie estoy. Son las preguntas que un pastor se hace el
 * sábado a la noche y el domingo a la mañana.
 *
 * NADA SE INVENTA. Cada dato de acá sale de algo que la app ya sabe —las
 * palabras del sermón, el maletín, el último capítulo leído, las marcas
 * guardadas—. Un tablero con números decorativos es peor que no tenerlo: se
 * aprende a no mirarlo.
 *
 * SE ADAPTA A TRES PANTALLAS. En tablet las tarjetas van en dos columnas; en
 * teléfono, apiladas. Y todo lo que distingue estado usa además de color un
 * borde o un ícono, porque en un lector de tinta electrónica el color no
 * existe.
 */
export default function HomeScreen() {
    const user = useAuthStore((state) => state.user);
    const router = useRouter();
    const theme = useAppTheme();
    const { gutter, isTablet } = useLayout();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { data: groups, isLoading, error, refetch } = usePublishedSermons();
    const { current: plan } = usePlanBoard();

    const all = (groups ?? []).flatMap((g) => g.sermons);
    const recent = [...all].sort(
        (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
    );

    /**
     * QUÉ SERMÓN OFRECE EL TABLERO, EN ESTE ORDEN:
     *
     * 1. EL QUE SIGUE EN EL PLAN ACTIVO. Si el pastor está recorriendo una
     *    serie, lo próximo es la semana que toca — no hay nada que adivinar.
     * 2. EL MÁS VIEJO SIN PREDICAR. Fuera de un plan, el que espera hace más
     *    tiempo es el que sigue.
     * 3. El más reciente, si ya se predicaron todos: mejor ofrecer algo que
     *    dejar la tarjeta vacía.
     *
     * El criterio anterior era "el más reciente sin predicar", y estaba mal en
     * el caso más común: quien escribe cuatro sermones de una serie en una
     * tarde publica el cuarto al final, y el que predica el domingo es el
     * primero. El tablero le ofrecía el final de la serie.
     */
    const planned = plan?.next?.sermon;
    const oldestUnpreached = [...recent]
        .filter((s) => s.timesPreached === 0)
        .sort((a, b) => (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0))[0];
    const next = planned ?? oldestUnpreached ?? recent[0];
    const rest = recent.filter((s) => s.id !== next?.id).slice(0, 4);

    // La serie del próximo sermón: es la que el pastor está recorriendo.
    const series = next?.seriesId
        ? (groups ?? []).find((g) => g.seriesId === next.seriesId)
        : undefined;

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top }}>
            <ScrollView
                className="flex-1"
                contentContainerStyle={{
                    paddingHorizontal: gutter,
                    paddingBottom: insets.bottom + 40,
                }}
                showsVerticalScrollIndicator={false}
            >
                <View className="flex-row items-center justify-between py-6">
                    <View className="flex-1 pr-4">
                        <SectionLabel theme={theme}>Dos Filos Preach</SectionLabel>
                        <Text
                            style={{ color: theme.textPrimary, fontSize: isTablet ? 30 : 25 }}
                            className="font-lexend-bold mt-1"
                            numberOfLines={1}
                        >
                            {t('home:welcome')} {user?.firstName ?? ''}
                        </Text>
                    </View>
                    {/* En tablet el perfil vive al pie del rail; acá sobra. */}
                    {isTablet ? null : <UserAvatar />}
                </View>

                <OfflineNotice />

                {isLoading ? (
                    <Card theme={theme} style={{ padding: 24 }}>
                        <Skeleton theme={theme} height={12} width={120} />
                        <Skeleton theme={theme} height={26} style={{ marginTop: 14 }} />
                        <Skeleton theme={theme} height={26} width="70%" style={{ marginTop: 8 }} />
                        <Skeleton theme={theme} height={44} width={200} style={{ marginTop: 24 }} />
                    </Card>
                ) : next ? (
                    <NextSermon sermon={next} />
                ) : error ? (
                    // Falló la carga: se dice. Antes se veía «no tienes
                    // sermones», que parece un problema de datos (A2).
                    <Card theme={theme}>
                        <EmptyState
                            theme={theme}
                            title={t('common:load_failed')}
                            hint={t('common:load_failed_hint')}
                            action={
                                <TouchableOpacity
                                    onPress={() => refetch()}
                                    accessibilityRole="button"
                                    className="px-6 py-3 rounded-full active:opacity-85"
                                    style={{ backgroundColor: theme.accent }}
                                >
                                    <Text style={{ color: theme.onAccent }} className="font-lexend-semibold">
                                        {t('common:retry')}
                                    </Text>
                                </TouchableOpacity>
                            }
                        />
                    </Card>
                ) : (
                    <Card theme={theme}>
                        <EmptyState
                            theme={theme}
                            title={t('home:no_sermons_title')}
                            hint={t('home:no_sermons_hint')}
                        />
                    </Card>
                )}

                {plan ? <ActivePlan plan={plan} /> : null}

                {/* Las tres tarjetas de apoyo. En tablet, en fila. */}
                <View
                    style={{
                        flexDirection: isTablet ? 'row' : 'column',
                        marginTop: 14,
                        gap: 14,
                    }}
                >
                    <ContinueReading />
                    <RecentMarks />
                    {series ? <SeriesProgress title={series.seriesTitle} sermons={series.sermons} /> : null}
                </View>

                {rest.length > 0 ? (
                    <>
                        <View className="flex-row items-center justify-between mt-9 mb-3">
                            <SectionLabel theme={theme}>{t('home:recent_sermons')}</SectionLabel>
                            <TouchableOpacity
                                onPress={() => router.push('/(tabs)/sermons')}
                                accessibilityRole="button"
                            >
                                <Text
                                    style={{ color: theme.accent, fontSize: 13 }}
                                    className="font-lexend-semibold"
                                >
                                    {t('home:view_all')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {rest.map((sermon) => (
                            <SermonCard key={sermon.id} sermon={sermon} />
                        ))}
                    </>
                ) : null}
            </ScrollView>
        </View>
    );
}

/**
 * El sermón próximo, con lo que hay que saber antes de subir.
 *
 * La DURACIÓN se estima de las palabras del propio sermón a ritmo de
 * predicación. Es la pregunta que se hace todo el mundo antes de empezar —"¿me
 * paso de la hora?"— y hasta ahora sólo se respondía adentro del atril, con el
 * cronómetro ya corriendo.
 *
 * El MALETÍN se muestra acá y no sólo en el detalle: enterarse de que el
 * sermón no está garantizado sin conexión camino al púlpito es tarde.
 */
function NextSermon({ sermon }: { sermon: SermonSummary }) {
    const theme = useAppTheme();
    const router = useRouter();
    const { t } = useTranslation();
    const { data: briefcase } = useBriefcase(sermon.id);
    const { data: full } = useSermon(sermon.id);

    const minutes = full?.content ? estimateSpokenMinutes(full.content) : 0;

    // «Listo para el domingo» (C7). La lectura se busca DESPUÉS del primer
    // pintado: abrir la Biblia de la app (un JSON de varios MB) traba el hilo
    // un momento, pero la tarjeta ya está en pantalla. No es gratis: es tarde.
    const targetBySermon = useReaderSettingsStore((s) => s.targetMinutesBySermon);
    const setTargetMinutes = useReaderSettingsStore((s) => s.setTargetMinutes);
    const readingPageOn = useReaderSettingsStore((s) => s.readingPage);
    const prepare = usePrepareBriefcase(sermon.id);
    const refs = sermon.bibleReferences;
    const readingWanted = readingPageOn && refs.length > 0;
    const { data: readingTitle } = useQuery({
        queryKey: ['reading-ready', refs.join('|')],
        queryFn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
            // El título del pasaje que de verdad se va a leer, no el de la
            // primera referencia: puede ser otra (revisión adversarial).
            return readingPassageFor(refs)?.title ?? '';
        },
        enabled: readingWanted,
        staleTime: Infinity,
    });
    const fixedMinutes = targetBySermon[sermon.id];
    const items = sundayReadiness({
        offline: !!briefcase,
        readingWanted,
        readingFound: readingTitle === undefined ? null : readingTitle !== '',
    });
    const ready = isReady(items);
    const pending = items.filter((item) => !item.done).length;

    return (
        <Card theme={theme} style={{ padding: 24 }}>
            <View className="flex-row items-center justify-between">
                <SectionLabel theme={theme}>{t('home:next_to_preach')}</SectionLabel>
                <View className="flex-row items-center">
                    {minutes > 0 ? (
                        <View className="mr-2">
                            <Chip
                                theme={theme}
                                label={t('home:estimated_minutes', { minutes })}
                                icon={
                                    <MaterialIcons
                                        name="schedule"
                                        size={13}
                                        color={theme.textSecondary}
                                    />
                                }
                            />
                        </View>
                    ) : null}
                    <Chip
                        theme={theme}
                        tone={ready ? 'positive' : 'neutral'}
                        label={ready ? t('home:sunday_ready') : t('home:sunday_pending', { count: pending })}
                        icon={
                            <MaterialIcons
                                name={ready ? 'check-circle' : 'radio-button-unchecked'}
                                size={13}
                                color={ready ? theme.positive : theme.textSecondary}
                            />
                        }
                    />
                </View>
            </View>

            {sermon.bibleReferences.length > 0 ? (
                <Text
                    style={{ color: theme.accent, fontSize: 13, letterSpacing: 0.6, marginTop: 16 }}
                    className="font-lexend-semibold"
                >
                    {sermon.bibleReferences.join(' · ').toUpperCase()}
                </Text>
            ) : null}

            <Text
                style={{ color: theme.textPrimary, fontSize: 26, lineHeight: 33, marginTop: 4 }}
                className="font-lexend-bold"
                numberOfLines={3}
            >
                {sermon.title}
            </Text>

            <SundayChecklist
                items={items}
                passageTitle={readingTitle || (refs[0] ?? '')}
                preparing={prepare.isPending}
                onPrepare={() => prepare.mutate()}
                // La duración es un DATO, no un pendiente: la del texto ya es
                // la que usa el atril. Ajustar es elegir otra (revisión
                // adversarial: «Fijar» guardaba la misma y la congelaba).
                duration={
                    full?.content
                        ? {
                              minutes: fixedMinutes ?? defaultTargetMinutes(full.content),
                              chosen: fixedMinutes !== undefined,
                              onPick: (min: number) => setTargetMinutes(sermon.id, min),
                          }
                        : null
                }
            />

            <View className="flex-row items-center mt-6">
                <TouchableOpacity
                    onPress={() => router.push(`/preach/${sermon.id}`)}
                    accessibilityRole="button"
                    className="flex-row items-center px-6 py-3.5 rounded-full active:opacity-85"
                    style={{ backgroundColor: theme.accent }}
                >
                    <MaterialIcons name="record-voice-over" size={19} color={theme.onAccent} />
                    <Text
                        style={{ color: theme.onAccent, fontSize: 15 }}
                        className="font-lexend-semibold ml-2"
                    >
                        {t('home:open_pulpit')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => router.push(`/sermon/${sermon.id}`)}
                    accessibilityRole="button"
                    className="px-5 py-3.5 ml-2"
                >
                    <Text
                        style={{ color: theme.textSecondary, fontSize: 15 }}
                        className="font-lexend-semibold"
                    >
                        {t('sermons:read')}
                    </Text>
                </TouchableOpacity>
            </View>
        </Card>
    );
}

/**
 * Lo que falta para subir tranquilo, cada cosa con su arreglo a un toque.
 * Ícono además de color: en tinta electrónica el color no existe. Abajo, la
 * duración que va a usar el atril, con «Ajustar» para elegir otra.
 */
function SundayChecklist({
    items,
    passageTitle,
    preparing,
    onPrepare,
    duration,
}: {
    items: ReadinessItem[];
    passageTitle: string;
    preparing: boolean;
    onPrepare: () => void;
    duration: { minutes: number; chosen: boolean; onPick: (minutes: number) => void } | null;
}) {
    const theme = useAppTheme();
    const { t } = useTranslation();
    const [adjusting, setAdjusting] = useState(false);

    const label = (item: ReadinessItem) =>
        item.key === 'offline'
            ? t(item.done ? 'home:check_offline_done' : 'home:check_offline_todo')
            : t(item.done ? 'home:check_reading_done' : 'home:check_reading_todo', { passage: passageTitle });

    return (
        <View className="mt-5" accessibilityLabel={t('home:sunday_title')}>
            {items.map((item) => (
                <View
                    key={item.key}
                    className="flex-row items-center py-2"
                    style={{ borderTopWidth: 1, borderTopColor: theme.border }}
                >
                    <MaterialIcons
                        name={item.done ? 'check-circle' : 'radio-button-unchecked'}
                        size={18}
                        color={item.done ? theme.positive : theme.textSecondary}
                    />
                    <Text
                        style={{ color: item.done ? theme.textSecondary : theme.textPrimary, fontSize: 14, flex: 1 }}
                        className="font-lexend ml-2.5"
                    >
                        {label(item)}
                    </Text>
                    {!item.done && item.key === 'offline' ? (
                        preparing ? (
                            <ActivityIndicator size="small" color={theme.accent} />
                        ) : (
                            <ChecklistAction label={t('home:check_offline_action')} onPress={onPrepare} />
                        )
                    ) : null}
                </View>
            ))}
            {duration ? (
                <View className="py-2" style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
                    <View className="flex-row items-center">
                        <MaterialIcons name="schedule" size={18} color={theme.textSecondary} />
                        <Text style={{ color: theme.textSecondary, fontSize: 14, flex: 1 }} className="font-lexend ml-2.5">
                            {t(duration.chosen ? 'home:duration_chosen' : 'home:duration_from_text', {
                                minutes: duration.minutes,
                            })}
                        </Text>
                        <ChecklistAction
                            label={t(adjusting ? 'common:close' : 'home:duration_adjust')}
                            onPress={() => setAdjusting((v) => !v)}
                        />
                    </View>
                    {adjusting ? (
                        <View className="flex-row flex-wrap mt-2">
                            {targetMinuteOptions(duration.minutes).map((min) => (
                                <View key={min} className="mr-2 mb-2">
                                    <TouchableOpacity
                                        onPress={() => {
                                            duration.onPick(min);
                                            setAdjusting(false);
                                        }}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: min === duration.minutes }}
                                        className="px-4 py-2 rounded-full"
                                        style={{
                                            backgroundColor: min === duration.minutes ? theme.accent : 'transparent',
                                            borderWidth: 1,
                                            borderColor: min === duration.minutes ? theme.accent : theme.border,
                                        }}
                                    >
                                        <Text
                                            style={{ color: min === duration.minutes ? theme.onAccent : theme.textPrimary, fontSize: 14 }}
                                            className="font-lexend"
                                        >
                                            {t('home:minutes_short', { minutes: min })}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

function ChecklistAction({ label, onPress }: { label: string; onPress: () => void }) {
    const theme = useAppTheme();
    return (
        <TouchableOpacity onPress={onPress} accessibilityRole="button" hitSlop={8} className="pl-3">
            <Text style={{ color: theme.accent, fontSize: 14 }} className="font-lexend-semibold">
                {label}
            </Text>
        </TouchableOpacity>
    );
}

/**
 * El plan que se está recorriendo, con las próximas semanas.
 *
 * Es la respuesta a "dónde voy" puesta al lado de "qué predico ahora". Y
 * muestra las que TODAVÍA NO ESTÁN ESCRITAS con su aviso: saltearlas dejaría
 * un plan que parece más corto de lo que es, y el domingo que viene no
 * desaparece porque el sermón no esté listo.
 */
function ActivePlan({ plan }: { plan: PlanBoard }) {
    const theme = useAppTheme();
    const router = useRouter();
    const { t } = useTranslation();

    const upcoming = plan.items.filter((item) => !item.preached).slice(0, 3);
    if (!upcoming.length) return null;

    return (
        <Card theme={theme} style={{ padding: 20, marginTop: 14 }}>
            <View className="flex-row items-center justify-between">
                <SectionLabel theme={theme}>
                    {t(plan.status === 'active' ? 'plans:active_plan' : 'plans:upcoming_plan')}
                </SectionLabel>
                <TouchableOpacity
                    onPress={() => router.push('/(tabs)/plans')}
                    accessibilityRole="button"
                >
                    <Text
                        style={{ color: theme.accent, fontSize: 13 }}
                        className="font-lexend-semibold"
                    >
                        {t('home:view_all')}
                    </Text>
                </TouchableOpacity>
            </View>

            <Text
                style={{ color: theme.textPrimary, fontSize: 18, lineHeight: 24, marginTop: 10 }}
                className="font-lexend-semibold"
                numberOfLines={2}
            >
                {plan.title}
            </Text>
            <Text
                style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}
                className="font-lexend"
            >
                {t('plans:preached_of_total', {
                    preached: plan.preachedCount,
                    total: plan.items.length,
                })}
            </Text>

            <View style={{ marginTop: 14 }}>
                {upcoming.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        disabled={!item.sermon}
                        onPress={() =>
                            item.sermon ? router.push(`/preach/${item.sermon.id}`) : undefined
                        }
                        accessibilityRole={item.sermon ? 'button' : undefined}
                        className="flex-row items-center py-2.5"
                        style={{ borderTopWidth: 1, borderTopColor: theme.border }}
                    >
                        <Text
                            style={{ color: theme.textMuted, fontSize: 12, width: 82 }}
                            className="font-lexend"
                        >
                            {t('plans:week', { week: item.week })}
                        </Text>
                        <Text
                            style={{ color: theme.textPrimary, fontSize: 14, flex: 1 }}
                            className="font-lexend"
                            numberOfLines={1}
                        >
                            {item.title}
                        </Text>
                        {item.ready ? (
                            <MaterialIcons
                                name="record-voice-over"
                                size={17}
                                color={theme.accent}
                            />
                        ) : (
                            <Text
                                style={{ color: theme.textMuted, fontSize: 11 }}
                                className="font-lexend"
                            >
                                {t('plans:not_written')}
                            </Text>
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        </Card>
    );
}

/** Tarjeta de apoyo: mismo alto, mismo encabezado, distinto contenido. */
function SupportCard({
    theme,
    label,
    icon,
    onPress,
    children,
}: {
    theme: AppTheme;
    label: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    onPress?: () => void;
    children: React.ReactNode;
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            activeOpacity={0.8}
            className="flex-1"
        >
            <Card theme={theme} style={{ padding: 18, minHeight: 132 }}>
                <View className="flex-row items-center">
                    <MaterialIcons name={icon} size={15} color={theme.textMuted} />
                    <SectionLabel theme={theme} style={{ marginLeft: 6 }}>
                        {label}
                    </SectionLabel>
                </View>
                <View className="mt-3">{children}</View>
            </Card>
        </TouchableOpacity>
    );
}

/** Dónde quedó la lectura. Vacía la primera vez, y eso también se dice. */
function ContinueReading() {
    const theme = useAppTheme();
    const router = useRouter();
    const { t } = useTranslation();
    const lastRead = useReaderSettingsStore((s) => s.lastRead);

    const repo = BibleVersionFactory.getByVersion(lastRead?.versionId ?? 'rvr1960');
    const book = lastRead ? repo?.getBooks().find((b) => b.id === lastRead.bookId) : undefined;

    return (
        <SupportCard
            theme={theme}
            label={t('home:continue_reading')}
            icon="auto-stories"
            onPress={() => router.push('/(tabs)/bible')}
        >
            <Text
                style={{ color: theme.textPrimary, fontSize: 20, lineHeight: 26 }}
                className="font-lexend-semibold"
            >
                {book ? `${book.name} ${lastRead?.chapter}` : t('home:open_bible')}
            </Text>
        </SupportCard>
    );
}

/**
 * Lo último que el pastor marcó en la Biblia.
 *
 * Es memoria de trabajo: lo que subrayó estudiando el martes es exactamente lo
 * que quiere reencontrar el sábado, y hasta ahora sólo aparecía si volvía a
 * abrir ese capítulo por su cuenta.
 */
function RecentMarks() {
    const theme = useAppTheme();
    const router = useRouter();
    const { t } = useTranslation();
    const { data: marks } = useBibleMarks();

    const repo = BibleVersionFactory.getByVersion('rvr1960');
    const latest = [...(marks?.values() ?? [])]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 3);

    return (
        <SupportCard
            theme={theme}
            label={t('home:recent_marks')}
            icon="bookmark-border"
            onPress={() => router.push('/(tabs)/bible')}
        >
            {latest.length === 0 ? (
                <Text
                    style={{ color: theme.textMuted, fontSize: 14, lineHeight: 20 }}
                    className="font-lexend"
                >
                    {t('home:no_marks')}
                </Text>
            ) : (
                latest.map((mark) => {
                    const book = repo?.getBooks().find((b) => b.id === mark.bookId);
                    return (
                        <Text
                            key={mark.id}
                            style={{ color: theme.textPrimary, fontSize: 15, marginBottom: 4 }}
                            className="font-lexend"
                        >
                            {book?.name ?? mark.bookId} {mark.chapter}:{mark.verse}
                        </Text>
                    );
                })
            )}
        </SupportCard>
    );
}

/**
 * En qué punto va la serie.
 *
 * Un pastor que predica una serie de ocho sobre Jonás quiere saber que va por
 * el tercero sin tener que contar la lista.
 */
function SeriesProgress({ title, sermons }: { title: string | null; sermons: SermonSummary[] }) {
    const theme = useAppTheme();
    const router = useRouter();
    const { t } = useTranslation();

    // Predicados, no publicados: contaba `publishedAt`, que en la lista de
    // publicados tienen todos — la serie salía siempre «N de N» (A6).
    const preached = sermons.filter((s) => s.timesPreached > 0).length;

    return (
        <SupportCard
            theme={theme}
            label={t('home:series_in_progress')}
            icon="layers"
            onPress={() => router.push('/(tabs)/sermons')}
        >
            <Text
                style={{ color: theme.textPrimary, fontSize: 16, lineHeight: 22 }}
                className="font-lexend-semibold"
                numberOfLines={2}
            >
                {title ?? ''}
            </Text>
            <Text
                style={{ color: theme.textMuted, fontSize: 13, marginTop: 6 }}
                className="font-lexend"
            >
                {t('home:of_total', { done: preached, total: sermons.length })}
            </Text>
        </SupportCard>
    );
}

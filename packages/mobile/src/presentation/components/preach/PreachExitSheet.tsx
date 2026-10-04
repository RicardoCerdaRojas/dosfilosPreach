import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RehearsalReport } from '@dosfilos/domain';

import { ReadingModeTokens } from '@/core/theme/readingModes';
import { useAddPreachingLog } from '@/presentation/hooks/useSermons';
import { useReaderSettingsStore } from '@/presentation/state/readerSettings.store';

interface Props {
    visible: boolean;
    tokens: ReadingModeTokens;
    report: RehearsalReport;
    sermonId: string;
    elapsedSeconds: number;
    onClose: () => void;
    onLeave: () => void;
}

const mmss = (seconds: number) => {
    const abs = Math.abs(Math.round(seconds));
    return `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
};

const signed = (seconds: number) => `${seconds > 0 ? '+' : seconds < 0 ? '−' : ''}${mmss(seconds)}`;

/**
 * Al bajar del púlpito (F3): qué pasó con el tiempo, y dejar constancia.
 *
 * DOS COSAS EN UNA PANTALLA, Y NINGUNA ES UN MODAL APURADO.
 *
 * Arriba, el informe del ensayo: cada movimiento con lo que TARDÓ contra lo
 * que tenía presupuestado. Es aritmética pura y ahí está todo el valor — el
 * pastor descubre que la introducción le comió doce de sus treinta y cinco
 * minutos. Nada se genera ni se sugiere: el juicio lo pone él.
 *
 * Abajo, el registro de la predicación, que alimenta `preachingHistory` — un
 * campo que existía en el dominio desde siempre y que ningún cliente llenaba.
 * La fecha y la duración vienen del cronómetro; el lugar y las notas, del
 * pastor. La web gana gratis el historial en el detalle del sermón.
 */
export function PreachExitSheet({
    visible,
    tokens,
    report,
    sermonId,
    elapsedSeconds,
    onClose,
    onLeave,
}: Props) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const addLog = useAddPreachingLog(sermonId);

    // El lugar del registro anterior: casi siempre se predica en el mismo.
    const lastPlace = useReaderSettingsStore((s) => s.lastPreachingPlace);
    const setLastPlace = useReaderSettingsStore((s) => s.setLastPreachingPlace);
    const [location, setLocation] = useState(lastPlace);
    const [notes, setNotes] = useState('');

    /**
     * Salir del atril MARCA el sermón como predicado.
     *
     * Antes el registro dependía de que el pastor escribiera el lugar, así que
     * quien salía sin escribir nada dejaba el sermón como no predicado — y no
     * había ninguna otra forma de marcarlo. El lugar y las notas siguen siendo
     * opcionales: son detalle del registro, no la condición para que exista.
     */
    const saveAndLeave = () => {
        if (location.trim()) setLastPlace(location.trim());
        addLog.mutate({
            date: new Date(),
            location: location.trim(),
            durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
        onLeave();
    };

    return (
        <Modal visible={visible} transparent animationType={tokens.animations ? 'slide' : 'none'} onRequestClose={onClose}>
            <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
                <Pressable
                    className="rounded-t-3xl px-7 pt-6"
                    style={{
                        backgroundColor: tokens.surface,
                        paddingBottom: insets.bottom + 20,
                        maxHeight: '88%',
                    }}
                    onPress={() => undefined}
                >
                    <Text
                        style={{ color: tokens.textPrimary }}
                        className="font-lexend-semibold text-xl mb-1"
                    >
                        {t('preach:exit_title')}
                    </Text>
                    <Text
                        style={{ color: tokens.textSecondary }}
                        className="font-lexend text-sm mb-5"
                    >
                        {t('preach:exit_total', {
                            actual: mmss(report.totalActual),
                            budget: mmss(report.totalBudget),
                        })}
                    </Text>

                    <ScrollView keyboardShouldPersistTaps="handled">
                        {report.rows.map((row) => (
                            <View
                                key={row.slug}
                                className="flex-row items-center py-2 border-b"
                                style={{ borderBottomColor: tokens.border }}
                            >
                                <Text
                                    numberOfLines={1}
                                    style={{ color: tokens.textPrimary, flex: 1 }}
                                    className="font-lexend text-sm"
                                >
                                    {row.title}
                                </Text>
                                <Text
                                    style={{
                                        color: tokens.textSecondary,
                                        width: 62,
                                        textAlign: 'right',
                                        fontVariant: ['tabular-nums'],
                                    }}
                                    className="font-lexend text-sm"
                                >
                                    {mmss(row.actualSeconds)}
                                </Text>
                                <Text
                                    style={{
                                        color: row.overweight ? tokens.timerOver : tokens.textSecondary,
                                        width: 72,
                                        textAlign: 'right',
                                        fontVariant: ['tabular-nums'],
                                    }}
                                    className="font-lexend-semibold text-sm"
                                >
                                    {signed(row.driftSeconds)}
                                </Text>
                            </View>
                        ))}

                        <Text
                            style={{ color: tokens.textSecondary }}
                            className="font-lexend-semibold text-xs uppercase tracking-widest mt-7 mb-2"
                        >
                            {t('preach:log_title')}
                        </Text>
                        <TextInput
                            value={location}
                            onChangeText={setLocation}
                            placeholder={t('preach:log_place')}
                            placeholderTextColor={tokens.textSecondary}
                            style={{
                                color: tokens.textPrimary,
                                borderColor: tokens.border,
                                borderWidth: 1,
                                borderRadius: 10,
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                            }}
                            className="font-lexend text-base"
                        />
                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder={t('preach:log_notes')}
                            placeholderTextColor={tokens.textSecondary}
                            multiline
                            textAlignVertical="top"
                            style={{
                                color: tokens.textPrimary,
                                borderColor: tokens.border,
                                borderWidth: 1,
                                borderRadius: 10,
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                minHeight: 88,
                                marginTop: 10,
                            }}
                            className="font-lexend text-base"
                        />
                        <Text
                            style={{ color: tokens.textSecondary }}
                            className="font-lexend text-xs mt-2"
                        >
                            {t('preach:log_hint')}
                        </Text>
                    </ScrollView>

                    <View className="flex-row mt-5">
                        <TouchableOpacity
                            onPress={onLeave}
                            accessibilityRole="button"
                            accessibilityLabel={t('preach:exit_without_log')}
                            className="flex-1 py-3 rounded-full items-center mr-3"
                            style={{ borderWidth: 1, borderColor: tokens.border }}
                        >
                            <Text
                                style={{ color: tokens.textSecondary }}
                                className="font-lexend text-base"
                            >
                                {t('preach:exit_without_log')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            // El lugar es opcional: el comentario de arriba lo
                            // decía y el botón lo exigía (A5).
                            onPress={saveAndLeave}
                            accessibilityRole="button"
                            accessibilityLabel={t('preach:log_save')}
                            className="flex-1 py-3 rounded-full items-center"
                            style={{
                                backgroundColor: tokens.accent,
                            }}
                        >
                            <Text
                                style={{ color: tokens.background }}
                                className="font-lexend-semibold text-base"
                            >
                                {t('preach:log_save')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

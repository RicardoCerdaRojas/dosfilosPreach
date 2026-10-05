import React from 'react';
import { Text, View } from 'react-native';
import { expectedElapsed, totalBudget } from '@dosfilos/domain';
import type { MovementBudget } from '@dosfilos/domain';

import { useTranslation } from 'react-i18next';

import { ReadingModeTokens } from '@/core/theme/readingModes';
import { formatWallTime } from '@/core/utils/wallTime';

interface Props {
    tokens: ReadingModeTokens;
    budgets: MovementBudget[];
    elapsedSeconds: number;
    readingIndex: number;
    pageIndex: number;
    pageCount: number;
    /** Muestra «página / total». En el documento continuo no hay páginas que contar. */
    showPages?: boolean;
    /** Cronómetro detenido: el reloj se muestra apagado, no en blanco. */
    running: boolean;
    /**
     * Con números o sólo la marca.
     *
     * Predicando, una cifra pide ser leída y leerla cuesta atención. El
     * predicador que ya sabe dónde va sólo necesita ver la marca moverse — y
     * el que quiere el dato exacto lo enciende.
     */
    numbers: boolean;
    /** Hora de término (C7): «hasta las 11:45» junto a lo que queda. */
    endAt?: number | null;
}

/** mm:ss, con signo cuando el número es un desfase. */
function clock(seconds: number, signed = false): string {
    const value = Math.abs(Math.round(seconds));
    const mm = Math.floor(value / 60);
    const ss = value % 60;
    const body = `${mm}:${String(ss).padStart(2, '0')}`;
    if (!signed) return body;
    return `${seconds < 0 ? '−' : '+'}${body}`;
}

/**
 * La línea de vuelo: el estado del sermón en una franja de dos renglones.
 *
 * POR QUÉ EXISTE. El reloj y el avance vivían SÓLO dentro del tablero, así que
 * apagar el tablero dejaba al predicador sin la hora y sin saber por dónde va
 * — con un play y una pausa por toda información. El instrumento que no se
 * puede apagar es el que hay que poder mirar de reojo.
 *
 * QUÉ MUESTRA, Y POR QUÉ ESOS TRES NÚMEROS:
 *
 * 1. LO QUE QUEDA DEL TOTAL. Es la restricción dura del culto: nadie se pasa
 *    "del movimiento", se pasa de la hora. En rojo cuando ya se pasó.
 * 2. EL DESFASE contra el plan en este punto del texto. Es el único número
 *    ACCIONABLE: "+2:10" significa recortar; "−1:30", que hay aire. Sale de
 *    comparar el reloj con lo que el presupuesto esperaba a esta altura.
 * 3. DÓNDE VA: movimiento y página.
 *
 * Y abajo, dos marcas sobre la misma línea: dónde está en el TEXTO y dónde
 * está en el TIEMPO. Verlas separarse es ver el problema antes de que sea uno.
 */
export function PreachStatusBar({
    tokens,
    budgets,
    elapsedSeconds,
    readingIndex,
    pageIndex,
    pageCount,
    showPages = true,
    running,
    numbers,
    endAt = null,
}: Props) {
    const { t } = useTranslation();
    const total = totalBudget(budgets);
    const remaining = total - elapsedSeconds;
    const over = remaining < 0;

    const expected = expectedElapsed(budgets, readingIndex, pageIndex, pageCount);
    const drift = elapsedSeconds - expected;
    // Medio minuto no es ir tarde: es hablar. El aviso empieza donde el
    // predicador podría hacer algo al respecto.
    const behind = drift > 30;
    const ahead = drift < -30;

    const timeRatio = total > 0 ? Math.min(1, Math.max(0, elapsedSeconds / total)) : 0;
    const textRatio = total > 0 ? Math.min(1, Math.max(0, expected / total)) : 0;

    const movement = budgets[Math.min(readingIndex, budgets.length - 1)];

    return (
        <View
            style={{
                paddingHorizontal: 22,
                paddingBottom: 6,
                opacity: running ? 1 : 0.55,
            }}
        >
            {numbers ? (
            <View className="flex-row items-baseline">
                <Text
                    style={{
                        color: over ? tokens.timerOver : tokens.textPrimary,
                        fontSize: 15,
                        fontVariant: ['tabular-nums'],
                    }}
                    className="font-lexend-semibold"
                >
                    {over ? `−${clock(remaining)}` : clock(remaining)}
                </Text>

                {endAt !== null ? (
                    <Text
                        style={{ color: tokens.textSecondary, fontSize: 13, marginLeft: 6, fontVariant: ['tabular-nums'] }}
                        className="font-lexend"
                    >
                        {t('preach:end_time_until', { time: formatWallTime(endAt) })}
                    </Text>
                ) : null}

                {behind || ahead ? (
                    <Text
                        style={{
                            color: behind ? tokens.timerOver : tokens.timerOk,
                            fontSize: 13,
                            marginLeft: 10,
                            fontVariant: ['tabular-nums'],
                        }}
                        className="font-lexend-semibold"
                    >
                        {clock(drift, true)}
                    </Text>
                ) : null}

                <Text
                    style={{ color: tokens.textSecondary, fontSize: 13, marginLeft: 12, flex: 1 }}
                    numberOfLines={1}
                    className="font-lexend"
                >
                    {movement?.title ?? ''}
                </Text>

                <Text
                    style={{
                        color: tokens.textSecondary,
                        fontSize: 13,
                        fontVariant: ['tabular-nums'],
                    }}
                    className="font-lexend"
                >
                    {showPages ? `${pageIndex + 1}/${pageCount}` : null}
                </Text>
            </View>
            ) : null}

            {/* Dos marcas sobre la misma línea: el texto y el reloj. */}
            <View
                style={{
                    height: 3,
                    marginTop: numbers ? 5 : 3,
                    borderRadius: 2,
                    backgroundColor: tokens.border,
                }}
            >
                <View
                    style={{
                        position: 'absolute',
                        left: 0,
                        width: `${textRatio * 100}%`,
                        height: 3,
                        borderRadius: 2,
                        backgroundColor: tokens.accent,
                    }}
                />
                <View
                    style={{
                        position: 'absolute',
                        left: `${timeRatio * 100}%`,
                        width: 2,
                        height: 9,
                        top: -3,
                        backgroundColor: over ? tokens.timerOver : tokens.textPrimary,
                    }}
                />
            </View>
        </View>
    );
}

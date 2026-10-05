import React from 'react';
import { Text, View } from 'react-native';
import type { MovementBudget } from '@dosfilos/domain';
import { totalBudget } from '@dosfilos/domain';

import { ReadingModeTokens } from '@/core/theme/readingModes';
import { TYPE_SCALE } from '@/core/theme/typography';

interface Props {
    tokens: ReadingModeTokens;
    fontSize: number;
    budgets: MovementBudget[];
    elapsedSeconds: number;
    /** Movimiento que se está LEYENDO (puede no ser el que dicta el reloj). */
    readingIndex: number;
    /** Página dentro del movimiento, para el punto de avance fino. */
    pageIndex: number;
    pageCount: number;
    /** Muestra «página / total». En el documento continuo no hay páginas que contar. */
    showPages?: boolean;
    height: number;
    /** Con reloj y título, o sólo el riel de movimientos. */
    numbers: boolean;
}

const formatTime = (seconds: number): string => {
    const abs = Math.abs(Math.round(seconds));
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return `${seconds < 0 ? '+' : ''}${m}:${String(s).padStart(2, '0')}`;
};

/**
 * El tercio inferior de la pantalla (P7).
 *
 * La técnica de atril reserva el tercio de abajo porque leerlo obliga a bajar
 * el mentón y la cara sale de la congregación — en una tablet además es el
 * ángulo más lavado del LCD. En papel ese tercio se pierde; acá se convierte
 * en el tablero, con los dos datos que se consultan de reojo y que hoy están
 * mal ubicados: el timer (D5) y el avance (D2).
 *
 * EL RIEL responde una sola pregunta: ¿voy a tiempo? Cada segmento es un
 * movimiento y su ancho es su PRESUPUESTO DE TIEMPO, no su cantidad de texto.
 * El cursor es el reloj real. Si el cursor pasa el final del segmento que
 * estás predicando, vas tarde — y se ve sin leer un número.
 *
 * El estado se distingue por FORMA además de por color (borde grueso, cursor,
 * relleno), para que siga funcionando en tinta electrónica, donde el color no
 * existe.
 */
export function PreachInstrumentPanel({
    tokens,
    fontSize,
    budgets,
    elapsedSeconds,
    readingIndex,
    pageIndex,
    pageCount,
    showPages = true,
    height,
    numbers,
}: Props) {
    const total = totalBudget(budgets);

    // El veredicto se mide contra el movimiento que se está LEYENDO: lo que
    // importa no es dónde debería estar el reloj, sino cuánto le queda a este
    // movimiento según el presupuesto.
    const reading = budgets[readingIndex];
    const endsAtReading = budgets
        .slice(0, readingIndex + 1)
        .reduce((sum, b) => sum + b.seconds, 0);
    const remaining = endsAtReading - elapsedSeconds;
    const late = remaining < 0;

    const timerColor = late
        ? tokens.timerOver
        : remaining < (reading?.seconds ?? 0) * 0.2
          ? tokens.timerWarn
          : tokens.timerOk;

    return (
        <View
            style={{
                height,
                borderTopWidth: 1,
                borderTopColor: tokens.border,
                paddingHorizontal: 28,
                paddingTop: fontSize * 0.5,
                justifyContent: 'center',
            }}
        >
            {numbers ? (
            <View className="flex-row items-baseline">
                <Text
                    style={{
                        color: timerColor,
                        fontSize: fontSize * TYPE_SCALE.timer,
                        fontVariant: ['tabular-nums'],
                    }}
                    className="font-lexend-semibold"
                >
                    {formatTime(remaining)}
                </Text>
                <Text
                    style={{
                        color: tokens.textSecondary,
                        fontSize: fontSize * 0.5,
                        marginLeft: fontSize * 0.5,
                        flex: 1,
                    }}
                    numberOfLines={1}
                    className="font-lexend"
                >
                    {reading?.title ?? ''}
                </Text>
                <Text
                    style={{
                        color: tokens.textSecondary,
                        fontSize: fontSize * 0.5,
                        fontVariant: ['tabular-nums'],
                    }}
                    className="font-lexend"
                >
                    {showPages ? `${pageIndex + 1}/${pageCount}` : null}
                </Text>
            </View>

            ) : null}

            {/* Riel: un segmento por movimiento, ancho = presupuesto, y cada
                uno SE LLENA con el reloj.

                El relleno lo manda el TIEMPO, no la posición de lectura: es el
                reloj el que avanza solo. Y por eso el riel dice algo sin
                números — el segmento que se está leyendo lleva borde, así que
                si el relleno va más adelante que el borde, el predicador va
                tarde. Ver esa distancia es el instrumento; el resto es
                decoración. */}
            <View
                className="flex-row"
                style={{ height: 14, marginTop: numbers ? fontSize * 0.45 : 0 }}
            >
                {budgets.map((budget, index) => {
                    const isReading = index === readingIndex;
                    const startsAt = budgets
                        .slice(0, index)
                        .reduce((sum, b) => sum + b.seconds, 0);
                    // Cuánto del presupuesto de ESTE movimiento ya consumió el
                    // reloj: 0 antes de llegar, 1 una vez pasado.
                    const filled = Math.min(
                        1,
                        Math.max(0, (elapsedSeconds - startsAt) / Math.max(1, budget.seconds)),
                    );
                    return (
                        <View
                            key={budget.slug}
                            style={{
                                flex: budget.seconds,
                                marginRight: index === budgets.length - 1 ? 0 : 3,
                                borderRadius: 2,
                                borderWidth: isReading ? 2 : 1,
                                borderColor: isReading
                                    ? late
                                        ? tokens.timerOver
                                        : tokens.accent
                                    : tokens.border,
                                overflow: 'hidden',
                            }}
                        >
                            <View
                                style={{
                                    width: `${filled * 100}%`,
                                    height: '100%',
                                    backgroundColor:
                                        // El movimiento que se está leyendo se
                                        // llena con el acento; los ya pasados,
                                        // con el gris del borde: cumplido no es
                                        // lo mismo que en curso.
                                        isReading
                                            ? late
                                                ? tokens.timerOver
                                                : tokens.accent
                                            : tokens.border,
                                }}
                            />
                        </View>
                    );
                })}
            </View>

            {/* El nombre de cada movimiento bajo su segmento.

                Sin ellos el riel muestra proporciones de nada: el pastor ve
                que el tercer bloque es el más ancho y no sabe cuál es. Van
                recortados a un renglón —un segmento de un sexto de pantalla no
                da para más— y eso alcanza, porque el pastor reconoce sus
                propios movimientos por las primeras palabras.

                Sólo con números: en modo "sólo la marca" el riel existe
                justamente para no tener texto que leer. */}
            {numbers ? (
                <View className="flex-row" style={{ marginTop: 4 }}>
                    {budgets.map((budget, index) => (
                        <View
                            key={`${budget.slug}-label`}
                            style={{
                                flex: budget.seconds,
                                marginRight: index === budgets.length - 1 ? 0 : 3,
                            }}
                        >
                            <Text
                                numberOfLines={1}
                                style={{
                                    color:
                                        index === readingIndex
                                            ? tokens.textPrimary
                                            : tokens.textSecondary,
                                    fontSize: Math.max(9, fontSize * 0.34),
                                }}
                                className={
                                    index === readingIndex ? 'font-lexend-semibold' : 'font-lexend'
                                }
                            >
                                {budget.title}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}

            {/* Cursor del reloj sobre el riel, en escala del total. Sigue
                estando aunque el relleno diga casi lo mismo: el relleno dice
                cuánto se consumió de cada movimiento y el cursor dice dónde
                está el reloj en el sermón entero. */}
            <View style={{ height: 8, marginTop: 2 }}>
                <View
                    style={{
                        position: 'absolute',
                        left: `${Math.min(100, total > 0 ? (elapsedSeconds / total) * 100 : 0)}%`,
                        width: 2,
                        height: 8,
                        backgroundColor: late ? tokens.timerOver : tokens.textPrimary,
                    }}
                />
            </View>
        </View>
    );
}

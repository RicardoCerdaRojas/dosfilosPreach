import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ReadingModeTokens } from '@/core/theme/readingModes';
import { FACE_CLASS, type DeliveryFace } from '@/core/theme/typography';
import type { ReadingPassage } from '@/data/repositories/bible/BibleVersionFactory';

interface Props {
    passage: ReadingPassage;
    tokens: ReadingModeTokens;
    fontSize: number;
    face: DeliveryFace;
    /** Toques sobre el texto: pasan página igual que en el sermón. */
    onTapAt: (pageX: number) => void;
}

/**
 * La lectura pública del texto, antes del primer movimiento (C7).
 *
 * Antes de predicar se lee el pasaje, y el pastor tenía que salir del sermón,
 * abrir la Biblia y buscarlo con la congregación esperando. Acá está a cuerpo
 * de púlpito, en la familia que eligió para predicar, con los números de
 * versículo discretos: se leen en voz alta los versículos, no los números.
 * Un toque a la derecha pasa al sermón.
 */
export function PreachReadingPage({ passage, tokens, fontSize, face, onTapAt }: Props) {
    const { t } = useTranslation();
    const lineHeight = fontSize * 1.45;
    return (
        <View>
            <Text
                style={{ color: tokens.textSecondary, fontSize: fontSize * 0.55, letterSpacing: 2 }}
                className="font-lexend-semibold uppercase"
            >
                {t('preach:reading_label')}
            </Text>
            <Text
                style={{ color: tokens.textPrimary, fontSize: Math.min(fontSize * 1.3, 44), marginTop: fontSize * 0.2, marginBottom: fontSize * 0.7 }}
                className="font-lexend-bold"
            >
                {passage.title}
            </Text>
            <Text
                onPress={(e) => onTapAt(e.nativeEvent.pageX)}
                suppressHighlighting
                style={{ color: tokens.textPrimary, fontSize, lineHeight }}
                className={FACE_CLASS[face].regular}
            >
                {passage.verses.map((verse) => (
                    <Text key={verse.number}>
                        <Text
                            style={{ color: tokens.textSecondary, fontSize: fontSize * 0.55 }}
                            className="font-lexend-semibold"
                        >
                            {`${verse.number} `}
                        </Text>
                        {`${verse.text} `}
                    </Text>
                ))}
            </Text>
        </View>
    );
}

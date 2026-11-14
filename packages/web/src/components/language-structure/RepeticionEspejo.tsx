import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { MIRROR_SOURCES, type MirrorPosition, type RuleSource } from '@dosfilos/domain';
import { SourceNote } from './SourceNote';
import { FichaCaja } from '@/components/word-ficha/FichaPiezas';

/** La repetición en espejo vista desde una de sus cuatro palabras (griego y hebreo). */
export interface MirrorView {
    readonly position: MirrorPosition;
    readonly a: string;
    readonly b: string;
    readonly b2: string;
    readonly a2: string;
    readonly sources?: readonly RuleSource[];
}

const MARCA = (k: string) => `\u0001${k}\u0001`;

/**
 * Una frase traducida con las cuatro palabras del espejo dentro, cada una en su escritura: el hebreo con
 * `font-hebrew` (los acentos necesitan Ezra SIL; revisión adversarial) y aislado de la dirección del texto
 * (`bdi`). El texto traducido sigue siendo uno solo, con sus marcadores {{a}}, {{b}}, {{b2}}, {{a2}}.
 */
export function fraseConPalabras(
    t: TFunction, clave: string, palabras: { a: string; b: string; b2: string; a2: string }, lang: 'gr' | 'he', extra: Record<string, string> = {},
): React.ReactNode {
    const texto = t(clave, { ...extra, a: MARCA('a'), b: MARCA('b'), b2: MARCA('b2'), a2: MARCA('a2') }) as string;
    return texto.split('\u0001').map((trozo, k) => {
        if (k % 2 === 0) return trozo;
        const w = palabras[trozo as keyof typeof palabras] ?? trozo;
        return lang === 'he'
            ? <bdi key={k} lang="he" dir="rtl" className="font-hebrew text-[1.15em]">{w}</bdi>
            : <bdi key={k} lang="grc">{w}</bdi>;
    });
}

/**
 * El bloque de la ficha (revisión del profesor, Stg 2:18; en hebreo desde los pendientes, 2026-11-13): la letra de
 * la palabra en el espejo, las cuatro palabras y que es un DATO (puede ser un quiasmo), con su fuente.
 */
export function RepeticionEspejo({ m, lang = 'gr' }: { m: MirrorView; lang?: 'gr' | 'he' }) {
    const { t } = useTranslation('languageStructure');
    return (
        <FichaCaja titulo={t('mirrorFicha.title')} pie={<SourceNote sources={m.sources ?? MIRROR_SOURCES} />} testId="repeticion-espejo">
            <p className="m-0 text-[13.5px] leading-relaxed">
                {fraseConPalabras(t, 'mirrorFicha.position', m, lang, { pos: t(`mirrorLetter.${m.position}`) })}
            </p>
            <p className="m-0 mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{t('mirrorFicha.note')}</p>
        </FichaCaja>
    );
}

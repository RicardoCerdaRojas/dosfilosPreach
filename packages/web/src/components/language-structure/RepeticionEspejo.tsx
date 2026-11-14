import { useTranslation } from 'react-i18next';
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

/**
 * El bloque de la ficha (revisión del profesor, Stg 2:18; en hebreo desde los pendientes, 2026-11-13): la letra de
 * la palabra en el espejo, las cuatro palabras y que es un DATO (puede ser un quiasmo), con su fuente.
 */
export function RepeticionEspejo({ m }: { m: MirrorView }) {
    const { t } = useTranslation('languageStructure');
    return (
        <FichaCaja titulo={t('mirrorFicha.title')} pie={<SourceNote sources={m.sources ?? MIRROR_SOURCES} />} testId="repeticion-espejo">
            <p className="m-0 text-[13.5px] leading-relaxed">
                {t('mirrorFicha.position', { pos: t(`mirrorLetter.${m.position}`), a: m.a, b: m.b, b2: m.b2, a2: m.a2 })}
            </p>
            <p className="m-0 mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{t('mirrorFicha.note')}</p>
        </FichaCaja>
    );
}

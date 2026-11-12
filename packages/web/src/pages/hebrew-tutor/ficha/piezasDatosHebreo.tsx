import { useTranslation } from 'react-i18next';
import { HEBREW_ROLES_SHOWN, HEBREW_WORD_DATA_SOURCES, hebrewRoleConflict } from '@dosfilos/domain';
import { SourceNote } from '@/components/language-structure/SourceNote';
import { FichaCaja, FichaFuncion } from '@/components/word-ficha/FichaPiezas';
import { he, type DatosHebreo } from './piezasHebreo';

/** U4 (revisión del profesor, Rut 3:6 הַגֹּרֶן): el rol de MACULA y el antecedente del artículo, como datos de la ficha. */
/**
 * La función que escribió el asistente, con el rol de la palabra según MACULA
 * debajo (U4): en Rut 3:6 el análisis decía «objeto directo» y el dato decía
 * complemento adverbial («descendió a la era»). Si chocan, se avisa.
 */
export function FuncionSintactica({ d }: { d: DatosHebreo }) {
    const { t } = useTranslation('hebrewTutor');
    const rol = d.role && HEBREW_ROLES_SHOWN.has(d.role) ? d.role : undefined;
    const choca = hebrewRoleConflict(rol, d.word.syntacticFunction);
    const nombreRol = rol ? t(`verseAnalyzer.ficha.role.${rol}`) : '';
    return (
        <FichaFuncion
            origen="asistente"
            texto={d.word.syntacticFunction}
            testId="ficha-funcion"
            {...(rol === 'adv' ? { fuentes: HEBREW_WORD_DATA_SOURCES.roleAdverbial } : {})}
            extra={rol ? (
                <>
                    <dt className="text-muted-foreground">{t('verseAnalyzer.ficha.role.label')}</dt>
                    <dd className="m-0" data-testid="ficha-rol-macula">
                        {nombreRol}
                        {choca && <span className="mt-1 block font-semibold text-warning-subtle-foreground" data-testid="ficha-rol-choque">{t('verseAnalyzer.ficha.role.conflict', { role: nombreRol })}</span>}
                        {choca && rol === 'adv' && <span className="mt-1 block text-muted-foreground">{t('verseAnalyzer.ficha.role.adverbialHint')}</span>}
                    </dd>
                </>
            ) : undefined}
        />
    );
}

/** El mismo sustantivo ya se nombró poco antes: el artículo puede retomarlo (Putnam §1.4.3a). */
export function ArticuloAntecedente({ d }: { d: DatosHebreo }) {
    const { t } = useTranslation('hebrewTutor');
    const a = d.article!;
    return (
        <FichaCaja titulo={t('verseAnalyzer.ficha.article.title')} pie={<SourceNote sources={HEBREW_WORD_DATA_SOURCES.articleAntecedent} />} testId="ficha-articulo">
            <p className="m-0 text-[13.5px] leading-relaxed">
                {he(a.antecedent.text)}{' '}
                {a.sameVerse
                    ? t('verseAnalyzer.ficha.article.seenSameVerse')
                    : t('verseAnalyzer.ficha.article.seenBefore', { verse: a.antecedent.verse })}
            </p>
        </FichaCaja>
    );
}

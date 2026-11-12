import { useTranslation } from 'react-i18next';
import { louwNidaSenses, louwNidaSources, SAME_LEMMA_SOURCES, SECTION_OPENING_SOURCES } from '@dosfilos/domain';
import { SourceNote } from '@/components/language-structure/SourceNote';
import { FichaCaja } from '@/components/word-ficha/FichaPiezas';
import type { DatosGriego } from './piezasGriego';

/**
 * U3c (revisión del profesor, Stg 2:10 «ἐν ἑνί»): el sentido de la preposición EN ESTE VERSÍCULO según
 * Louw-Nida, tal como lo da MACULA (89.5 → Relaciones › especificación: «con respecto a»). Es un dato:
 * con dos códigos («89.25 89.77», Stg 2:21), MACULA deja abiertas las dos lecturas y así se muestran.
 */
export function SentidoLouwNida({ d }: { d: DatosGriego }) {
    const { t, i18n } = useTranslation('greekTutor');
    const sentidos = louwNidaSenses(d.ln);
    const en = (i18n?.language ?? 'es').startsWith('en');
    return (
        <FichaCaja
            titulo={t('analyzer.louwNida.title')}
            pie={<SourceNote sources={sentidos.flatMap(louwNidaSources)} />}
            testId="louw-nida"
        >
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13.5px] leading-relaxed">
                {sentidos.map(s => (
                    <li key={s.code} data-testid="louw-nida-sentido">
                        <span className="font-mono text-[12px] text-muted-foreground">{s.code}</span>{' '}
                        <strong className="font-semibold">{en ? s.domain.en : s.domain.es}</strong>
                        {s.subdomain && <> › {en ? s.subdomain.en : s.subdomain.es}</>}
                    </li>
                ))}
            </ul>
            <p className="m-0 mt-1.5 text-[12.5px] leading-snug text-muted-foreground">
                {t(sentidos.length > 1 ? 'analyzer.louwNida.twoReadings' : 'analyzer.louwNida.note')}
            </p>
        </FichaCaja>
    );
}

/**
 * U9 (revisión del profesor, Stg 3:1 «Μὴ πολλοὶ διδάσκαλοι γίνεσθε, ἀδελφοί μου»): el vocativo al comienzo,
 * con un imperativo o una pregunta, suele abrir una unidad nueva en las cartas. Es una señal (23 de 29 medido):
 * la ficha lo dice así y pide confirmarlo con el contenido.
 */
export function AperturaSeccion({ d }: { d: DatosGriego }) {
    const { t } = useTranslation('greekTutor');
    const o = d.opening!;
    return (
        <FichaCaja titulo={t('analyzer.opening.title')} pie={<SourceNote sources={SECTION_OPENING_SOURCES} />} testId="apertura-seccion">
            <p className="m-0 text-[13.5px] leading-relaxed">
                {o.imperative ? t('analyzer.opening.withImperative', { imp: o.imperative }) : t('analyzer.opening.withQuestion')}
            </p>
            <p className="m-0 mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{t('analyzer.opening.note')}</p>
        </FichaCaja>
    );
}

/**
 * U10 (revisión del profesor, Stg 3:5 «ἡλίκον πῦρ ἡλίκην ὕλην»): el mismo lema otra vez en el versículo, con otra
 * glosa en contexto según MACULA (ἡλίκον «small», ἡλίκην «how great»). Es un dato: a veces es un sentido distinto,
 * a veces un sinónimo («now» / «already»), y la ficha lo dice así. Junto a cada glosa, la traducción del análisis,
 * para que se vea si las dos apariciones se tradujeron igual.
 */
export function MismoLema({ d }: { d: DatosGriego }) {
    const { t } = useTranslation('greekTutor');
    return (
        <FichaCaja titulo={t('analyzer.sameLemma.title')} pie={<SourceNote sources={SAME_LEMMA_SOURCES} />} testId="mismo-lema">
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13.5px] leading-relaxed">
                {d.sameLemma!.map((w, k) => (
                    <li key={k} data-testid="mismo-lema-aparicion" className={w.self ? 'font-semibold' : undefined}>
                        <span lang="grc">{w.text}</span>
                        {w.translation && <> — «{w.translation}»</>}{' '}
                        <span className="text-[12px] font-normal text-muted-foreground">({t('analyzer.sameLemma.gloss', { gloss: w.gloss })})</span>
                    </li>
                ))}
            </ul>
            <p className="m-0 mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{t('analyzer.sameLemma.note')}</p>
        </FichaCaja>
    );
}

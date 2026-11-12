import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { STRUCTURE_RULE_SOURCES, type WordAnalysis } from '@dosfilos/domain';
import { ArticuloAntecedente, FuncionSintactica } from './piezasDatosHebreo';
import { VerboCompleto, VerboCorto } from './piezasVerboHebreo';
import { FrontedNote } from '@/components/language-structure/FrontedNote';
import type { FichaRegistro } from '@/components/word-ficha/fichaRegistro';
import { FichaCaja, FichaCeldas, FichaFilas, FichaFuncion, FichaOrigenRotulo, FichaPistas } from '@/components/word-ficha/FichaPiezas';
import { SpeechNote } from '../components/SpeechNote';
import { MorphemeSpan } from '../components/MorphemeSpan';
import { OshbValidationBadge } from '../components/OshbValidationBadge';
import { OshbCorrectionsList } from '../components/OshbCorrectionsList';
import {
    Categoria, DetectiveVerbo, esApertura, esDebil, Explicacion, funcionDeRegla, he, InfinitivoCompleto, InfinitivoCorto, Insignia,
    investigable, KiCompleto, KiCorto, LineaForma, Morfemas, nm, ParticipioCompleto, ParticipioCorto, traduccion, useCeldas, vm,
    type DatosHebreo,
} from './piezasHebreo';

export type { DatosHebreo } from './piezasHebreo';

/**
 * LA FICHA DE UNA PALABRA HEBREA: sus bloques, en el orden de lectura.
 * Reúne lo que antes estaba repartido en la tarjeta (`WordCard`), el tooltip
 * (`WordTooltipContent`) y el panel «Tutor interactivo» (`WordTutorSheet`).
 * La tabla de destino (`docs/FICHA_DE_PALABRA.md`) sale de esta lista.
 */
export const BLOQUES_HEBREO: FichaRegistro<DatosHebreo> = [
    // ENCABEZADO
    {
        id: 'he.palabra', dato: 'La palabra (con morfemas en color) y su transliteración', seccion: 'encabezado', lugar: 'titulo', origen: 'datos', antes: ['tarjeta', 'tooltip', 'panel'],
        hay: () => true,
        Completo: ({ d }) => (
            <>
                <span dir="rtl" lang="he" className="font-hebrew text-5xl leading-tight" style={{ fontFeatureSettings: '"mark" 1, "mkmk" 1' }}>
                    {d.word.morphemes?.length ? <MorphemeSpan segments={d.word.morphemes} variant="text" /> : d.word.hebrewText}
                </span>
                {d.word.transliteration && <span className="text-sm italic text-muted-foreground">{d.word.transliteration}</span>}
            </>
        ),
        Corto: ({ d }) => (
            <>
                <span dir="rtl" lang="he" className="font-hebrew text-3xl leading-tight" style={{ fontFeatureSettings: '"mark" 1, "mkmk" 1' }}>{d.word.hebrewText}</span>
                {d.word.transliteration && <span className="text-xs italic text-muted-foreground">{d.word.transliteration}</span>}
            </>
        ),
    },
    {
        id: 'he.categoria', dato: 'Categoría (con su color; sin categoría, «partícula»)', seccion: 'encabezado', lugar: 'insignia', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: () => true, Completo: Categoria, Corto: Categoria,
    },
    {
        id: 'he.verboDebil', dato: '«Verbo débil»', seccion: 'encabezado', lugar: 'insignia', origen: 'asistente', antes: ['tarjeta'],
        hay: esDebil,
        Completo: function Debil() { const { t } = useTranslation('hebrewTutor'); return <Insignia tono="destructive">{t('verseAnalyzer.ficha.weakVerb')}</Insignia>; },
    },
    {
        id: 'he.apertura', dato: '«Apertura» narrativa (וַיְהִי)', seccion: 'encabezado', lugar: 'insignia', origen: 'regla', antes: ['tarjeta'],
        hay: esApertura,
        Completo: function Apertura() { const { t } = useTranslation('hebrewTutor'); return <Insignia tono="warning" title={t('verseAnalyzer.ficha.openingTitle')}>{t('verseAnalyzer.ficha.opening')}</Insignia>; },
    },
    {
        id: 'he.oshb', dato: 'Sello de validación con OSHB (al tocarlo, código y correcciones)', seccion: 'encabezado', lugar: 'insignia', origen: 'datos', antes: ['tarjeta'],
        hay: (d) => !!d.word.oshbReference,
        Completo: ({ d }) => <OshbValidationBadge oshb={d.word.oshbReference} />,
    },
    {
        id: 'he.traduccion', dato: 'Traducción en contexto (con respaldo: glosa, raíz…)', seccion: 'encabezado', lugar: 'traduccion', origen: 'asistente', antes: ['tarjeta', 'tooltip', 'panel'],
        hay: (d) => !!traduccion(d.word),
        Completo: ({ d }) => <>«{traduccion(d.word)}»</>,
        Corto: ({ d }) => <>«{traduccion(d.word)}»</>,
    },

    // LA PALABRA
    {
        id: 'he.raiz', dato: 'Raíz, su transliteración y su significado', seccion: 'palabra', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.word.root,
        Completo: function Raiz({ d }) {
            const { t } = useTranslation('hebrewTutor');
            return <FichaFilas filas={[[t('verseAnalyzer.ficha.root'), <>{he(d.word.root!, 'text-lg')} {d.word.rootTransliteration && <span className="italic text-muted-foreground">{d.word.rootTransliteration}</span>}{d.word.rootMeaning && <> · <strong className="font-semibold">{d.word.rootMeaning}</strong></>}</>]]} />;
        },
        // En el tooltip, la raíz con su transliteración (pedido del profesor, revisión 2026-11):
        // estaba antes del rediseño de la ficha y se había quedado sólo en la ficha completa.
        Corto: function RaizCorta({ d }) {
            const { t } = useTranslation('hebrewTutor');
            return (
                <p className="m-0 flex flex-wrap items-baseline gap-x-1.5 text-sm text-foreground">
                    <span className="text-muted-foreground">{t('verseAnalyzer.ficha.root')}</span>
                    {he(d.word.root!, 'text-base')}
                    {d.word.rootTransliteration && <span className="italic text-muted-foreground">{d.word.rootTransliteration}</span>}
                </p>
            );
        },
    },
    {
        id: 'he.lexico', dato: 'Léxico (glosa)', seccion: 'palabra', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.word.lemmaGloss,
        Completo: function Lexico({ d }) { const { t } = useTranslation('hebrewTutor'); return <FichaFilas filas={[[t('verseAnalyzer.ficha.lexicon'), <strong className="font-semibold">{d.word.lemmaGloss}</strong>]]} />; },
    },
    {
        // Revisión del profesor (2026-11, Rut 2:1 מוֹדַע): en la BHS el círculo remite al margen,
        // donde está el ketiv. Sale de OSHB: la palabra analizada es el qere.
        id: 'he.ketivQere', dato: 'Ketiv y qere: lo escrito y lo que se lee', seccion: 'palabra', origen: 'datos', antes: [],
        hay: (d) => !!d.ketivQere,
        Completo: function KetivQere({ d }) {
            const { t } = useTranslation('hebrewTutor');
            const f = d.ketivQere!;
            return (
                <FichaCaja titulo={t('verseAnalyzer.ficha.ketivQere.title')}>
                    {f.ketiv
                        ? <FichaFilas filas={[[t('verseAnalyzer.ficha.ketivQere.written'), he(f.ketiv, 'text-lg')], [t('verseAnalyzer.ficha.ketivQere.read'), he(f.qere, 'text-lg')]]} />
                        : null}
                    <p className="m-0 mt-1.5 text-[12.5px] leading-snug text-muted-foreground">
                        {t(f.ketiv ? 'verseAnalyzer.ficha.ketivQere.note' : 'verseAnalyzer.ficha.ketivQere.onlyQere')}
                    </p>
                </FichaCaja>
            );
        },
        Corto: function KetivQereCorto({ d }) {
            const { t } = useTranslation('hebrewTutor');
            const f = d.ketivQere!;
            return (
                <p className="m-0 flex flex-wrap items-baseline gap-x-1.5 text-sm text-foreground">
                    <span className="text-muted-foreground">°</span>
                    {f.ketiv
                        ? <>{t('verseAnalyzer.ficha.ketivQere.written')} {he(f.ketiv, 'text-base')}</>
                        : t('verseAnalyzer.ficha.ketivQere.title')}
                </p>
            );
        },
    },

    // LA FORMA
    {
        id: 'he.celdas', dato: 'Binyan, forma, tipo de raíz, persona, género, número, estado y valor temporal', seccion: 'forma', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!(vm(d) || nm(d)),
        Completo: function Celdas({ d }) { return <FichaCeldas celdas={useCeldas(d)} />; },
        Corto: LineaForma,
    },
    {
        id: 'he.correccionesOshb', dato: 'Correcciones de OSHB (cada diferencia)', seccion: 'forma', origen: 'datos', antes: ['tooltip'],
        hay: (d) => !!d.word.oshbReference?.corrections.length,
        Completo: ({ d }) => <div className="rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3"><OshbCorrectionsList oshb={d.word.oshbReference} /></div>,
    },
    {
        id: 'he.pistas', dato: 'Cómo se reconoce: la forma (pistas)', seccion: 'forma', origen: 'asistente', antes: ['tarjeta', 'tooltip', 'panel'],
        hay: (d) => !!vm(d)?.recognitionClues?.length,
        Completo: function Pistas({ d }) {
            const { t } = useTranslation('languageStructure');
            return <FichaCaja titulo={t('wordFicha.howRecognized')} plegable testId="ficha-pistas"><FichaPistas pistas={vm(d)!.recognitionClues!} /></FichaCaja>;
        },
    },
    {
        id: 'he.morfemas', dato: 'Morfemas, uno por uno (dagesh forte ◌ּ), y la guía de colores', seccion: 'forma', origen: 'asistente', antes: ['tarjeta', 'tooltip', 'panel'],
        hay: (d) => !!d.word.morphemes?.length, Completo: Morfemas,
    },
    {
        id: 'he.detectiveVerbo', dato: 'Detective del verbo (fuerte o débil) y su clasificación en Farfán', seccion: 'forma', origen: 'asistente', antes: ['panel'],
        hay: (d) => !!vm(d) && !!d.word.hebrewText, Completo: DetectiveVerbo,
    },

    // SU FUNCIÓN
    { id: 'he.funcionInfinitivo', dato: 'Función del infinitivo', seccion: 'funcion', origen: 'mixto', antes: ['tarjeta', 'tooltip'], hay: (d) => !!d.infinitive, Completo: InfinitivoCompleto, Corto: InfinitivoCorto },
    { id: 'he.funcionParticipio', dato: 'Función del participio', seccion: 'funcion', origen: 'mixto', antes: ['tarjeta', 'tooltip'], hay: (d) => !!d.participle, Completo: ParticipioCompleto, Corto: ParticipioCorto },
    { id: 'he.funcionKi', dato: 'Función de כִּי', seccion: 'funcion', origen: 'mixto', antes: ['tarjeta', 'tooltip'], hay: (d) => !!d.ki, Completo: KiCompleto, Corto: KiCorto },
    // U5 (revisión del profesor, Rut 3:5 אֶעֱשֶׂה): sólo con la función elegida o decidida — un análisis anterior
    // no la trae y listar cinco a once opciones en cada verbo no le dice nada al estudiante.
    { id: 'he.funcionVerbo', dato: 'Función del verbo finito (Arnold y Choi cap. 3), con el cohortativo por función', seccion: 'funcion', origen: 'mixto', antes: [], hay: (d) => !!d.verb && (!!d.verb.fn || !!d.verb.assistantReading), Completo: VerboCompleto, Corto: VerboCorto },
    {
        // Revisión del profesor (2026-11, Rut 2:1): «waw + no verbo introduce una cláusula disyuntiva,
        // pero no necesariamente contrastiva». La regla la dice el dato; el valor, el asistente.
        id: 'he.wawDisyuntiva', dato: 'Waw disyuntiva (waw + no verbo) y su valor', seccion: 'funcion', origen: 'mixto', antes: [],
        hay: (d) => !!d.disjunctive,
        Completo: function WawDisyuntiva({ d }) {
            const { t } = useTranslation('languageStructure');
            const r = d.disjunctive!.resolved;
            return (
                <FichaFuncion
                    titulo={t('relations.disjunctive')}
                    {...(r ? { nombre: t(`resolved.${r}`) } : {})}
                    origen={r ? 'eleccion' : 'regla'}
                    reconoce={t('notes.disjunctive')}
                    {...(r ? {} : { texto: t('disjunctiveNoValue') })}
                    fuentes={STRUCTURE_RULE_SOURCES.disjunctive}
                    testId="waw-disyuntiva"
                />
            );
        },
        Corto: function WawDisyuntivaCorta({ d }) {
            const { t } = useTranslation('languageStructure');
            const r = d.disjunctive!.resolved;
            return <p className="m-0 font-medium text-foreground/85">{t('relations.disjunctive')}{r ? ` · ${t(`resolved.${r}`)}` : ''}</p>;
        },
    },
    {
        // Sin regla para esta palabra, la función la da el asistente (con regla, va dentro de su bloque).
        id: 'he.funcionSintactica', dato: 'Función sintáctica (texto del asistente)', seccion: 'funcion', origen: 'asistente', antes: ['tarjeta', 'tooltip', 'panel'],
        hay: (d) => !!d.word.syntacticFunction && !funcionDeRegla(d),
        Completo: FuncionSintactica,
        Corto: ({ d }) => <p className="m-0 flex items-start gap-2"><FichaOrigenRotulo origen="asistente" /><span className="line-clamp-2">{d.word.syntacticFunction}</span></p>,
    },

    // EN EL CONTEXTO
    { id: 'he.quienHabla', dato: 'Quién habla y a quién', seccion: 'contexto', origen: 'regla', antes: ['tarjeta', 'tooltip'], hay: (d) => !!d.speech, Completo: ({ d }) => <SpeechNote speech={d.speech} /> },
    {
        // U4 (revisión del profesor, Rut 3:6 הַגֹּרֶן, nombrada en 3:3): un DATO, no una regla —
        // medido a mano, el artículo retoma al antecedente en 72–92 % de los casos según la distancia.
        id: 'he.articulo', dato: 'El sustantivo con artículo ya se nombró antes (posible artículo anafórico)', seccion: 'contexto', origen: 'datos', antes: [],
        hay: (d) => !!d.article, Completo: ArticuloAntecedente,
    },
    { id: 'he.antepuesta', dato: 'Antepuesta al verbo', seccion: 'contexto', origen: 'datos', antes: ['tarjeta', 'tooltip'], hay: (d) => !!d.fronted, Completo: ({ d }) => <FrontedNote fronted={d.fronted} /> },

    // PARA ESTUDIAR
    { id: 'he.explicacion', dato: 'Explicación pedagógica (con su formato)', seccion: 'estudio', origen: 'asistente', antes: ['tarjeta', 'panel'], hay: (d) => !!d.word.explanation, Completo: Explicacion },

    // ACCIONES
    {
        id: 'he.investigar', dato: 'Investigar la palabra paso a paso (detective)', seccion: 'acciones', origen: 'accion', antes: ['tarjeta'],
        hay: investigable,
        Completo: function Investigar({ d }) {
            const { t } = useTranslation('hebrewTutor');
            return (
                <button type="button" onClick={d.onInvestigate} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 text-[13.5px] font-bold text-primary hover:bg-primary/15 print:hidden">
                    <Search className="h-4 w-4" />{t('verseAnalyzer.ficha.investigate')}
                </button>
            );
        },
    },
];

/**
 * DÓNDE VA CADA CAMPO DEL ANÁLISIS. `Record<keyof …>` obliga a nombrar TODOS
 * los campos: si mañana el análisis trae uno nuevo, esto no compila hasta
 * decir en qué bloque se muestra (o por qué no va en la ficha). La prueba de
 * paridad comprueba que cada bloque nombrado exista en el registro.
 */
type Destino = string | { readonly fuera: string };
export const DESTINO_PALABRA: Readonly<Record<keyof WordAnalysis, Destino>> = {
    hebrewText: 'he.palabra',
    transliteration: 'he.palabra',
    root: 'he.raiz',
    rootTransliteration: 'he.raiz',
    rootMeaning: 'he.raiz',
    lemmaGloss: 'he.lexico',
    category: 'he.categoria',
    syntacticFunction: 'he.funcionSintactica',
    translation: 'he.traduccion',
    infinitiveFunction: 'he.funcionInfinitivo',
    participleFunction: 'he.funcionParticipio',
    kiFunction: 'he.funcionKi',
    verbFunction: 'he.funcionVerbo',
    explanation: 'he.explicacion',
    verbMorphology: 'he.celdas',
    nominalMorphology: 'he.celdas',
    morphemes: 'he.morfemas',
    clauseTag: { fuera: 'Se ve en el versículo (marcas de sintaxis), no en la ficha.' },
    oshbReference: 'he.oshb',
};
export const DESTINO_VERBO: Readonly<Record<keyof NonNullable<WordAnalysis['verbMorphology']>, Destino>> = {
    binyan: 'he.celdas', verbForm: 'he.celdas', verbType: 'he.celdas', rootClassification: 'he.celdas',
    person: 'he.celdas', gender: 'he.celdas', number: 'he.celdas', temporalValue: 'he.celdas',
    recognitionClues: 'he.pistas',
};
export const DESTINO_NOMBRE: Readonly<Record<keyof NonNullable<WordAnalysis['nominalMorphology']>, Destino>> = {
    gender: 'he.celdas', number: 'he.celdas', state: 'he.celdas', person: 'he.celdas',
    suffix: { fuera: 'Se muestra el de OSHB (celda «Sufijo», revisión del profesor 2026-11), no el que escribe el asistente.' },
};


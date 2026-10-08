import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGreekVerse } from './useGreekVerse';
import { useGreekInsight } from './useGreekInsight';
import { GreekPassageView } from './GreekPassageView';
import { GreekInsightBlocks } from './GreekInsightBlocks';
import type { GreekColorMode, GreekFontScale } from './GreekVerseTools';
import { GreekVerseBoard, GreekWordTooltip } from './GreekVerseBoard';
import { pintarPalabraGriega } from './pintarPalabraGriega';
import { GreekNavBar } from './GreekNavBar';
import { FirestoreGreekFindingsRepository } from '@dosfilos/infrastructure';
import { transliterateGreek } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';
import { toast } from 'sonner';
import { GreekWordCard } from './GreekWordCard';
import { StructureSection } from '@/components/language-structure/StructureSection';
import { conLectura, useVerseStructure } from '@/components/language-structure/useVerseStructure';
import { GREEK_INSIGHT_PROMPT_VERSION, type StructureWord } from '@dosfilos/domain';

/**
 * El ANALIZADOR griego — espejo del analizador hebreo, versículo a versículo:
 * texto griego con transliteración palabra a palabra, y la morfología completa
 * de cada una en tarjetas. Todo A LA VISTA, que es lo que el modo de estudio
 * paso a paso no ofrece — y todo DETERMINISTA (MorphGNT), sin una sola llamada
 * a modelo: instantáneo tras la primera carga del libro.
 *
 * Nace del pedido del fundador sobre Santiago 1:1-8: "necesito el texto griego
 * para leer, la transliteración y la traducción… todo el material a la vista
 * como ocurre en el módulo de hebreo". Las traducciones y el rango semántico
 * llegan en la fase 2 (LLM con caché, como el hebreo).
 */
export function GreekAnalyzerPage() {
    const { t, i18n } = useTranslation('greekTutor');
    const { t: tEstructura } = useTranslation('languageStructure');
    const { user } = useFirebase();
    const { book, chapter, verse, books, chapters, versesInChapter, data, previous, loading, error, goTo, step, provider, lemmaCounts } =
        useGreekVerse({ book: 'JAS', chapter: 1, verse: 1 });
    const [seleccion, setSeleccion] = useState<number | null>(null);
    // La selección es una posición en el versículo: al cambiar de versículo ya no vale.
    useEffect(() => setSeleccion(null), [book, chapter, verse]);
    /** Versículo suelto o perícopa: un pastor estudia pasajes. */
    const [vista, setVista] = useState<'verse' | 'passage'>('verse');
    /** Lemas guardados en esta sesión, para el check del botón. */
    const [guardados, setGuardados] = useState<Set<string>>(new Set());
    /** Preferencias de lectura — del ESCRITORIO, no del texto: localStorage. */
    const [fontScale, setFontScale] = useState<GreekFontScale>(() => {
        const v = Number(localStorage.getItem('greekAnalyzer.fontScale'));
        return (v === 0 || v === 1 || v === 2 ? v : 1) as GreekFontScale;
    });
    const [showTranslit, setShowTranslit] = useState(() => localStorage.getItem('greekAnalyzer.translit') !== '0');
    const [colorMode, setColorMode] = useState<GreekColorMode>(() => {
        const v = localStorage.getItem('greekAnalyzer.colorMode');
        return v === 'pos' || v === 'morph' ? v : 'off';
    });
    const cambiarColor = (m: GreekColorMode) => {
        setColorMode(m);
        localStorage.setItem('greekAnalyzer.colorMode', m);
    };
    const cambiarFuente = (sc: GreekFontScale) => {
        setFontScale(sc);
        localStorage.setItem('greekAnalyzer.fontScale', String(sc));
    };
    const alternarTranslit = () => {
        setShowTranslit((v) => {
            localStorage.setItem('greekAnalyzer.translit', v ? '0' : '1');
            return !v;
        });
    };

    const nombre = (b: { nameEs: string; nameEn: string }) =>
        i18n.language.startsWith('es') ? b.nameEs : b.nameEn;
    const libroActual = books.find((b) => b.id === book);
    const referencia = `${book} ${chapter}:${verse}`;
    /** La vista «Estructura» y lo que aporta a las fichas (lo antepuesto al verbo). */
    const estructura = useVerseStructure('gr', book, chapter, verse);
    const { insight, checking, generating, error: insightError, cacheUnavailable, generate } = useGreekInsight(
        referencia,
        data?.tokens,
        previous,
        estructura.nodes,
        // Los verbos de los datos (posición = token) sólo si coinciden con los tokens.
        estructura.words.length === (data?.tokens.length ?? -1) ? estructura.verbs : undefined,
    );
    // MACULA y MorphGNT se alinearon palabra por palabra en G0: el ordinal es el
    // índice del token. Si un día no coinciden en cantidad, no se enlaza nada.
    const cantidadTokens = data?.tokens.length ?? -1;
    const alinear = useCallback(
        (palabras: readonly StructureWord[]) => (palabras.length === cantidadTokens ? palabras.map((_, i) => i) : []),
        [cantidadTokens],
    );
    // Lo antepuesto, con foco o marco cuando el asistente ya leyó las cláusulas.
    const lecturas = insight?.clauseReadings;
    const antepuestas = useMemo(() => conLectura(estructura.nodes ?? [], estructura.ordinal, lecturas), [estructura, lecturas]);
    const frontedDe = (i: number) => (estructura.words.length === cantidadTokens ? antepuestas.get(i) : undefined);
    /**
     * Por qué no hay lectura de cláusulas: sin análisis (el botón «Generar» está
     * justo arriba: aquí sólo el porqué), un análisis anterior a v11, o uno que
     * se generó sin las filas (antes de que llegaran) o cuya lectura no pasó la
     * validación — en esos dos, re-analizar.
     */
    const reanalizar = { label: tEstructura('readingMissing.reanalyze'), onClick: () => void generate(), disabled: generating || estructura.loading };
    const avisoLectura = checking || cacheUnavailable
        ? undefined
        : !insight
          ? { message: tEstructura('readingMissing.generate') }
          : insight.promptVersion !== GREEK_INSIGHT_PROMPT_VERSION
            ? { message: tEstructura('readingMissing.stale'), action: reanalizar }
            : !lecturas?.length && (estructura.nodes?.length ?? 0) > 0
              ? { message: tEstructura('readingMissing.empty'), action: reanalizar }
              : undefined;

    /**
     * El caso del TÉRMINO de una preposición: el primer token siguiente que
     * tenga caso. El artículo intermedio (ἐν τῇ διασπορᾷ) comparte el caso
     * del sustantivo, así que tomarlo también acierta.
     */
    const casoDelTermino = (i: number) => {
        for (let j = i + 1; j < (data?.tokens.length ?? 0) && j <= i + 4; j++) {
            const c = data?.tokens[j]?.tag.case;
            if (c) return c;
        }
        return undefined;
    };

    /**
     * Las relaciones de una palabra, ya resueltas al texto de la otra — la
     * aposición deja de ser prosa dentro de una sola tarjeta y pasa a ser un
     * vínculo que ambas muestran.
     */
    const relacionesDe = (i: number) =>
        (insight?.relations ?? [])
            .filter((r) => r.from === i || r.to === i)
            .map((r) => ({
                type: r.type,
                note: r.note,
                otherText: data?.tokens[r.from === i ? r.to : r.from]?.text ?? '',
            }))
            .filter((r) => r.otherText);

    /** Empata una clave exegética con su token, tolerando puntuación. */
    const limpiar = (x: string) => x.replace(/[.,·;··]+$/u, '');
    const claveDe = (texto: string) =>
        insight?.keyInsights?.find((k) => limpiar(k.text) === limpiar(texto));

    /**
     * EL PUENTE AL SERMÓN: guarda el hallazgo con el MISMO formato de las
     * palabras clave del taller — que lo ofrecerá como propuesta en cualquier
     * sermón del pastor. Por eso el botón sólo existe con análisis: sin
     * significancia ni rango no hay nada que valga la pena llevarse.
     */
    const guardarHallazgo = async (i: number) => {
        const tok = data?.tokens[i];
        if (!tok || !user?.uid) return;
        const cuerpo = claveDe(tok.text)?.significance ?? insight?.words[i]?.semanticRange;
        if (!cuerpo) return;
        const nombreLibro = libroActual ? nombre(libroActual) : book;
        try {
            await new FirestoreGreekFindingsRepository().save(user.uid, {
                reference: `${nombreLibro} ${chapter}:${verse}`,
                lemma: tok.lemma,
                formatted: `*${tok.lemma}* (${transliterateGreek(tok.lemma)}) — ${cuerpo}`,
            });
            setGuardados((prev) => new Set(prev).add(tok.lemma));
            toast.success(t('analyzer.findingSavedToast'));
        } catch {
            toast.error(t('analyzer.findingError'));
        }
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-4 py-4 space-y-5">
                <GreekNavBar
                    books={books}
                    book={book}
                    chapter={chapter}
                    verse={verse}
                    chapters={chapters}
                    versesInChapter={versesInChapter}
                    nombre={nombre}
                    onGoTo={goTo}
                    onStep={step}
                    vista={vista}
                    onVista={setVista}
                    loading={loading}
                />

                {vista === 'passage' ? (
                    <GreekPassageView
                        provider={provider}
                        book={book}
                        bookName={libroActual ? nombre(libroActual) : book}
                        chapter={chapter}
                        versesInChapter={versesInChapter}
                        onOpenVerse={(v) => {
                            goTo(book, chapter, v);
                            setVista('verse');
                        }}
                    />
                ) : loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : error ? (
                    <p className="text-sm text-destructive py-12 text-center">{error}</p>
                ) : !data ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">{t('analyzer.notFound')}</p>
                ) : (
                    <>
                        {/* EL VERSÍCULO PARA LEER: griego grande, transliteración
                            debajo de cada palabra. Clicar una la resalta en la
                            grilla de análisis. */}
                        <GreekVerseBoard
                            colorMode={colorMode}
                            onColorMode={cambiarColor}
                            title={`${libroActual ? nombre(libroActual) : book} ${chapter}:${verse}`}
                            data={data}
                            insight={insight}
                            claveDe={claveDe}
                            relacionesDe={relacionesDe}
                            casoDelTermino={casoDelTermino}
                            lemmaCounts={lemmaCounts}
                            bookName={libroActual ? nombre(libroActual) : book}
                            fontScale={fontScale}
                            onFontScale={cambiarFuente}
                            showTranslit={showTranslit}
                            onToggleTranslit={alternarTranslit}
                            onReanalyze={insight ? () => void generate() : undefined}
                            reanalyzing={generating}
                            seleccion={seleccion}
                            onSeleccion={setSeleccion}
                            frontedDe={frontedDe}
                        />

                        {/* LAS DOS TRADUCCIONES — el aporte del modelo, con caché
                            global: el texto griego es el mismo para todos, así que
                            un análisis pagado una vez sirve a todos. PULL, no auto:
                            quien lee morfología no pidió pagar una llamada. */}
                        <GreekInsightBlocks
                            insight={insight}
                            error={insightError}
                            cacheUnavailable={cacheUnavailable}
                            tokens={data.tokens}
                            onGenerate={() => void generate()}
                            // Sin las filas de «Estructura» el análisis saldría sin la lectura de cláusulas.
                            generating={generating || estructura.loading}
                        />

                        {/* ESTRUCTURA — determinista (MACULA + reglas): las
                            cláusulas sangradas, sus conectores y relaciones.
                            Tocar una palabra la marca en las tarjetas. */}
                        <StructureSection
                            lang="gr"
                            structure={estructura}
                            readings={lecturas}
                            readingNotice={avisoLectura}
                            links={{
                                toPageIndex: alinear,
                                renderText: (i) => (data.tokens[i] ? pintarPalabraGriega(data.tokens[i]!, colorMode) : null),
                                renderTooltip: (i) => {
                                    const tok = data.tokens[i];
                                    return tok ? (
                                        <GreekWordTooltip
                                            token={tok}
                                            insight={insight?.words[i]}
                                            keyInsight={claveDe(tok.text)}
                                            relations={relacionesDe(i)}
                                            objectCase={casoDelTermino(i)}
                                            bookCount={lemmaCounts[tok.lemma]}
                                            bookName={libroActual ? nombre(libroActual) : book}
                                            fronted={frontedDe(i)}
                                        />
                                    ) : null;
                                },
                                onSelect: (i) => setSeleccion(seleccion === i ? null : i),
                                selected: seleccion,
                            }}
                        />

                        {/* ANÁLISIS POR PALABRA — todo a la vista. */}
                        <div>
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {t('analyzer.wordAnalysis', { count: data.tokens.length })}
                            </h3>
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {data.tokens.map((tok, i) => (
                                    <GreekWordCard
                                        key={i}
                                        token={tok}
                                        insight={insight?.words[i]}
                                        keyInsight={claveDe(tok.text)}
                                        relations={relacionesDe(i)}
                                        objectCase={casoDelTermino(i)}
                                        bookCount={lemmaCounts[tok.lemma]}
                                        bookName={libroActual ? nombre(libroActual) : book}
                                        fronted={frontedDe(i)}
                                        onSaveFinding={
                                            insight && user?.uid && (claveDe(tok.text) || insight.words[i])
                                                ? () => void guardarHallazgo(i)
                                                : undefined
                                        }
                                        saved={guardados.has(tok.lemma)}
                                        highlighted={seleccion === i}
                                        onClick={() => setSeleccion(seleccion === i ? null : i)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* ATRIBUCIÓN OBLIGATORIA. El texto del SBLGNT es CC BY
                            4.0; la MORFOLOGÍA de MorphGNT que esta página
                            muestra es CC BY-SA 4.0 — el bloque latente que el
                            sistema de atribuciones esperaba. */}
                        <p className="text-[11px] leading-relaxed text-muted-foreground border-t border-border/60 pt-3">
                            {t('analyzer.attribution')}{' '}
                            <a
                                href="https://github.com/morphgnt/sblgnt"
                                target="_blank"
                                rel="noreferrer"
                                className="underline hover:text-foreground"
                            >
                                morphgnt/sblgnt
                            </a>{' '}
                            · CC BY-SA 4.0
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}

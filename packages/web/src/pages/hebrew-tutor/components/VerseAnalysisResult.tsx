/**
 * VerseAnalysisResult
 *
 * Full-page result component rendering a VerseAnalysis aggregate:
 *  1. Hebrew text + transliteration header (RTL, large, centered)
 *  2. Translation panel (literal + fluid side by side)
 *  3. Color legend
 *  4. WordCard grid (one card per analyzed word)
 *  5. VerbTable summary
 *  6. Exegetical notes section
 *
 * Bidirectional word highlighting:
 *  - Hovering a WordCard  → highlights the word in BOTH Hebrew headers (main + sticky)
 *  - Hovering a word in the main header → highlights the corresponding WordCard
 *  - Clicking a word in either header   → scrolls to the card (smooth)
 */

import React from 'react';
import { WordCard } from './WordCard';
import { VerbTable } from './VerbTable';
import { ClausesSection } from './ClausesSection';
import { StructureSection } from '@/components/language-structure/StructureSection';
import { useEstructuraHebrea, useVersiculoFijo } from '../hooks/useEstructuraHebrea';
import { WordTutorSheet } from './WordTutorSheet';
import { VerbDetectivePanel } from './VerbDetectivePanel';
import { NominalDetectivePanel } from './NominalDetectivePanel';
import { StickyVerseHeader } from './StickyVerseHeader';
import { MorphemeSpan } from './MorphemeSpan';
import { WordTooltipContent } from './WordTooltipContent';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import { PaletteIcon, ActivityIcon, PrinterIcon, DownloadIcon, FileTextIcon, ScanTextIcon, BookOpenIcon, LayoutGridIcon, ScrollTextIcon, CopyIcon, CheckIcon, RefreshCwIcon, BookOpenTextIcon, PencilIcon, XIcon, PinIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { VerseAnalysis, WordAnalysis, LexicalNote, LexicalNoteType } from '@dosfilos/domain';
import { versePunctuationOf } from '@dosfilos/domain';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { generateVerseMarkdown } from '../utils/exportMarkdown';
import { toast } from 'sonner';
import { useHebrewTutor } from '../HebrewTutorProvider';
import { getSyntacticMark, SYNTACTIC_BORDER, SYNTACTIC_DOT } from '../utils/syntacticMark';

interface VerseAnalysisResultProps {
  analysis: VerseAnalysis;
  /** Verse reference used to persist translation edits, e.g. "Jonah.3.2" */
  verseReference?: string;
  onForceRefresh?: () => void;
  canForceRefresh?: boolean;
  /** Called after a translation is saved so the parent can update local state */
  onTranslationUpdate?: (updates: { literalTranslation?: string; fluidTranslation?: string }) => void;
  /** Libro (clave morphhb), capítulo y versículo: activan la sección «Estructura». */
  structureRef?: { book: string; chapter: number; verse: number };
}

// Color legend items — pedagogical vowel classes + Dagesh
const LEGEND_ITEMS = [
  { role: 'prefix',    hex: '#2563EB', label: 'Prefijo' },
  { role: 'root',      hex: '#64748B', label: 'Raíz' },
  { role: 'vowel_a',   hex: '#EF4444', label: 'Vocal A' },
  { role: 'vowel_ei',  hex: '#22C55E', label: 'Vocal E/I' },
  { role: 'vowel_ou',  hex: '#F97316', label: 'Vocal O/U' },
  { role: 'sheva',     hex: '#A855F7', label: 'Shevá' },
  { role: 'dagesh',    hex: '#928854', label: 'Dagesh' },
  { role: 'suffix',    hex: '#8B5CF6', label: 'Sufijo' },
];

export const VerseAnalysisResult: React.FC<VerseAnalysisResultProps> = ({
  analysis,
  verseReference,
  onForceRefresh,
  canForceRefresh = true,
  onTranslationUpdate,
  structureRef,
}) => {
  const { t } = useTranslation('hebrewTutor');
  const { t: tEstructura } = useTranslation('languageStructure');
  const [tutorWord, setTutorWord] = React.useState<any | null>(null);
  const [detectiveWord, setDetectiveWord] = React.useState<WordAnalysis | null>(null);
  const [detectiveWordIndex, setDetectiveWordIndex] = React.useState<number>(-1);

  /**
   * viewMode controls how the Hebrew text is rendered in both headers:
   * - 'masoretic':    Full hebrewText string, Ezra SIL, all diacritics intact
   * - 'morphological': MorphemeSpan with color coding, cantillation stripped
   */
   const [viewMode, setViewMode] = React.useState<'masoretic' | 'morphological'>('morphological');
  const fullMarks = viewMode === 'masoretic';
  const showColors = viewMode === 'morphological';
  const [showVerbMarkers, setShowVerbMarkers] = React.useState(true);
  const [showSyntaxMarkers, setShowSyntaxMarkers] = React.useState(false);
  const [fijarVersiculo, alternarFijo] = useVersiculoFijo();

  /** Index of the currently highlighted word (hover from header or card). null = none. */
  const [activeWordIndex, setActiveWordIndex] = React.useState<number | null>(null);

  // ── Estructura (G1 + G5): datos de MACULA, enlazados a las palabras del análisis ──
  const { estructura, alinear, antepuestas, discurso, sinLectura } = useEstructuraHebrea(analysis, structureRef);
  // H6: con formas corregidas según OSHB, la traducción literal es anterior a la corrección. La
  // fórmula de juramento no cuenta: su traducción la pone el código (H7), y en Rut 1:17 OSHB dice
  // imperfecto, así que esa «corrección» existe siempre, aun con la literal ya bien (prueba del fundador).
  const hayCorrecciones = analysis.words.some((w) => (w.oshbReference?.corrections ?? []).some((c) => c.reason !== 'oath-formula'));

  /**
   * La palabra según la vista activa — la usan el versículo y la «Estructura»:
   * masorética (texto entero, todas las marcas) o morfológica (morfemas a
   * color, sin cantilación).
   */
  const pintarPalabra = (w: WordAnalysis): React.ReactNode =>
    fullMarks ? (
      <span className="font-hebrew" style={{ fontFeatureSettings: '"mark" 1, "mkmk" 1' }}>
        {w.hebrewText}
      </span>
    ) : w.morphemes && w.morphemes.length > 0 ? (
      <>
        <MorphemeSpan segments={w.morphemes} variant="text" disableColors={!showColors} disableNativeTooltip />
        {/* Sof pasuq: los morfemas no lo llevan, la línea sí. */}
        <span className="font-hebrew">{versePunctuationOf(w.hebrewText)}</span>
      </>
    ) : (
      w.hebrewText
    );

  // ── Text scale (persisted in localStorage) ─────────────────────────────────
  // Steps: ~20% per jump — 7 levels total for wide accessibility range
  const SCALE_STEPS = [0.7, 0.85, 1.0, 1.2, 1.45, 1.75, 2.1] as const;
  const DEFAULT_SCALE_IDX = 2; // 1.0
  const [scaleIdx, setScaleIdx] = React.useState<number>(() => {
    try {
      const saved = localStorage.getItem('ht-text-scale-idx');
      if (saved !== null) {
        const n = parseInt(saved, 10);
        if (n >= 0 && n < SCALE_STEPS.length) return n;
      }
    } catch { /* ignore */ }
    return DEFAULT_SCALE_IDX;
  });
  const textScale = SCALE_STEPS[scaleIdx];

  const decreaseScale = () => setScaleIdx(i => {
    const next = Math.max(0, i - 1);
    localStorage.setItem('ht-text-scale-idx', String(next));
    return next;
  });
  const increaseScale = () => setScaleIdx(i => {
    const next = Math.min(SCALE_STEPS.length - 1, i + 1);
    localStorage.setItem('ht-text-scale-idx', String(next));
    return next;
  });

  /** Refs for each WordCard DOM node — used to scroll cards into view */
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  /** Sentinel placed at the bottom of the main verse header — tracked by StickyVerseHeader */
  const headerSentinelRef = React.useRef<HTMLDivElement>(null);

  // Ensure cardRefs array is the right size whenever words change
  React.useEffect(() => {
    cardRefs.current = cardRefs.current.slice(0, analysis.words.length);
  }, [analysis.words.length]);

  /**
   * Called when the user hovers a Hebrew word in the main header.
   * Sets the active index so the corresponding card gets highlighted.
   */
  const handleHeaderWordHover = React.useCallback((index: number | null) => {
    setActiveWordIndex(index);
  }, []);

  /**
   * Called when the user clicks a Hebrew word in the main header.
   * Scrolls the corresponding card smoothly into view.
   */
  const handleHeaderWordClick = React.useCallback((index: number) => {
    const card = cardRefs.current[index];
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setActiveWordIndex(index);
  }, []);

  /**
   * Launches the appropriate detective panel.
   * Verbal words → VerbDetectivePanel (currently implemented).
   * Nominal words → NominalDetectivePanel (⚠️ pending — shows informative toast meanwhile).
   */
  const handleInvestigate = React.useCallback((word: WordAnalysis) => {
    // Find the index in the words array for adjacent word lookup
    const idx = analysis.words.indexOf(word);
    setDetectiveWord(word);
    setDetectiveWordIndex(idx !== -1 ? idx : analysis.words.findIndex(w => w.hebrewText === word.hebrewText));
  }, [analysis.words]);

  /** Prev/next words for contextual display in the detective hero card */
  const detectiveAdjacentWords = React.useMemo(() => {
    if (!detectiveWord || detectiveWordIndex === -1) return undefined;
    const prev = detectiveWordIndex > 0 ? analysis.words[detectiveWordIndex - 1] : null;
    const next = detectiveWordIndex < analysis.words.length - 1 ? analysis.words[detectiveWordIndex + 1] : null;
    return {
      prev: prev ? { hebrewText: prev.hebrewText, transliteration: prev.transliteration } : null,
      next: next ? { hebrewText: next.hebrewText, transliteration: next.transliteration } : null,
    };
  }, [detectiveWord, detectiveWordIndex, analysis.words]);

  const [copiedHebrew, setCopiedHebrew] = React.useState(false);
  const [copiedTranslit, setCopiedTranslit] = React.useState(false);

  const handleCopyHebrew = () => {
    const hebrewText = analysis.words.map(w => w.hebrewText).join(' ');
    navigator.clipboard.writeText(hebrewText);
    setCopiedHebrew(true);
    setTimeout(() => setCopiedHebrew(false), 2000);
  };

  const handleCopyTranslit = () => {
    navigator.clipboard.writeText(analysis.transliteration);
    setCopiedTranslit(true);
    setTimeout(() => setCopiedTranslit(false), 2000);
  };

  const handleCopyMarkdown = () => {
    const md = generateVerseMarkdown(analysis);
    navigator.clipboard.writeText(md);
    toast.success('¡Análisis copiado al portapapeles en formato Markdown!');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Floating sticky header — sólo si el usuario lo activó («Fijo On») */}
      {fijarVersiculo && <StickyVerseHeader
        analysis={analysis}
        showColors={showColors}
        showVerbMarkers={showVerbMarkers}
        showSyntaxMarkers={showSyntaxMarkers}
        fullMarks={fullMarks}
        sentinelRef={headerSentinelRef}
        activeWordIndex={activeWordIndex}
        onWordHover={handleHeaderWordHover}
        onWordClick={handleHeaderWordClick}
        textScale={textScale}
      />}
      {/* ── Header: Reference + Hebrew text ───────────────────────────────── */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6 text-center">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-foreground">{analysis.reference}</h2>
            <div className="flex items-center gap-2 border-l border-border pl-4">
              {/* Análisis toggle — ON = morphological (colors), OFF = masoretic (plain text) */}
              <button
                onClick={() => setViewMode(viewMode === 'morphological' ? 'masoretic' : 'morphological')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  viewMode === 'morphological'
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                title={viewMode === 'morphological' ? 'Cambiar a texto masorético' : 'Activar análisis morfológico con colores'}
              >
                <PaletteIcon className="w-3.5 h-3.5" />
                {viewMode === 'morphological' ? 'Análisis On' : 'Análisis Off'}
              </button>
              {/* Verb markers — only relevant in morphological mode */}
              {viewMode === 'morphological' && (
                <button
                  onClick={() => setShowVerbMarkers(!showVerbMarkers)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${showVerbMarkers ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  title={showVerbMarkers ? "Ocultar indicadores de verbo" : "Mostrar indicadores de verbo"}
                >
                  <ActivityIcon className="w-3.5 h-3.5" />
                  {showVerbMarkers ? 'Verbos On' : 'Verbos Off'}
                </button>
              )}
              {/* Syntax markers (prepositional phrases, construct chains, appositions) */}
              {viewMode === 'morphological' && (
                <button
                  onClick={() => setShowSyntaxMarkers(!showSyntaxMarkers)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    showSyntaxMarkers
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  title={showSyntaxMarkers ? 'Ocultar marcas sintácticas' : 'Mostrar frases prep., cadenas constructas y aposiciones'}
                >
                  <ScrollTextIcon className="w-3.5 h-3.5" />
                  {showSyntaxMarkers ? 'Sintaxis On' : 'Sintaxis Off'}
                </button>
              )}
              <button
                onClick={alternarFijo}
                aria-pressed={fijarVersiculo}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors print:hidden ${
                  fijarVersiculo ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                title={t(fijarVersiculo ? 'verseAnalyzer.stickyVerse.titleOn' : 'verseAnalyzer.stickyVerse.titleOff')}
              >
                <PinIcon className="w-3.5 h-3.5" />
                {t(fijarVersiculo ? 'verseAnalyzer.stickyVerse.on' : 'verseAnalyzer.stickyVerse.off')}
              </button>
            </div>
            {/* ── Text size control ─────────────────────── */}
            <div className="flex items-center gap-0.5 bg-muted rounded-full px-1 py-0.5">
              <button
                onClick={decreaseScale}
                disabled={scaleIdx === 0}
                title="Reducir tamaño del texto"
                className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                A−
              </button>
              <span className="w-px h-3 bg-border" />
              <button
                onClick={increaseScale}
                disabled={scaleIdx === SCALE_STEPS.length - 1}
                title="Aumentar tamaño del texto"
                className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                A+
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 print:hidden">
            {onForceRefresh && (
              <div className="group relative">
                <button
                  id="ht-force-refresh-btn"
                  onClick={onForceRefresh}
                  disabled={!canForceRefresh}
                  className="text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-muted-foreground hover:text-primary"
                >
                  <RefreshCwIcon className="w-3 h-3" />
                  {t('verseAnalyzer.forceRefresh')}
                </button>
                {!canForceRefresh && (
                  <div className="absolute top-full mt-2 w-48 p-2 bg-secondary text-secondary-foreground text-[10px] rounded shadow-lg invisible group-hover:visible z-10 text-left">
                    Límite alcanzado de actualizaciones para este versículo.
                  </div>
                )}
              </div>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors shadow-sm">
                  <DownloadIcon className="w-3.5 h-3.5" />
                  Exportar
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={handlePrint} className="cursor-pointer flex items-center gap-2">
                  <PrinterIcon className="w-4 h-4 opacity-70" />
                  <span>Imprimir / Guardar PDF</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyMarkdown} className="cursor-pointer flex items-center gap-2">
                  <FileTextIcon className="w-4 h-4 opacity-70" />
                  <span>Copiar como Markdown</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Hebrew text — RTL, large serif. Per-word transliteration below each word. */}
          <div
            dir="rtl"
            className="font-hebrew text-foreground mb-3 tracking-wide flex flex-wrap gap-x-4 justify-center leading-[1.6]"
            style={{
              fontSize: `${2.25 * textScale}rem`,
              fontFeatureSettings: '"mark" 1, "mkmk" 1',
            }}
            lang="he"
          >
            {analysis.words.map((w, i) => {
              const isVerb = !!w.verbMorphology && showVerbMarkers;
              const syntacticMark = showSyntaxMarkers ? getSyntacticMark(w) : null;
              const isActive = activeWordIndex === i;
              // Maqaf (U+05BE ־): when the PREVIOUS word ends with maqaf, this word
              // is prosodically bound to it. We collapse the flex gap with a negative
              // inline-start margin so they appear visually connected in RTL layout.
              const prevHasMaqaf = i > 0 && analysis.words[i - 1].hebrewText.endsWith('\u05BE');

              // Border priority: active > verb > syntactic > none
              const borderClass = isActive
                ? 'bg-primary/15 ring-1 ring-primary/40 border-b-2 border-primary scale-105 shadow-sm'
                : isVerb
                  ? 'border-b-2 border-emerald-500/60 hover:border-emerald-500/80 hover:bg-primary/8 hover:shadow-sm'
                  : syntacticMark
                    ? `${SYNTACTIC_BORDER[syntacticMark]} hover:shadow-sm`
                    : 'border-b-2 border-transparent hover:border-primary/30 hover:bg-muted hover:shadow-sm';
              return (
                <Tooltip key={i} delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span
                      onClick={() => handleHeaderWordClick(i)}
                      onMouseEnter={() => handleHeaderWordHover(i)}
                      onMouseLeave={() => handleHeaderWordHover(null)}
                      style={prevHasMaqaf ? { marginInlineStart: '-0.75rem' } : undefined}
                      className={`
                        inline-flex flex-col items-center relative
                        cursor-pointer rounded-md px-1 pt-0.5 pb-1.5 transition-all duration-150
                        ${borderClass}
                      `}
                    >
                      {/* Syntactic pip dot — shown when verb underline already occupies the bottom border */}
                      {isVerb && syntacticMark && (
                        <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${SYNTACTIC_DOT[syntacticMark]}`} />
                      )}
                      {/* Hebrew — dual rendering strategy */}
                      <span>{pintarPalabra(w)}</span>
                    {/* Per-word transliteration */}
                    {w.transliteration && (
                      <span
                        dir="ltr"
                        lang="la"
                        style={{ fontSize: `${12 * textScale}px` }}
                        className="font-normal italic text-muted-foreground leading-none mt-2.5 pb-2 tracking-tight block"
                      >
                        {w.transliteration}
                      </span>
                    )}
                  </span>
                </TooltipTrigger>
                <WordTooltipContent word={w} side="bottom" fronted={antepuestas.get(i)} speech={discurso.get(i)} />
              </Tooltip>
            );
          })}
        </div>

        {/* Copy buttons row — transliteration line removed (now shown per-word) */}
        <div className="flex items-center justify-center gap-3 mt-1">
          <div className="flex items-center gap-1.5 print:hidden">
            <button
              onClick={handleCopyHebrew}
              title="Copiar texto hebreo"
              className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-primary transition-colors px-2 py-0.5 rounded-md hover:bg-primary/5"
            >
              {copiedHebrew ? <CheckIcon className="w-3 h-3 text-emerald-500" /> : <CopyIcon className="w-3 h-3" />}
              <span>Hebreo</span>
            </button>
            <button
              onClick={handleCopyTranslit}
              title="Copiar transliteración"
              className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-primary transition-colors px-2 py-0.5 rounded-md hover:bg-primary/5"
            >
              {copiedTranslit ? <CheckIcon className="w-3 h-3 text-emerald-500" /> : <CopyIcon className="w-3 h-3" />}
              <span>Translit.</span>
            </button>
          </div>
        </div>

        {/* ── Inline syntax color legend — visible only when Sintaxis On ── */}
        {showSyntaxMarkers && (
          <div className="mt-3 flex items-center justify-center gap-1 flex-wrap print:hidden">
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-background/60 border border-border/50 backdrop-blur-sm">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Marcas sintácticas:</span>
              <div className="flex items-center gap-0.5">
                <span className="inline-block w-4 h-[2px] rounded-full bg-emerald-500/80" />
                <span className="text-[10px] text-muted-foreground ml-1">Verbo</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="inline-block w-4 h-[2px] rounded-full bg-rose-500/80" />
                <span className="text-[10px] text-muted-foreground ml-1">Frase prep.</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="inline-block w-4 h-[2px] rounded-full bg-amber-500/80" />
                <span className="text-[10px] text-muted-foreground ml-1">Cadena constructa</span>
              </div>
              <div className="flex items-center gap-0.5">
                <span className="inline-block w-4 h-[2px] rounded-full bg-violet-500/80" />
                <span className="text-[10px] text-muted-foreground ml-1">Aposición</span>
              </div>
            </div>
          </div>
        )}

        {/* Sentinel: IntersectionObserver tracks this to trigger the sticky header */}
        <div ref={headerSentinelRef} aria-hidden="true" className="h-px" />
      </div>

      {/* ── Translations ──────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-3 print:block">
        <div className="print:mb-4">
          <TranslationPanel
            label={t('verseAnalyzer.analysis.literalTranslation')}
            text={analysis.literalTranslation}
            icon={<ScanTextIcon className="w-3.5 h-3.5" />}
            verseReference={verseReference}
            field="literalTranslation"
            onSaved={(text) => onTranslationUpdate?.({ literalTranslation: text })}
            notice={hayCorrecciones ? t('verseAnalyzer.oshb.literalNote') : undefined}
          />
        </div>
        <div className="print:mb-4">
          <TranslationPanel
            label={t('verseAnalyzer.analysis.fluidTranslation')}
            text={analysis.fluidTranslation}
            icon={<BookOpenIcon className="w-3.5 h-3.5" />}
            verseReference={verseReference}
            field="fluidTranslation"
            onSaved={(text) => onTranslationUpdate?.({ fluidTranslation: text })}
          />
        </div>
      </div>

      {/* ── Color legend ──────────────────────────────────────────────────── */}
      <div className="bg-muted/30 rounded-xl px-4 py-3 print:break-inside-avoid print:mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          {t('verseAnalyzer.colors.legend')}
        </p>
        <div className="flex flex-wrap gap-3">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.role} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: item.hex }}
              />
              <span className="text-[11px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Syntactic markers legend — only shown when toggle is ON */}
        {showSyntaxMarkers && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Marcas sintácticas
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-0.5 rounded-full bg-emerald-500/70" />
                <span className="text-[11px] text-muted-foreground">Verbo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-0.5 rounded-full bg-rose-500/70" />
                <span className="text-[11px] text-muted-foreground">Frase preposicional</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-0.5 rounded-full bg-amber-500/70" />
                <span className="text-[11px] text-muted-foreground">Cadena constructa (semikut)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-5 h-0.5 rounded-full bg-violet-500/70" />
                <span className="text-[11px] text-muted-foreground">Aposición</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Clauses ───────────────────────────────────────────────────────── */}
      {structureRef && (
        <StructureSection
          lang="he"
          structure={estructura}
          readings={analysis.clauseReadings}
          readingNotice={
            sinLectura
              ? {
                  message: tEstructura(`readingMissing.${sinLectura}`),
                  ...(onForceRefresh && canForceRefresh
                    ? { action: { label: tEstructura('readingMissing.reanalyze'), onClick: onForceRefresh } }
                    : {}),
                }
              : undefined
          }
          links={{
            toPageIndex: alinear,
            renderText: i => (analysis.words[i] ? pintarPalabra(analysis.words[i]!) : null),
            renderTooltip: i =>
              analysis.words[i] ? <WordTooltipContent word={analysis.words[i]!} side="bottom" fronted={antepuestas.get(i)} speech={discurso.get(i)} /> : null,
            onSelect: handleHeaderWordClick,
            selected: activeWordIndex,
          }}
        />
      )}
      {/* Las cláusulas como las partía el asistente (H2): en el modo descubrimiento
          (sin «Estructura») y en un análisis que todavía no trae la lectura de las
          filas — hasta re-analizar, es lo que hay. El aviso para re-analizar lo
          da «Estructura»: aquí no se repite. */}
      {(!structureRef || !analysis.clauseReadings?.length) && (
        <ClausesSection
          clauses={analysis.clauses}
          words={analysis.words}
          onReanalyze={!structureRef && onForceRefresh && canForceRefresh ? onForceRefresh : undefined}
        />
      )}

      {/* ── Word analysis grid ─────────────────────────────────────────────── */}
      <div className="print:mt-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <LayoutGridIcon className="w-4 h-4 opacity-60" />
          {t('verseAnalyzer.analysis.wordAnalysis')}
          <span className="text-xs font-normal text-muted-foreground/60">({analysis.words.length} palabras)</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 print:block">
          {analysis.words.map((word, i) => (
            <WordCard
              key={`${word.hebrewWord}-${i}`}
              word={word}
              index={i}
              isActive={activeWordIndex === i}
              onFocus={() => setTutorWord(word)}
              onInvestigate={handleInvestigate}
              onHover={(hovered) => setActiveWordIndex(hovered ? i : null)}
              cardRef={(el) => { cardRefs.current[i] = el; }}
              fronted={antepuestas.get(i)}
              speech={discurso.get(i)}
            />
          ))}
        </div>
      </div>

      {/* ── Verb table ─────────────────────────────────────────────────────── */}
      {analysis.verbTable && analysis.verbTable.length > 0 && (
        <VerbTable verbTable={analysis.verbTable} />
      )}

      {/* ── Exegetical notes ──────────────────────────────────────────────── */}
      {analysis.exegeticalNotes && analysis.exegeticalNotes.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-5 print:break-inside-avoid print:mt-6">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2">
            <ScrollTextIcon className="w-4 h-4 opacity-70" />
            {t('verseAnalyzer.analysis.exegeticalNotes')}
          </h3>
          <ul className="space-y-2">
            {analysis.exegeticalNotes.map((note, i) => (
              <li key={i} className="text-sm text-amber-900 dark:text-amber-300 flex gap-2">
                <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Lexical notes ──────────────────────────────────────────── */}
      {analysis.lexicalNotes && analysis.lexicalNotes.length > 0 && (
        <LexicalNotesSection notes={analysis.lexicalNotes} />
      )}

      <p className="text-[11px] text-muted-foreground/40 text-right">
        Analizado: {new Date(analysis.analyzedAt).toLocaleString('es-CL')}
      </p>

      {/* Interactive Tutor Sheet */}
      <WordTutorSheet 
        word={tutorWord} 
        isOpen={!!tutorWord} 
        onClose={() => setTutorWord(null)} 
      />

      {/* ── Detective Panels (Verb + Nominal) ── */}
      <VerbDetectivePanel
        word={detectiveWord}
        verseReference={analysis.verseReference ?? ''}
        isOpen={!!detectiveWord && detectiveWord.category?.toUpperCase() === 'VERB'}
        onClose={() => { setDetectiveWord(null); setDetectiveWordIndex(-1); }}
        adjacentWords={detectiveAdjacentWords}
      />

      <NominalDetectivePanel
        word={detectiveWord}
        verseReference={analysis.verseReference ?? ''}
        isOpen={!!detectiveWord && ['NOUN', 'PROPER_NOUN', 'ADJECTIVE', 'PRONOUN', 'PERSONAL_PRONOUN', 'DEMONSTRATIVE_PRONOUN', 'RELATIVE_PRONOUN'].includes(detectiveWord.category?.toUpperCase() ?? '')}
        onClose={() => { setDetectiveWord(null); setDetectiveWordIndex(-1); }}
        adjacentWords={detectiveAdjacentWords}
      />
    </div>
  );
};

// ── Sub-component ─────────────────────────────────────────────────────

interface TranslationPanelProps {
  label: string;
  text: string;
  icon: React.ReactNode;
  verseReference?: string;
  field?: 'literalTranslation' | 'fluidTranslation';
  onSaved?: (newText: string) => void;
  /** H6: la literal es anterior a una corrección de OSHB en el versículo. */
  notice?: string;
}

const TranslationPanel: React.FC<TranslationPanelProps> = ({
  label, text, icon, verseReference, field, onSaved, notice,
}) => {
  const { updateVerseTranslation } = useHebrewTutor();
  const [copied, setCopied] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(text);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Keep draft in sync if the parent text changes (e.g. on re-analysis)
  React.useEffect(() => { setDraft(text); setEditing(false); }, [text]);

  const handleCopy = () => {
    navigator.clipboard.writeText(editing ? draft : text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!verseReference || !field) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateVerseTranslation.execute({
        reference: verseReference,
        [field]: draft,
      });
      onSaved?.(draft);
      setEditing(false);
    } catch (_e) { /* localStorage unavailable (e.g. private mode) */
      setSaveError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(text);
    setEditing(false);
    setSaveError(null);
  };

  const canEdit = Boolean(verseReference && field);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground/70">{icon}</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              title="Editar traducción"
              className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/5 print:hidden"
            >
              <PencilIcon className="w-3 h-3" />
            </button>
          )}
          {editing && (
            <button
              onClick={handleCancel}
              title="Cancelar"
              className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors px-1.5 py-0.5 rounded hover:bg-destructive/5 print:hidden"
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={handleCopy}
            title="Copiar traducción"
            className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/5 print:hidden"
          >
            {copied
              ? <CheckIcon className="w-3 h-3 text-emerald-500" />
              : <CopyIcon className="w-3 h-3" />
            }
          </button>
        </div>
      </div>

      {notice && (
        <p className="mb-2 rounded-md border border-warning/30 bg-warning-subtle px-2 py-1 text-[11px] leading-snug text-warning-subtle-foreground" data-testid="literal-notice">
          {notice}
        </p>
      )}

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full text-sm text-foreground leading-relaxed bg-muted/40 border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            autoFocus
          />
          {saveError && (
            <p className="text-xs text-destructive">{saveError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || draft.trim() === text.trim()}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-foreground leading-relaxed">{text}</p>
      )}
    </div>
  );
};

// ── LexicalNotesSection ──────────────────────────────────────────────────────

const TYPE_STYLES: Record<LexicalNoteType, { badge: string; label: string }> = {
  idiom:          { badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300', label: 'Modismo' },
  semantic_range: { badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',            label: 'Rango Semántico' },
  cultural_note:  { badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',        label: 'Nota Cultural' },
  false_friend:   { badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',        label: 'Falso Amigo' },
};

interface LexicalNotesSectionProps {
  notes: readonly LexicalNote[];
}

const LexicalNotesSection: React.FC<LexicalNotesSectionProps> = ({ notes }) => {
  const { t } = useTranslation('hebrewTutor');

  return (
    <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-xl p-5 print:break-inside-avoid print:mt-6">
      <h3 className="text-sm font-semibold text-violet-800 dark:text-violet-400 mb-4 flex items-center gap-2">
        <BookOpenTextIcon className="w-4 h-4 opacity-70" />
        {t('verseAnalyzer.analysis.lexicalNotes')}
      </h3>
      <div className="space-y-4">
        {notes.map((note, i) => {
          const style = TYPE_STYLES[note.type] ?? TYPE_STYLES.idiom;
          return (
            <div
              key={i}
              className="bg-white/60 dark:bg-white/5 rounded-lg border border-violet-100 dark:border-violet-800/50 p-4 space-y-3"
            >
              {/* Header row: phrase + type badge */}
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="font-hebrew text-2xl leading-none text-violet-900 dark:text-violet-200"
                  dir="rtl"
                >
                  {note.hebrewPhrase}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${style.badge}`}>
                  {style.label}
                </span>
              </div>
              {/* Meaning comparison grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {t('verseAnalyzer.analysis.lexicalNoteLiteral')}
                  </p>
                  <p className="text-foreground/80 italic">"{note.literalMeaning}"</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                    {t('verseAnalyzer.analysis.lexicalNoteIdiomatic')}
                  </p>
                  <p className="text-violet-900 dark:text-violet-200 font-medium">"{note.idiomaticMeaning}"</p>
                </div>
              </div>
              {/* Academic explanation */}
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-violet-100 dark:border-violet-800/40 pt-3">
                {note.explanation}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

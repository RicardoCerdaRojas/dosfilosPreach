import { useContext, useState, useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SERMON_REMARK_PLUGINS } from '@/lib/sermonMarkdown';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/utils';
import { CitationQuote } from './CitationQuote';
import { BiblePassageViewer } from '@/components/bible/BiblePassageViewer';
import { LocalBibleService } from '@/services/LocalBibleService';
import { CitationManifestContext, CitationMarker, wrapCitationMarkers } from '@/lib/citationMarkers';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /**
   * Tipografía para LEER EN VOZ ALTA desde el púlpito.
   *
   * Sin esto la prosa hereda `max-w-none`: las líneas corren el ancho completo
   * del panel —unos 110 caracteres— cuando la medida legible son 60-75. Al
   * final de un renglón tan largo el ojo tiene que recorrer media pantalla para
   * encontrar el inicio del siguiente, y ése es justo el momento en que el
   * predicador levanta la vista y pierde el lugar.
   *
   * No es el default porque las burbujas del chat y los paneles angostos ya son
   * estrechos por su contenedor; ahí un tope de medida sólo agregaría aire.
   */
  reading?: boolean;
  /** If true, Bible references will be clickable to view the passage. */
  enableBibleLinks?: boolean;
}

// Comprehensive pattern to match Bible references in Spanish.
// Matches: "Juan 3:16", "Jn 3:16", "1 Juan 3:16-18", "1Jn 3.16", "Gén 1:1", etc.
// Supports: full names, abbreviations, with/without spaces, : or . as separator.
const BIBLE_REF_PATTERN = /(?:^|[^\wáéíóúñ])((?:[1-3]\s?)?(?:Génesis|Genesis|Gén|Gen|Gn|Éxodo|Exodo|Éx|Ex|Levítico|Levitico|Lev|Lv|Números|Numeros|Núm|Num|Nm|Deuteronomio|Deut|Dt|Josué|Josue|Jos|Jueces|Jue|Jc|Rut|Rt|Samuel|Sam|S|Reyes|Rey|R|Crónicas|Cronicas|Cr|Esdras|Esd|Ezr|Nehemías|Nehemias|Neh|Ne|Ester|Est|Et|Job|Jb|Salmos?|Sal|Sl|Ps|Proverbios|Prov|Pr|Prv|Eclesiastés|Eclesiastes|Ecl|Ec|Cantares|Cantar|Cnt|Ct|Isaías|Isaias|Is|Isa|Jeremías|Jeremias|Jer|Jr|Lamentaciones|Lam|Lm|Ezequiel|Ezeq|Ez|Daniel|Dan|Dn|Oseas|Os|Joel|Jl|Amós|Amos|Am|Abdías|Abdias|Abd|Ab|Jonás|Jonas|Jon|Miqueas|Miq|Mi|Nahúm|Nahum|Nah|Na|Habacuc|Hab|Sofonías|Sofonias|Sof|Hageo|Hag|Zacarías|Zacarias|Zac|Zc|Malaquías|Malaquias|Mal|Mateo|Mat|Mt|Marcos|Mar|Mc|Mr|Lucas|Luc|Lc|Juan|Jn|Hechos|Hch|Hec|Romanos|Rom|Ro|Rm|Corintios|Cor|Co|Gálatas|Galatas|Gál|Gal|Ga|Efesios|Ef|Efe|Filipenses|Fil|Fp|Colosenses|Col|Tesalonicenses|Tes|Ts|Timoteo|Tim|Ti|Tito|Tit|Filemón|Filemon|Flm|Flmn|Hebreos|Heb|He|Santiago|Sant|Stg|Pedro|Ped|Pe|P|Judas|Jud|Apocalipsis|Apoc|Ap)\s*\d+[:.]\d+(?:[-–]\d+)?)/gi;

/**
 * Markdown renderer for canvas-chat surfaces.
 *
 * Previously a hand-rolled paragraph parser; replaced with
 * `react-markdown` + `remark-gfm` + `rehype-raw` after four consecutive
 * bugs in one session (heading-body fusion, list block boundaries,
 * single-asterisk italic, blockquote block boundaries) all rooted in
 * the custom split-on-`\n\n` strategy. The library handles all of
 * those plus tables, strikethrough, autolinks, and any future
 * markdown feature for free.
 *
 * Bible reference detection stays a project-specific pre-processing
 * step: each detected reference is rewritten to `[📖 Ref](#bible-Ref)`
 * so it surfaces as a markdown link, then the custom `a` component
 * intercepts the `#bible-…` href to open the passage viewer dialog.
 * That keeps the click handler scoped to text nodes and lets
 * react-markdown handle the rest of the inline parsing.
 */
export function MarkdownRenderer({ content, className, enableBibleLinks = true, reading = false }: MarkdownRendererProps) {
  const [selectedReference, setSelectedReference] = useState<string | null>(null);

  // ADR-031 — when a sermon citation manifest is in context (provided by the
  // editor / preview), inline `[N]` anchors render as a clickable popover with
  // the chunk text + book + page. No manifest in context → no-op (other
  // surfaces are unaffected).
  const citationManifest = useContext(CitationManifestContext);
  const hasCitations = Boolean(citationManifest && citationManifest.entries.length > 0);

  const textContent = typeof content === 'string' ? content : String(content ?? '');

  // Pre-process: convert Bible refs to markdown links so react-markdown
  // parses them as anchors. Skips refs already inside markdown link
  // syntax to avoid double-wrapping (idempotent across re-renders).
  const processed = useMemo(() => {
    let out = textContent;
    if (enableBibleLinks && out) {
      out = out.replace(BIBLE_REF_PATTERN, (match, ref, offset, source) => {
        const before = source.slice(Math.max(0, offset - 10), offset);
        const after = source.slice(offset + match.length, Math.min(source.length, offset + match.length + 20));
        if (before.includes('[📖') || after.includes('](#bible-') || before.includes('#bible-')) {
          return match;
        }
        const trimmed = ref.trim();
        if (LocalBibleService.parseReference(trimmed) === null) {
          return match;
        }
        const prefix = match.slice(0, match.length - ref.length);
        return `${prefix}[📖 ${trimmed}](#bible-${encodeURIComponent(trimmed)})`;
      });
    }
    // Wrap bare-ordinal citation markers into <span data-cite-id> so the
    // span component below can hand them to <CitationMarker>.
    if (hasCitations && out) {
      out = wrapCitationMarkers(out);
    }
    return out;
  }, [textContent, enableBibleLinks, hasCitations]);

  if (!textContent) {
    return <p className="text-muted-foreground text-sm">Sin contenido</p>;
  }

  return (
    <>
      <div
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none',
          // Medida acotada + interlineado y respiro entre párrafos generosos:
          // el texto se lee de pie y hay que poder reencontrar el renglón.
          reading && '[&>p]:max-w-[68ch] [&>ul]:max-w-[68ch] [&>ol]:max-w-[68ch] [&>blockquote]:max-w-[68ch]',
          reading && '[&>p]:leading-[1.85] [&>p]:mb-5 [&_li]:leading-[1.8] [&>ul]:mb-5 [&>ol]:mb-5',
          reading && '[&>h3]:mt-8 [&>h4]:mt-6',
          // Tighten paragraph spacing so successive blocks read like the
          // legacy renderer that emitted `mb-3 leading-relaxed` per <p>.
          '[&>p]:mb-3 [&>p]:leading-relaxed [&>p]:text-sm [&>p]:text-foreground/90',
          '[&_h3]:font-bold [&_h3]:text-lg [&_h3]:mb-3 [&_h3]:mt-4 [&_h3]:text-foreground',
          '[&_h4]:font-semibold [&_h4]:text-base [&_h4]:mb-2 [&_h4]:mt-3 [&_h4]:text-foreground',
          '[&_strong]:font-semibold [&_strong]:text-foreground',
          '[&_em]:italic [&_em]:text-foreground',
          '[&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-3 [&_ul]:space-y-1',
          '[&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-3 [&_ol]:space-y-1',
          '[&_li]:text-sm [&_li]:leading-relaxed',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:py-2 [&_blockquote]:my-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:bg-muted/30 [&_blockquote]:rounded-r',
          '[&_hr]:my-4 [&_hr]:border-muted',
          className,
        )}
      >
        <ReactMarkdown
          // Leyendo un sermón (el lienzo del borrador), la regla de los saltos
          // del pastor (LINE_BREAK_RULE); en el chat, el markdown de siempre.
          remarkPlugins={reading ? SERMON_REMARK_PLUGINS : [remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            /**
             * Sólo las CITAS DE LA BIBLIOTECA reciben el botón de traducción.
             *
             * El sermón usa blockquotes para otras cosas —el texto de las
             * referencias cruzadas, sobre todo—, y ofrecer "traducir" sobre un
             * versículo en español sería ruido. La firma de una cita la pone
             * `injectNarrativeCitationAnchors`: el texto va entre «» y la última
             * línea es la atribución, que empieza con raya.
             */
            blockquote: ({ node, children, ...props }: any) => {
              const crudo = String((node?.children ?? [])
                .map((c: any) => (c.children ?? []).map((g: any) => g.value ?? '').join(''))
                .join('\n'));
              const esCita = crudo.includes('«') && /^—/m.test(crudo);
              if (!esCita) return <blockquote {...props}>{children}</blockquote>;
              return <CitationQuote {...props}>{children}</CitationQuote>;
            },
            span: ({ node, ...props }: any) => {
              if (hasCitations && props['data-cite-id']) {
                return <CitationMarker {...props} />;
              }
              return <span {...props} />;
            },
            a: ({ node, ...props }: any) => {
              const href = props.href || '';
              if (href.startsWith('#bible-')) {
                const ref = decodeURIComponent(href.replace('#bible-', ''));
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedReference(ref);
                    }}
                    className={cn(
                      'inline-flex items-center gap-0.5 text-primary font-medium',
                      'hover:underline decoration-dotted underline-offset-2',
                      'cursor-pointer transition-colors hover:text-primary/80',
                      'bg-primary/5 px-1 py-0.5 rounded text-sm',
                    )}
                    title={`Ver ${ref}`}
                  >
                    <BookOpen className="h-3 w-3 flex-shrink-0" />
                    <span>{props.children}</span>
                  </button>
                );
              }
              return <a {...props} className="text-primary underline" />;
            },
          }}
        >
          {processed}
        </ReactMarkdown>
      </div>

      {enableBibleLinks && (
        <BiblePassageViewer
          reference={selectedReference}
          onClose={() => setSelectedReference(null)}
        />
      )}
    </>
  );
}

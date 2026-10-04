import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useSermon } from '@/hooks/use-sermons';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Minus, Plus, Clock, Play, Pause, RotateCcw,
  Settings, BookOpen, Maximize, Minimize, Eraser, Pen, GraduationCap, ListOrdered
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SermonAnnotator } from '@/components/sermons/SermonAnnotator';
import { StudySessionPanel } from '@/components/sermons/StudySessionPanel';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  ResizableHandle, 
  ResizablePanel, 
  ResizablePanelGroup 
} from "@/components/ui/resizable";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { LocalBibleService } from '@/services/LocalBibleService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useHighlights } from '@/hooks/useHighlights';
import { HighlightToolbar } from '@/components/preach/HighlightToolbar';
import { applyHighlights as applyHighlightsRenderer } from './preach/highlightRenderer';
import { FloatingTimer } from './preach/FloatingTimer';
import { extractSections, slugifyHeader } from '@dosfilos/domain';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

function extractText(children: any): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return extractText(children.props?.children);
  }
  return '';
}

// Secciones y slugs: del dominio, la misma copia que usa la tablet. Las
// marcas se anclan por slug y antes había dos copias a mano (A7).
export function PreachModePage() {
  const { t } = useTranslation('sermonDetail');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { sermon, loading } = useSermon(id);
  
  // Settings State
  const [fontSize, setFontSize] = useState(24); // Base font size in px
  const [showControls, setShowControls] = useState(true);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [showStudyPanel, setShowStudyPanel] = useState(false);
  
  // Fullscreen & Focus State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBlackout, setIsBlackout] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  
  // Timer State
  const [targetDuration, setTargetDuration] = useState(30); // minutes
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  
  // Bible Viewer State
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [bibleText, setBibleText] = useState<string | null>(null);
  const [bibleVersion, setBibleVersion] = useState<string>('');
  const [loadingBible, setLoadingBible] = useState(false);
  
  // Highlights
  const { highlights, selectedText, addHighlight, removeHighlight, clearAllHighlights } = useHighlights(id || '');

  // Ref for sermon content container (for scroll sync with annotations)
  const sermonContentRef = useRef<HTMLDivElement>(null);

  // Fullscreen API handlers
  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch (err) {
      console.error('Error entering fullscreen:', err);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
    } catch (err) {
      console.error('Error exiting fullscreen:', err);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Scroll progress tracker
  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const progress = (scrollTop / (documentHeight - windowHeight)) * 100;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // B = Blackout toggle
      if (e.key === 'b' || e.key === 'B') {
        setIsBlackout(prev => !prev);
      }
      // F or F11 = Fullscreen toggle
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (isFullscreen) {
          exitFullscreen();
        } else {
          enterFullscreen();
        }
      }
      // Escape = Exit fullscreen and blackout
      if (e.key === 'Escape') {
        setIsBlackout(false);
        if (isFullscreen) {
          exitFullscreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFullscreen]);

  // Timer Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);
  
  // Bible Fetching Logic
  const fetchBibleText = async (ref: string) => {
    setLoadingBible(true);
    setBibleText(null);
    try {
      // Simulate a small delay for better UX (optional, but feels more natural)
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const text = LocalBibleService.getVerses(ref);
      
      if (text) {
        setBibleText(text);
        setBibleVersion(LocalBibleService.getVersionName(ref));
      } else {
        setBibleText(t('preachMode.bible.notFound'));
        setBibleVersion('');
      }
    } catch (error) {
      console.error('Error fetching bible text:', error);
      setBibleText(t('preachMode.bible.error'));
      setBibleVersion('');
    } finally {
      setLoadingBible(false);
    }
  };

  useEffect(() => {
    if (selectedReference) {
      fetchBibleText(selectedReference);
    }
  }, [selectedReference]);

  // Bible Reference Pattern (Robust) - includes Full English and Spanish book names
  const BIBLE_REF_PATTERN = /(?:^|[^\wáéíóúñ])((?:[1-3]\s?)?(?:Génesis|Genesis|Gén|Gen|Gn|Éxodo|Exodo|Exodus|Éx|Ex|Levítico|Levitico|Leviticus|Lev|Lv|Números|Numeros|Numbers|Núm|Num|Nm|Deuteronomio|Deut|Deuteronomy|Dt|Josué|Josue|Joshua|Jos|Jueces|Jue|Judges|Jc|Rut|Ruth|Rt|Samuel|Sam|S|Reyes|Rey|Kings|Kgs|R|Crónicas|Cronicas|Chronicles|Chr|Cr|Esdras|Esd|Ezra|Ezr|Nehemías|Nehemias|Nehemiah|Neh|Ne|Ester|Est|Esther|Et|Job|Jb|Salmos?|Psalms?|Sal|Sl|Ps|Proverbios|Prov|Proverbs|Pr|Prv|Eclesiastés|Eclesiastes|Ecclesiastes|Ecl|Ec|Cantares|Cantar|Song of Solomon|Songs|Cnt|Ct|Isaías|Isaias|Isaiah|Is|Isa|Jeremías|Jeremias|Jeremiah|Jer|Jr|Lamentaciones|Lam|Lamentations|Lm|Ezequiel|Ezeq|Ezekiel|Ez|Daniel|Dan|Dn|Oseas|Os|Hosea|Joel|Jl|Amós|Amos|Am|Abdías|Abdias|Obadiah|Abd|Ab|Jonás|Jonas|Jonah|Jon|Miqueas|Miq|Micah|Mi|Nahúm|Nahum|Nah|Na|Habacuc|Habakkuk|Hab|Sofonías|Sofonias|Zephaniah|Sof|Hageo|Hag|Haggai|Zacarías|Zacarias|Zechariah|Zac|Zc|Malaquías|Malaquias|Malachi|Mal|Mateo|Mat|Matthew|Matt|Mt|Marcos|Mar|Mark|Mk|Mr|Lucas|Luc|Luke|Lk|Lm|Juan|Jn|John|Hechos|Hch|Hec|Acts|Ac|Romanos|Rom|Romans|Ro|Rm|Corintios|Cor|Corinthians|Co|Gálatas|Galatas|Galatians|Gál|Gal|Ga|Efesios|Ef|Ephesians|Eph|Efe|Filipenses|Fil|Philippians|Phil|Php|Fp|Colosenses|Col|Colossians|Tesalonicenses|Tes|Thessalonians|Thess|Ts|Th|Timoteo|Tim|Timothy|Ti|Tito|Tit|Titus|Filemón|Filemon|Philemon|Phm|Flm|Flmn|Hebreos|Heb|Hebrews|He|Santiago|Sant|James|Jas|Stg|Pedro|Ped|Peter|Pet|Pe|Pt|P|Judas|Jud|Jude|Apocalipsis|Apoc|Ap|Revelation|Rev)\s*\d+[:.]\d+(?:[-–]\d+)?)/gi;

  // Markdown Processing for Bible Links
  const processContent = (content: string) => {
    if (!content) return '';
    
    let processed = content;
    
    // Step 1: Normalize line breaks
    // First handle actual newlines (from editor)
    processed = processed.replace(/\n\n+/g, '\n\n'); // Multiple newlines -> double newline (paragraph)
    
    // Step 2: Convert HTML breaks to newlines
    // Double <br/> = paragraph break
    processed = processed.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n');
    // Single <br/> = line break  
    processed = processed.replace(/<br\s*\/?>/gi, '\n');
    
    // Step 3: Add Bible reference links
    processed = processed.replace(BIBLE_REF_PATTERN, (match, ref, offset, string) => {
      // Prevent double-processing if already inside a markdown link
      const substringBefore = string.slice(Math.max(0, offset - 10), offset);
      const substringAfter = string.slice(offset + match.length, Math.min(string.length, offset + match.length + 20));
      
      if (substringBefore.includes('[📖') || substringAfter.includes('](#bible-') || substringBefore.includes('#bible-')) {
          return match;
      }

      const prefix = match.slice(0, match.length - ref.length);
      const trimmedRef = ref.trim();
      return `${prefix}[📖 ${trimmedRef}](#bible-${encodeURIComponent(trimmedRef)})`;
    });
    
    return processed;
  };
  
  const applyHighlights = (content: string) => applyHighlightsRenderer(content, highlights, t);

  // Handle click on highlighted text to remove it
  useEffect(() => {
    const handleHighlightClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'MARK' && target.dataset.highlightId) {
        const highlightId = target.dataset.highlightId;
        const highlight = highlights.find(h => h.id === highlightId);
        if (highlight) {
          // Brief visual feedback
          target.style. opacity = '0.3';
          setTimeout(() => {
            removeHighlight(highlightId);
          }, 150);
        }
      }
    };
    
    document.addEventListener('click', handleHighlightClick);
    return () => document.removeEventListener('click', handleHighlightClick);
  }, [highlights, removeHighlight]);

  const components = {
    a: ({ node, ...props }: any) => {
      const href = props.href || '';
      if (href.startsWith('#bible-')) {
        const ref = decodeURIComponent(href.replace('#bible-', ''));
        return (
          <span
            className="text-primary font-semibold cursor-pointer hover:underline decoration-dotted underline-offset-4 inline-flex items-center gap-1"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedReference(ref);
            }}
          >
            {props.children}
          </span>
        );
      }
      return <a {...props} className="text-primary underline" />;
    },
    // Custom blockquote styling
    blockquote: ({ node, ...props }: any) => (
      <blockquote
        {...props}
        className="border-l-4 border-primary/30 pl-4 my-6 text-muted-foreground bg-muted/10 py-3 pr-4 rounded-r"
      />
    ),
    // Custom heading styling — h2 tags are jump targets for the
    // section-nav dropdown, so each gets a deterministic slug id
    // derived from its text content.
    h2: ({ node, ...props }: any) => (
      <h2 {...props} id={`preach-section-${slugifyHeader(extractText(props.children))}`} className="text-2xl font-bold mt-8 mb-4 scroll-mt-24" />
    ),
    h3: ({ node, ...props }: any) => <h3 {...props} className="text-xl font-semibold mt-6 mb-3" />,
  };

  // Parse rendered sermon markdown for level-2 headers so the
  // section-nav dropdown can jump straight to "Introducción", "Punto I",
  // "Conclusión", etc. — pastor doesn't have to scroll through 4000
  // words mid-sermon to find a section.
  const sections = extractSections(sermon?.content ?? '');

  const jumpToSection = (slug: string) => {
    const el = document.getElementById(`preach-section-${slug}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading || !sermon) {
    return <div className="flex items-center justify-center h-screen">{t('preachMode.loading')}</div>;
  }

  const getTimerColor = () => {
    if (timeLeft <= 0) return 'text-destructive animate-pulse';
    if (timeLeft <= 5 * 60) return 'text-destructive';
    if (timeLeft <= 10 * 60) return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <div className={cn(
      "bg-background text-foreground flex flex-col h-full",
      showAnnotations ? "overflow-hidden" : "overflow-y-auto"
    )}>
      {/* Top Bar - Controls */}
      <div className={cn(
        "fixed top-0 left-0 right-0 bg-background/95 backdrop-blur border-b z-50 transition-transform duration-300 p-4 flex items-center justify-between gap-4",
        !showControls && "-translate-y-full"
      )}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/sermons/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('preachMode.exit')}
          </Button>
          {/* Hide title on tablet and below, show only on large screens */}
          <div className="h-6 w-px bg-border hidden lg:block" />
          <h1 className="font-semibold truncate max-w-[300px] lg:max-w-[600px] hidden lg:block">{sermon.title}</h1>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          {/* Section Navigation — jump between intro / points / conclusion */}
          {sections.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" title={t('preachMode.sections')}>
                  <ListOrdered className="h-4 w-4" />
                  <span className="ml-2 hidden md:inline">
                    {t('preachMode.sections')}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-[60vh] overflow-y-auto">
                <DropdownMenuLabel>{t('preachMode.sectionsLabel')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sections.map((s) => (
                  <DropdownMenuItem
                    key={s.slug}
                    onClick={() => jumpToSection(s.slug)}
                    className="cursor-pointer"
                  >
                    {s.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Timer Controls */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5">
            <Clock className={cn("h-4 w-4", getTimerColor())} />
            {/* D5 — escala con el cuerpo: desde el atril, a 14 px no se lee. */}
            <span
              className={cn("font-mono font-semibold tabular-nums text-center", getTimerColor())}
              style={{ fontSize: `${Math.round(fontSize * 1.4)}px`, minWidth: '3.4em' }}
            >
              {formatTime(timeLeft)}
            </span>
            <div className="flex items-center gap-0.5">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6" 
                onClick={() => setIsRunning(!isRunning)}
              >
                {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6" 
                onClick={() => {
                  setIsRunning(false);
                  setTimeLeft(targetDuration * 60);
                }}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6" 
                onClick={() => setShowTimerSettings(true)}
              >
                <Settings className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Fullscreen Toggle Button */}
          <Button 
            variant={isFullscreen ? "default" : "outline"} 
            size="icon"
            onClick={() => isFullscreen ? exitFullscreen() : enterFullscreen()}
            title={isFullscreen ? t('preachMode.exitFullScreen') : t('preachMode.fullScreen')}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>

          {/* Font Controls */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setFontSize(s => Math.max(16, s - 2))}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-8 text-center text-sm">{fontSize}px</span>
            <Button variant="outline" size="icon" onClick={() => setFontSize(s => Math.min(60, s + 2))}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Highlight Controls */}
          {highlights.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-warning" />
                <span>{t('preachMode.highlights', { count: highlights.length })}</span>
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={clearAllHighlights}
                title={t('preachMode.clearHighlights')}
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Annotations Toggle */}
          <Button 
            variant={showAnnotations ? "default" : "outline"}
            size="icon"
            onClick={() => setShowAnnotations(!showAnnotations)}
            title={t('preachMode.annotations')}
          >
            <Pen className="h-4 w-4" />
          </Button>

          {/* Study Session Toggle – only when sermon has a linked session */}
          {sermon?.sourceFacultySessionId && (
            <Button
              variant={showStudyPanel ? "default" : "outline"}
              size="icon"
              onClick={() => setShowStudyPanel(prev => !prev)}
              title={showStudyPanel ? t('preachMode.studyPanel.hide') : t('preachMode.studyPanel.show')}
              className={showStudyPanel ? '' : 'border-primary/40 text-primary hover:bg-primary/5'}
            >
              <GraduationCap className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area with Resizable Panels */}
      <div className="flex-1 w-full h-[calc(100vh-64px)] overflow-hidden">
        {(showAnnotations || showStudyPanel) ? (
          <ResizablePanelGroup direction="horizontal" className="h-full w-full rounded-lg border">
            <ResizablePanel defaultSize={showAnnotations && showStudyPanel ? 50 : 60} minSize={30}>
              <div 
                ref={sermonContentRef}
                className={cn(
                  "w-full h-full focus:outline-none overflow-y-auto p-4 sm:p-6",
                  showControls ? "pt-4" : ""
                )}
                onClick={() => setShowControls(!showControls)}
              >
                  {/* Sermon Title - Discrete */}
                  <div className="text-center mb-12">
                    <h1 
                      className="font-delivery font-bold text-muted-foreground/70"
                      style={{ fontSize: `${Math.min(fontSize * 1.5, 48)}px` }}
                    >
                      {sermon.title}
                    </h1>
                    {sermon.bibleReferences && sermon.bibleReferences.length > 0 && (
                      <p className="text-muted-foreground mt-2" style={{ fontSize: `${fontSize * 0.7}px` }}>
                        {sermon.bibleReferences.join(' • ')}
                      </p>
                    )}
                  </div>

                  <div 
                    className="prose prose-lg max-w-none dark:prose-invert font-delivery transition-all duration-200 prose-headings:font-bold prose-headings:text-foreground prose-p:text-foreground prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4 prose-strong:text-foreground"
                    style={{ fontSize: `${fontSize}px`, maxWidth: '48ch', marginInline: 'auto', lineHeight: 1.55 }}
                  >
                    <style>{`
                      .prose p {
                        margin-top: 1.25em !important;
                        margin-bottom: 1.25em !important;
                      }
                      .prose p:first-child {
                        margin-top: 0 !important;
                        margin-bottom: 1.25em !important;
                      }
                    `}</style>
                    <ReactMarkdown 
                      components={components}
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                    >
                      {applyHighlights(processContent(sermon.content))}
                    </ReactMarkdown>
                  </div>
              </div>
            </ResizablePanel>

            {/* Annotations panel */}
            {showAnnotations && (
              <>
                <ResizableHandle withHandle className="bg-border hover:bg-primary/20 transition-colors" />
                <ResizablePanel defaultSize={showStudyPanel ? 25 : 40} minSize={20}>
                  <div className="h-full bg-white relative">
                    <SermonAnnotator 
                      sermonId={id!} 
                      scrollContainerRef={sermonContentRef}
                    />
                  </div>
                </ResizablePanel>
              </>
            )}

            {/* Study session panel */}
            {showStudyPanel && sermon.sourceFacultySessionId && (
              <>
                <ResizableHandle withHandle className="bg-border hover:bg-primary/20 transition-colors" />
                <ResizablePanel defaultSize={showAnnotations ? 25 : 40} minSize={20}>
                  <div className="h-full overflow-hidden">
                    <StudySessionPanel
                      sessionId={sermon.sourceFacultySessionId}
                      onClose={() => setShowStudyPanel(false)}
                    />
                  </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        ) : (
           <div 
              className="w-full h-full focus:outline-none overflow-y-auto max-w-4xl mx-auto p-8 pt-24 pb-32"
              onClick={() => setShowControls(!showControls)}
            >
              {/* Sermon Title - Discrete */}
              <div className="text-center mb-12">
                <h1 
                  className="font-delivery font-bold text-muted-foreground/70"
                  style={{ fontSize: `${Math.min(fontSize * 1.5, 48)}px` }}
                >
                  {sermon.title}
                </h1>
                {sermon.bibleReferences && sermon.bibleReferences.length > 0 && (
                  <p className="text-muted-foreground mt-2" style={{ fontSize: `${fontSize * 0.7}px` }}>
                    {sermon.bibleReferences.join(' • ')}
                  </p>
                )}
              </div>

              <div 
                className="prose prose-lg max-w-none dark:prose-invert font-delivery transition-all duration-200 prose-headings:font-bold prose-headings:text-foreground prose-p:text-foreground prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4 prose-strong:text-foreground"
                style={{ fontSize: `${fontSize}px`, maxWidth: '48ch', marginInline: 'auto', lineHeight: 1.55 }}
              >
                <style>{`
                  .prose p {
                    margin-top: 1.25em !important;
                    margin-bottom: 1.25em !important;
                  }
                  .prose p:first-child {
                    margin-top: 0 !important;
                    margin-bottom: 1.25em !important;
                  }
                `}</style>
                <ReactMarkdown 
                  components={components}
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                >
                  {applyHighlights(processContent(sermon.content))}
                </ReactMarkdown>
              </div>
            </div>
        )}
      </div>
      
      {/* Highlight Toolbar */}
      <HighlightToolbar 
        selectedText={selectedText}
        onHighlight={addHighlight}
        onClose={() => window.getSelection()?.removeAllRanges()}
      />

      {/* Floating Timer - Visible when running and controls are hidden */}
      {isRunning && !showControls && (
        <FloatingTimer timeLeft={timeLeft} onShowControls={() => setShowControls(true)} />
      )}

      {/* Timer Settings Dialog */}
      <Dialog open={showTimerSettings} onOpenChange={setShowTimerSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('preachMode.timer.settings')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('preachMode.timer.duration')}</Label>
              <Input 
                type="number" 
                value={targetDuration} 
                onChange={(e) => setTargetDuration(Number(e.target.value))}
                min={1}
              />
            </div>
            <Button onClick={() => {
              setTimeLeft(targetDuration * 60);
              setShowTimerSettings(false);
            }} className="w-full">
              {t('preachMode.timer.saveAndReset')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bible Verse Dialog */}
      <Dialog open={!!selectedReference} onOpenChange={(open) => !open && setSelectedReference(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {selectedReference}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 min-h-[100px]">
            {loadingBible ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="text-lg leading-relaxed">
                {bibleText}
              </div>
            )}
            <div className="mt-4 text-xs text-muted-foreground text-right">
              {bibleVersion && t('preachMode.bible.source', { version: bibleVersion })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Blackout Overlay - Press B to toggle */}
      {isBlackout && (
        <div 
          className="fixed inset-0 bg-black z-[100] flex items-center justify-center cursor-pointer"
          onClick={() => setIsBlackout(false)}
        >
          <div className="text-white/50 text-sm">{t('preachMode.blackout')}</div>
        </div>
      )}

      {/* Scroll Progress Indicator */}
      {scrollProgress > 0 && (
        <div className="fixed top-0 left-0 right-0 h-2 bg-muted/40 z-[60] shadow-lg">
          <div 
            className="h-full bg-primary shadow-lg transition-all duration-300"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      )}

      {/* Keyboard Shortcuts Help - Only in fullscreen */}
      {isFullscreen && (
        <div className="fixed bottom-4 left-4 bg-background/90 backdrop-blur border rounded-lg px-4 py-3 text-xs text-muted-foreground z-50 opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-forwards"
          style={{ animationDelay: '500ms' }}
        >
          <div className="space-y-1">
            <div><kbd className="px-1.5 py-0.5 bg-muted rounded text-foreground">B</kbd> = {t('preachMode.shortcuts.blackout')}</div>
            <div><kbd className="px-1.5 py-0.5 bg-muted rounded text-foreground">ESC</kbd> = {t('preachMode.shortcuts.exit')}</div>
          </div>
        </div>
      )}
    </div>
  );
}

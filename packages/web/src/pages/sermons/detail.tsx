import { useParams, useNavigate } from 'react-router-dom';
import {
    Archive, ArrowLeft, Trash2, FileText,
    BookOpen, History, Plus,
    Share2, MoreVertical, Download, Globe, Eye, CheckCircle,
    Type, Minus, PenTool, PenLine,
} from 'lucide-react';
import { useRef } from 'react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useSidebar } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { SermonAnnotator } from '@/components/sermons/SermonAnnotator';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSermon, useDeleteSermon, useArchiveSermon } from '@/hooks/use-sermons';
import { useSermonPublishGate } from '@/hooks/useSermonPublishGate';
import { useSermonContraScan } from '@/hooks/useSermonContraScan';
import { useState, useEffect } from 'react';
import { exportService, sermonService, seriesService } from '@dosfilos/application';
import { SermonSeriesEntity, PreachingLog, sermonFileName, sermonPrintAuthor, type SermonPrintOptions } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';
import { toast } from 'sonner';
import { SermonPreview } from '@/components/sermons/SermonPreview';
import { SermonRepurposeSection } from '@/components/sermons/SermonRepurposeSection';
import { SermonBibliographySection } from '@/components/sermons/SermonBibliographySection';
import { SermonAuthorshipSection } from '@/components/sermons/SermonAuthorshipSection';
import { SermonAttributionsSection } from '@/components/sermons/SermonAttributionsSection';
import { PastoralSeedAuditPanel } from '@/components/sermons/PastoralSeedAuditPanel';
import { SermonVersionBanner } from './components/detail/SermonVersionBanner';
import { FidelityReviewPanel } from '@/components/sermons/FidelityReviewPanel';
import { PrePublishFidelityModal } from '@/components/sermons/PrePublishFidelityModal';
import { ContraScanModal } from '@/components/sermons/ContraScanModal';
import { useTranslation } from 'react-i18next';
import { ShareSermonDialog } from './components/detail/ShareSermonDialog';
import { LogPreachingDialog } from './components/detail/LogPreachingDialog';
import { SermonHistoryDialog } from './components/detail/SermonHistoryDialog';

export function SermonDetailPage() {
  const { t } = useTranslation('sermonDetail');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useFirebase();

  // Validate ID - if it's a route param placeholder, redirect
  if (!id || id === ':id' || id.startsWith(':')) {
    navigate('/dashboard/sermons', { replace: true });
    return null;
  }

  const { sermon, loading, mutate } = useSermon(id);
  const { deleteSermon, loading: deleting } = useDeleteSermon();
  const { archiveSermon, loading: archiving } = useArchiveSermon();
  const publishGate = useSermonPublishGate({ onPublished: () => mutate() });
  // Phase 4 PR 1 (ADR-033) — contra-scan wraps publish as the first
  // confrontation: once it clears, the fidelity publish gate runs.
  const contraScan = useSermonContraScan({
    onCleared: (sermonId) => publishGate.attemptPublish(sermonId, sermon?.fidelityReport),
  });
  const publishing =
    publishGate.preparing || publishGate.publishing || contraScan.scanning || contraScan.persisting;
  const fidelityPanelRef = useRef<HTMLDivElement>(null);

  // Sidebar control
  const { open, setOpen, isMobile } = useSidebar();
  
  const [series, setSeries] = useState<SermonSeriesEntity | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Preaching Log State
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logLocation, setLogLocation] = useState('');
  const [logDuration, setLogDuration] = useState('45');
  const [logNotes, setLogNotes] = useState('');
  const [logging, setLogging] = useState(false);

  const [markingComplete, setMarkingComplete] = useState(false);
  const [fontSize, setFontSize] = useState(18);

  const [showHistory, setShowHistory] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevShowAnnotations = useRef(showAnnotations);
  const prevOpen = useRef(open);
  
  // 1. Auto-toggle sidebar based on annotations state
  useEffect(() => {
    // Only run if showAnnotations actually changed
    if (prevShowAnnotations.current !== showAnnotations) {
      prevShowAnnotations.current = showAnnotations;
      
      if (!isMobile) {
        if (showAnnotations) {
          setOpen(false);
        } else {
          setOpen(true);
        }
      }
    }
  }, [showAnnotations, setOpen, isMobile]);

  // 2. Auto-close annotations when sidebar is manually opened
  useEffect(() => {
    // Only run if sidebar state actually changed
    if (prevOpen.current !== open) {
      prevOpen.current = open;
      
      // If sidebar was opened, close annotations
      if (open && showAnnotations && !isMobile) {
        setShowAnnotations(false);
        // Synchronize ref to avoid triggering the other effect unnecessarily
        prevShowAnnotations.current = false;
      }
    } else if (open !== prevOpen.current) {
      // Fallback sync if ref missed update (unlikely but safe)
      prevOpen.current = open;
    }
  }, [open, showAnnotations, isMobile]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (sermon?.seriesId) {
      loadSeries(sermon.seriesId);
    }
  }, [sermon?.seriesId]);

  const loadSeries = async (seriesId: string) => {
    try {
      const data = await seriesService.getSeries(seriesId);
      setSeries(data);
    } catch (error) {
      console.error('Error loading series:', error);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteSermon(id);
    navigate('/dashboard/sermons');
  };

  const handlePublish = async () => {
    if (!id || !sermon) return;
    // Contra-scan (P3, ADR-033) runs first. With the `contra_scan` flag off it
    // calls onCleared directly, so this stays equivalent to the prior flow. The
    // central idea is the pastor's own (AI-forbidden) seed thesis; fall back to
    // the title when a sermon predates the structured seed.
    const centralIdea =
      sermon.wizardProgress?.draft?.pastoralSeed?.centralIdea?.trim() ||
      sermon.wizardProgress?.draft?.title?.trim() ||
      sermon.title;
    await contraScan.attempt(id, centralIdea);
  };

  const handleReviewMarkers = () => {
    fidelityPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleArchive = async () => {
    if (!id) return;
    await archiveSermon(id);
    mutate();
  };

  // La portada nombra a quien predica: el nombre que escribió el pastor o, si
  // quedó el «Pastor» de fábrica, el de su cuenta.
  const opcionesDeImpresion = (): SermonPrintOptions => ({
    author: sermonPrintAuthor(sermon?.authorName, user?.displayName),
    series: series?.title ?? null,
  });

  const handleExport = async () => {
    if (!sermon) return;
    try {
      setExporting(true);
      await exportService.exportSermonToPdf(sermon, opcionesDeImpresion());
      toast.success(t('toast.exportSuccess'));
    } catch (error) {
      console.error('Error exporting sermon:', error);
      toast.error(t('toast.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const handleExportDocx = async () => {
    if (!sermon) return;
    try {
      setExporting(true);
      const { exportSermonToDocx } = await import('@/lib/sermon/exportSermonToDocx');
      const blob = await exportSermonToDocx(sermon, opcionesDeImpresion());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sermonFileName(sermon.title, 'docx');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('toast.exportSuccess'));
    } catch (error) {
      console.error('Error exporting sermon to docx:', error);
      toast.error(t('toast.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const handleShareToggle = async (checked: boolean) => {
    if (!id) return;
    try {
      setSharing(true);
      if (checked) {
        await sermonService.shareSermon(id);
        toast.success(t('toast.shared'));
      } else {
        await sermonService.unshareSermon(id);
        toast.success(t('toast.unshared'));
      }
      mutate();
    } catch (error) {
      console.error('Error sharing sermon:', error);
      toast.error(t('toast.shareError'));
    } finally {
      setSharing(false);
    }
  };

  const handleLogPreaching = async () => {
    if (!sermon || !id) return;
    setLogging(true);
    try {
      const newLog: PreachingLog = {
        date: new Date(logDate || new Date().toISOString()),
        location: logLocation,
        durationMinutes: parseInt(logDuration) || 0,
        notes: logNotes
      };

      const updatedHistory = [...(sermon.preachingHistory || []), newLog];
      
      await sermonService.updateSermon(id, {
        preachingHistory: updatedHistory
      } as any);

      toast.success(t('toast.logSuccess'));
      setShowLogDialog(false);
      setLogLocation('');
      setLogNotes('');
      mutate();
    } catch (error) {
      console.error('Error logging preaching:', error);
      toast.error(t('toast.logError'));
    } finally {
      setLogging(false);
    }
  };

  const copyToClipboard = () => {
    if (!sermon?.shareToken) return;
    const url = `${window.location.origin}/share/${sermon.shareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(t('toast.copied'));
  };

  const handleMarkComplete = async () => {
    if (!id || !sermon) return;
    setMarkingComplete(true);
    try {
      await sermonService.updateSermon(id, {
        wizardProgress: {
          currentStep: 4,
          lastSaved: new Date()
        }
      } as any);
      toast.success(t('toast.completeSuccess'));
      mutate();
    } catch (error) {
      console.error('Error marking sermon as complete:', error);
      toast.error(t('toast.completeError'));
    } finally {
      setMarkingComplete(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!sermon) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">{t('notFound.title')}</h2>
        <Button onClick={() => navigate('/dashboard/sermons')}>
          {t('notFound.button')}
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      draft: { variant: 'secondary', label: t('status.draft') },
      published: { variant: 'default', label: t('status.published') },
      archived: { variant: 'outline', label: t('status.archived') },
    };
    const config = variants[status] || variants.draft;
    const safeConfig = config!;
    return (
      <Badge variant={safeConfig.variant} className="capitalize">
        {safeConfig.label}
      </Badge>
    );
  };

  return (
    <div className={cn("bg-background h-full flex flex-col", showAnnotations ? "overflow-hidden" : "overflow-y-auto pb-20")}>
      {/* Header Toolbar */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 transition-all duration-200">
        <div className={cn(
          "px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3",
          showAnnotations ? "w-full" : "max-w-5xl mx-auto"
        )}>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard/sermons')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            {/* Title in header - Only visible when scrolled on large screens */}
            <div className={`flex items-center gap-3 transition-opacity duration-300 hidden lg:flex ${isScrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <div className="h-6 w-px bg-border" />
              <span className="font-semibold truncate max-w-[300px] xl:max-w-md">
                {sermon.title}
              </span>
              {getStatusBadge(sermon.status)}
            </div>
          </div>

          <div className="flex items-center gap-2">
             {/* Font Size Controls */}
            <div className="flex items-center gap-1 bg-muted/50 border rounded-full px-2 py-1 mr-2">
              <Type className="h-3 w-3 text-muted-foreground ml-1" />
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFontSize(s => Math.max(14, s - 1))}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-xs w-6 text-center tabular-nums">{fontSize}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFontSize(s => Math.min(24, s + 1))}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* History Button */}
            {/* Annotations Toggle */}
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)}>
              <History className="h-4 w-4 2xl:mr-2" />
              <span className="hidden 2xl:inline">{t('actions.history')}</span>
            </Button>

            <Button 
              variant={showAnnotations ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setShowAnnotations(!showAnnotations)}
            >
              <PenTool className="h-4 w-4 2xl:mr-2" />
              <span className="hidden 2xl:inline">{showAnnotations ? t('actions.hideNotes') : t('actions.notes')}</span>
            </Button>
            
            <Separator orientation="vertical" className="h-6" />

            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary">
              <Share2 className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/sermons/${sermon.id}/edit`)}>
              <PenLine className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-6" />

            <Button 
              onClick={() => navigate(`/preach/${sermon.id}`)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <BookOpen className="h-4 w-4 xl:mr-2" />
              <span className="hidden xl:inline">{t('actions.present')}</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('actions.share')}</DropdownMenuLabel>
                <DropdownMenuItem onClick={handleExport} disabled={exporting}>
                  <Download className="mr-2 h-4 w-4" />
                  {t('actions.exportPdf')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportDocx} disabled={exporting}>
                  <Download className="mr-2 h-4 w-4" />
                  {t('actions.exportDocx')}
                </DropdownMenuItem>
                {sermon.isShared && (
                  <DropdownMenuItem onClick={() => window.open(`/share/${sermon.shareToken}`, '_blank')}>
                    <Globe className="mr-2 h-4 w-4" />
                    {t('actions.viewPublic')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {sermon.status === 'draft' && (
                  <DropdownMenuItem onClick={handlePublish} disabled={publishing}>
                    <Eye className="mr-2 h-4 w-4" />
                    {t('actions.publish')}
                  </DropdownMenuItem>
                )}
                {sermon.status === 'published' && (
                  <DropdownMenuItem onClick={handleArchive} disabled={archiving}>
                    <Archive className="mr-2 h-4 w-4" />
                    {t('actions.archive')}
                  </DropdownMenuItem>
                )}
                {sermon.status === 'draft' && (!sermon.wizardProgress || (sermon.wizardProgress.currentStep ?? 0) < 4) && (
                  <DropdownMenuItem onClick={handleMarkComplete} disabled={markingComplete}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {markingComplete ? t('actions.markingComplete') : t('actions.markComplete')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)} 
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('actions.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {showAnnotations ? (
           <ResizablePanelGroup direction="horizontal" className="h-full">
             <ResizablePanel defaultSize={60} minSize={30}>
               <div 
                 ref={scrollRef}
                 className="h-full overflow-y-auto w-full pb-20 scrollbar-thin scroll-smooth"
               >
                  <div className={cn(
                    "p-4 sm:p-6 lg:p-8 w-full space-y-8",
                    // When annotations are shown, use full width (no max-width) to verify alignment
                    // Or keep max-width but remove mx-auto to left align?
                    // Let's try matching the header padding logic:
                    // Header has px-4 sm:px-6 lg:px-8.
                    // Here we have p-4... so padding matches.
                    // If we remove mx-auto, it aligns left.
                    showAnnotations ? "max-w-none" : "max-w-4xl mx-auto"
                  )}>
                     {sermon.versionOf && (
                       <SermonVersionBanner versionOf={sermon.versionOf} versionLabel={sermon.versionLabel} />
                     )}
                     <SermonPreview
                        title={sermon.title}
                        content={sermon.content}
                        authorName={sermon.authorName}
                        date={new Date(sermon.updatedAt || new Date())}
                        bibleReferences={sermon.bibleReferences}
                        tags={sermon.tags}
                        category={sermon.category}
                        status={sermon.status}
                        fontSize={fontSize}
                        citationManifest={sermon.citationManifest}
                      />
                  </div>
               </div>
             </ResizablePanel>
             
             <ResizableHandle withHandle />
             
             <ResizablePanel defaultSize={40} minSize={20}>
               <div className="h-full border-l bg-white relative overflow-hidden">
                 <SermonAnnotator sermonId={id!} scrollContainerRef={scrollRef} />
               </div>
             </ResizablePanel>
           </ResizablePanelGroup>
        ) : (
          <div className="h-full overflow-y-auto w-full pb-20">
             <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 w-full space-y-8">
               {sermon.versionOf && (
                 <SermonVersionBanner versionOf={sermon.versionOf} versionLabel={sermon.versionLabel} />
               )}
               {!sermon.content?.trim() && !sermon.wizardProgress?.draft && (
                 <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                   <div className="flex-1">
                     <p className="font-medium text-foreground">{t('noDraft.title')}</p>
                     <p className="text-sm text-muted-foreground">{t('noDraft.body')}</p>
                   </div>
                   <Button onClick={() => navigate(`/dashboard/sermons/generate?id=${sermon.id}`)}>
                     {t('noDraft.cta')}
                   </Button>
                 </div>
               )}
               <SermonPreview
                title={sermon.title}
                content={sermon.content}
                authorName={sermon.authorName}
                date={new Date(sermon.updatedAt || new Date())}
                bibleReferences={sermon.bibleReferences}
                tags={sermon.tags}
                category={sermon.category}
                status={sermon.status}
                fontSize={fontSize}
                citationManifest={sermon.citationManifest}
              />
              <PastoralSeedAuditPanel sermonId={sermon.id} />
              <div ref={fidelityPanelRef}>
                <FidelityReviewPanel
                  sermonId={sermon.id}
                  report={sermon.fidelityReport}
                  onReportUpdated={mutate}
                />
              </div>
              <SermonBibliographySection
                bibliography={sermon.bibliography}
                manifest={sermon.citationManifest}
              />
              {/* ADR-037 — cómo se armó. No se dibuja para los sermones
                  anteriores al taller: sin registro no se dice nada. */}
              <SermonAuthorshipSection
                snapshot={sermon.authorshipSnapshot}
                liveElements={sermon.wizardProgress?.sectionElements}
              />
              <SermonAttributionsSection manifest={sermon.citationManifest} />
              <SermonRepurposeSection
                sermonId={sermon.id}
                sermonTitle={sermon.title}
                sermonStatus={sermon.status}
              />
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dialogs.delete.description', { title: sermon.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialogs.delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? t('dialogs.delete.deleting') : t('dialogs.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareSermonDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        sermon={sermon}
        sharing={sharing}
        copied={copied}
        onShareToggle={handleShareToggle}
        onCopyLink={copyToClipboard}
      />

      <LogPreachingDialog
        open={showLogDialog}
        onOpenChange={setShowLogDialog}
        logDate={logDate}
        logLocation={logLocation}
        logDuration={logDuration}
        logNotes={logNotes}
        logging={logging}
        onDateChange={setLogDate}
        onLocationChange={setLogLocation}
        onDurationChange={setLogDuration}
        onNotesChange={setLogNotes}
        onSubmit={handleLogPreaching}
      />

      <SermonHistoryDialog
        open={showHistory}
        onOpenChange={setShowHistory}
        sermon={sermon}
        series={series}
        onAddLog={() => setShowLogDialog(true)}
      />

      <PrePublishFidelityModal
        open={publishGate.modalOpen}
        onOpenChange={publishGate.setModalOpen}
        report={publishGate.report}
        publishing={publishGate.publishing}
        onConfirmOverride={(reason) => id && publishGate.confirmOverride(id, reason)}
        onReviewMarkers={handleReviewMarkers}
      />

      <ContraScanModal
        open={contraScan.modalOpen}
        onOpenChange={contraScan.setModalOpen}
        centralIdea={contraScan.centralIdea}
        dissentingChunks={contraScan.dissentingChunks}
        publishing={contraScan.persisting || publishGate.preparing || publishGate.publishing}
        onProceed={contraScan.confirmProceed}
        onConsider={contraScan.confirmConsideration}
        onOverride={contraScan.confirmOverride}
      />
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Loader2, Upload, X } from 'lucide-react';
import { seriesService } from '@dosfilos/application';
import type { SermonSeriesEntity } from '@dosfilos/domain';
import { FirebaseStorageService } from '@dosfilos/infrastructure';
import { useFirebase } from '@/context/firebase-context';
import { addDays, daysBetween, fromStoredDate, parseLocalDate } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UpgradeRequiredModal } from '@/components/upgrade';
import { useTranslation } from '@/i18n';
import { Trans } from 'react-i18next';

interface SeriesFormData {
  title: string;
  description: string;
  coverUrl: string;
  startDate: string;
  endDate: string;
}

export function SeriesForm() {
  const { t, i18n } = useTranslation('series');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useFirebase();
  const { checkCanCreatePreachingPlan } = useUsageLimits();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [uploading, setUploading] = useState(false);
  // Hold the original loaded series so onSubmit can compare the
  // submitted startDate against the persisted one and shift the
  // planned-sermon dates accordingly when the pastor changes it.
  const [originalSeries, setOriginalSeries] = useState<SermonSeriesEntity | null>(null);
  
  // Storage Service
  const storageService = new FirebaseStorageService();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState({
    reason: 'limit_reached' as const,
    limitType: 'plans' as const,
    currentLimit: 1
  });

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<SeriesFormData>();
  const [sermonCount, setSermonCount] = useState<number>(4);
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly' | 'flexible'>('weekly');

  // Watch values for live preview
  const watchedValues = watch();

  // Number of planned sermons whose scheduledDate would shift if the
  // pastor changes the series startDate. Used to render the heads-up
  // hint near the date input. Excludes sermons in development (any
  // status past 'planned' or with a draftId).
  const shiftablePlannedCount = (originalSeries?.metadata?.plannedSermons ?? []).filter(
      (p) => !p.draftId && (!p.status || p.status === 'planned') && p.scheduledDate,
  ).length;

  /**
   * Hard rebuild of all unstarted plannedSermon scheduledDates from
   * the form's current startDate + frequency. Different from the
   * cascade-shift on save (which preserves relative spacing): this
   * IGNORES the existing scheduledDate values and recomputes them
   * fresh, mirroring `createSeriesFromPlan`'s spacing logic. Useful
   * when legacy bad dates persist regardless of how the pastor edits
   * the start date — a full recompute is the only way out.
   */
  const handleRecalcDates = async () => {
      if (!id || !originalSeries) return;
      const startDate = parseLocalDate(watchedValues.startDate);
      if (!startDate) {
          toast.error(t('form.messages.recalcNoStartDate') as string);
          return;
      }

      const planned = originalSeries.metadata?.plannedSermons ?? [];
      let rebuiltCount = 0;
      const updatedPlanned = planned.map((p) => {
          const isShiftable = !p.draftId && (!p.status || p.status === 'planned');
          if (!isShiftable) return p;
          const newScheduled = computeScheduledForWeek(startDate, p.week, frequency);
          rebuiltCount++;
          return { ...p, scheduledDate: newScheduled };
      });

      if (rebuiltCount === 0) {
          toast.info(t('form.messages.recalcNoShiftable') as string);
          return;
      }

      try {
          await seriesService.updateSeries(id, {
              metadata: { ...originalSeries.metadata, plannedSermons: updatedPlanned },
          } as any);
          toast.success(
              t('form.messages.recalcDone', { count: rebuiltCount }) as string,
          );
          // Refresh local copy so the next save sees the updated state.
          const refreshed = await seriesService.getSeries(id);
          if (refreshed) setOriginalSeries(refreshed);
      } catch (err) {
          console.error('[seriesForm] recalcDates failed:', err);
          toast.error(t('form.messages.recalcError') as string);
      }
  };

  useEffect(() => {
    if (id) {
      loadSeries();
    }
  }, [id]);

  const loadSeries = async () => {
    try {
      if (!id) return;
      const series = await seriesService.getSeries(id);
      if (series) {
        setOriginalSeries(series);
        reset({
          title: series.title,
          description: series.description,
          coverUrl: series.coverUrl || '',
          startDate: series.startDate ? new Date(series.startDate).toISOString().split('T')[0] : '',
          endDate: series.endDate ? new Date(series.endDate).toISOString().split('T')[0] : '',
        });
      }
    } catch (error) {
      console.error('Error loading series:', error);
      toast.error(t('form.messages.loadError'));
    } finally {
      setInitialLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('form.steps.visuals.errors.maxSize'));
      return;
    }

    setUploading(true);
    try {
      const path = `users/${user.uid}/series-covers/${Date.now()}_${file.name}`;
      const result = await storageService.uploadFile(file, path);
      // Targeted update via setValue. The previous `reset({...watchedValues, coverUrl})`
      // would replace the WHOLE form using a stale `watchedValues` snapshot, and the
      // RHF ref-based input registered for coverUrl wouldn't always re-render its DOM
      // value, leaving the preview blank even though the upload succeeded. setValue
      // updates just the one field, triggers watch() reliably, and marks the form
      // dirty so the "save changes" affordance reflects the edit.
      setValue('coverUrl', result.url, { shouldDirty: true, shouldValidate: true });
      toast.success(t('form.steps.visuals.errors.uploadSuccess'));
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(t('form.steps.visuals.errors.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setValue('coverUrl', '', { shouldDirty: true });
  };

  const onSubmit = async (data: SeriesFormData) => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Check limits for NEW plans
      if (!id) {
        const check = await checkCanCreatePreachingPlan();
        if (!check.allowed) {
          setLoading(false);
          setUpgradeReason({
            reason: 'limit_reached',
            limitType: 'plans',
            currentLimit: check.limit || 1
          });
          setShowUpgradeModal(true);
          return;
        }
      }
      
      const newStartDate = parseLocalDate(data.startDate);
      const newEndDate = parseLocalDate(data.endDate);

      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl,
        startDate: newStartDate,
        endDate: newEndDate,
      };

      if (id) {
        // Edit mode. If the pastor changed the start date AND there
        // are planned sermons that haven't started yet, shift them
        // by the same delta to preserve their relative spacing.
        // Sermons already in development (with a draftId, or whose
        // status moved past `planned`) keep their explicit dates —
        // those were intentional scheduling decisions and an auto-
        // shift would surprise the pastor.
        const oldStartDate = originalSeries?.startDate
            ? new Date(originalSeries.startDate)
            : undefined;
        const shiftedMetadata = computeShiftedMetadata(
            originalSeries,
            oldStartDate,
            newStartDate,
        );
        if (shiftedMetadata) {
            payload.metadata = shiftedMetadata.metadata;
            if (shiftedMetadata.shiftedCount > 0) {
                toast.info(
                    t('form.messages.shiftedSermons', {
                        count: shiftedMetadata.shiftedCount,
                        days: Math.abs(shiftedMetadata.deltaDays),
                    }) as string,
                );
            } else if (shiftedMetadata.healedCount > 0) {
                // Silent heal — toast only the first time so the
                // pastor knows the legacy bug got auto-corrected.
                toast.info(
                    t('form.messages.healedSermons', {
                        count: shiftedMetadata.healedCount,
                    }) as string,
                );
            }
        }

        await seriesService.updateSeries(id, payload as any);
        toast.success(t('form.messages.updateSuccess'));
        navigate(`/dashboard/plans/${id}`);
      } else {
        // Create Mode
        const sermons = Array.from({ length: sermonCount }, (_, i) => ({
          title: `Sermón ${i + 1}`,
          description: '',
          week: i + 1,
          passage: ''
        }));

        const newSeries = await seriesService.createSeriesFromPlan(user.uid, {
          series: {
            ...payload,
            type: 'manual',
            resourceIds: [],
          },
          sermons: sermons,
          frequency: frequency // Pass frequency
        });

        toast.success(t('form.messages.saveSuccess', { count: sermonCount }));
        navigate(`/dashboard/plans/${newSeries.id}`);
      }
    } catch (error) {
      console.error('Error saving series:', error);
      toast.error(t('form.messages.saveError'));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(id ? `/dashboard/plans/${id}` : '/dashboard/plans')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {id ? t('form.titleEdit') : t('form.titleNew')}
          </h1>
          <p className="text-muted-foreground">
            {id ? t('form.subtitleEdit') : t('form.subtitleNew')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column: Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 shadow-sm border-muted">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Section: Identity */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                  {t('form.steps.identity.title')}
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-base">{t('form.steps.identity.labelTitle')}</Label>
                  <Input
                    id="title"
                    className="text-lg"
                    {...register('title', { required: t('form.steps.identity.errors.titleRequired'), minLength: { value: 3, message: t('form.steps.identity.errors.titleMinLength') } })}
                    placeholder={t('form.steps.identity.labelTitlePlaceholder')}
                  />
                  {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t('form.steps.identity.labelDescription')}</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder={t('form.steps.identity.labelDescriptionPlaceholder')}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-4">
                 <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                  {t('form.steps.planning.title')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t('form.steps.planning.frequency')}</Label>
                    <Select value={frequency} onValueChange={(val: any) => setFrequency(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.steps.planning.frequency')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">{t('form.steps.planning.frequencies.weekly')}</SelectItem>
                        <SelectItem value="biweekly">{t('form.steps.planning.frequencies.biweekly')}</SelectItem>
                        <SelectItem value="monthly">{t('form.steps.planning.frequencies.monthly')}</SelectItem>
                        <SelectItem value="flexible">{t('form.steps.planning.frequencies.flexible')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startDate">{t('form.steps.planning.startDate')} <span className="text-xs text-muted-foreground font-normal">{t('form.steps.planning.startDateOptional')}</span></Label>
                    <Input
                      id="startDate"
                      type="date"
                      {...register('startDate')}
                    />
                    {/* Edit-mode notice: changing the start date will
                        cascade-shift unstarted planned sermons by the
                        same delta. Sermons already in development keep
                        their scheduled dates. */}
                    {id && shiftablePlannedCount > 0 && (
                      <>
                        <p className="text-[11px] text-warning leading-snug">
                          {t('form.steps.planning.shiftHint', { count: shiftablePlannedCount })}
                        </p>
                        {/* Hard-rebuild escape hatch: when legacy bad
                            dates are stuck in the wrong calendar cell
                            and cascade-shift can't recover them
                            (delta=0 → no shift, heal preserves the
                            visible day), this button recomputes every
                            unstarted scheduledDate from startDate +
                            frequency. Same math as createSeriesFromPlan. */}
                        <button
                          type="button"
                          onClick={handleRecalcDates}
                          className="text-[11px] text-success hover:opacity-80 underline underline-offset-2"
                        >
                          {t('form.steps.planning.recalcButton', { count: shiftablePlannedCount })}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate" className="text-xs text-muted-foreground">{t('form.steps.planning.endDate')}</Label>
                    <Input
                      id="endDate"
                      type="date"
                      {...register('endDate')}
                      disabled
                      className="bg-muted/50"
                      placeholder={t('form.steps.planning.endDatePlaceholder')}
                    />
                  </div>
                </div>

                {/* Sermon Count - Only for New Series */}
                {!id && (
                  <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-muted-foreground/30 space-y-3">
                    <div className="flex justify-between items-center">
                       <Label htmlFor="sermonCount" className="font-medium text-base">{t('form.steps.planning.sermonCount')}</Label>
                       <span className="bg-background border rounded px-2 py-1 text-sm font-mono">{sermonCount}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Input
                        id="sermonCount"
                        type="range"
                        min="1"
                        max="12"
                        step="1"
                        value={sermonCount}
                        onChange={(e) => setSermonCount(parseInt(e.target.value))}
                        className="flex-1 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Trans
                        i18nKey="form.steps.planning.autoCreateNotice"
                        t={t}
                        values={{ 
                            count: sermonCount, 
                            range: `Sermón 1 - ${sermonCount}` 
                        }}
                        components={{ strong: <strong /> }}
                      />
                    </p>
                  </div>
                )}
              </div>

               <div className="h-px bg-border" />

              {/* Section: Visuals */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                  {t('form.steps.visuals.title')}
                </h3>
                
                <div className="space-y-4">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleImageUpload}
                    />

                    {!watchedValues.coverUrl ? (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors group"
                      >
                         <div className="bg-muted p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                            {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                         </div>
                         <p className="text-sm font-medium text-foreground">
                           {uploading ? t('form.steps.visuals.uploading') : t('form.steps.visuals.uploadPlaceholder')}
                         </p>
                         <p className="text-xs text-muted-foreground mt-1">{t('form.steps.visuals.formats')}</p>
                         
                         <div className="relative w-full flex items-center gap-2 my-4">
                            <div className="h-px bg-border flex-1"></div>
                            <span className="text-[10px] text-muted-foreground uppercase">{t('form.steps.visuals.pasteUrl')}</span>
                            <div className="h-px bg-border flex-1"></div>
                         </div>
                         
                         <Input
                            id="coverUrl"
                            {...register('coverUrl')}
                            placeholder="https://..."
                            className="text-xs h-8"
                            onClick={(e) => e.stopPropagation()} // Prevent triggering file upload
                         />
                      </div>
                    ) : (
                      <div className="relative group rounded-lg overflow-hidden border">
                         <img 
                           src={watchedValues.coverUrl} 
                           alt="Cover" 
                           className="w-full h-48 object-cover"
                         />
                         <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button 
                              type="button" 
                              variant="destructive" 
                              size="sm" 
                              onClick={removeImage}
                            >
                               <X className="h-4 w-4 mr-2" /> {t('form.steps.visuals.remove')}
                            </Button>
                            <Button 
                              type="button" 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => fileInputRef.current?.click()}
                            >
                               <Upload className="h-4 w-4 mr-2" /> {t('form.steps.visuals.change')}
                            </Button>
                         </div>
                      </div>
                    )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t mt-8 z-10">
                <Button type="button" variant="outline" onClick={() => navigate(id ? `/dashboard/plans/${id}` : '/dashboard/plans')}>
                  {t('form.buttons.cancel')}
                </Button>
                <Button type="submit" disabled={loading} size="lg" className="min-w-[150px]">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {id ? t('form.buttons.save') : t('form.buttons.create')}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Right Column: Live Preview */}
        <div className="lg:col-span-1 sticky top-8">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('form.preview.title')}</h3>
              
              {/* Preview Card. `!pt-0` overrides the shadcn Card default
                  `py-6` so the cover image hits the top edge cleanly
                  (the bottom padding stays intact, plus the per-section
                  spacing inside the body). overflow-hidden + rounded-xl
                  on the Card itself clip the image corners. */}
              <Card className="overflow-hidden shadow-lg border-muted group transition-all duration-500 hover:shadow-xl !pt-0">
                 <div className="h-48 w-full bg-muted relative overflow-hidden">
                    {watchedValues.coverUrl ? (
                      <img 
                        src={watchedValues.coverUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=2673&auto=format&fit=crop' }} 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50 text-muted-foreground">
                        <span className="text-sm">{t('form.preview.noCover')}</span>
                      </div>
                    )}
                 </div>
                 
                 <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                       <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider border rounded px-2 py-0.5">
                          {watchedValues.startDate ? new Date(watchedValues.startDate).toLocaleDateString(i18n.language || 'es', { month: 'short', year: 'numeric' }) : t('form.preview.datePending')}
                       </div>
                       {!id && (
                         <div className="bg-secondary text-secondary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                           {t('form.preview.sermonCountBadge', { count: sermonCount })}
                         </div>
                       )}
                    </div>

                    <div>
                      <h3 className="text-2xl font-bold font-serif leading-tight">
                         {watchedValues.title || t('form.preview.defaultTitle')}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                         {watchedValues.description || t('form.preview.defaultDescription')}
                      </p>
                    </div>
                 </div>
              </Card>

              {/* Helper Tip */}
              <div className="bg-primary/5 p-4 rounded-lg text-sm text-muted-foreground border border-primary/10">
                 <p className="leading-relaxed">
                   <strong>💡 {t('form.tips.pro')}</strong> {id ? t('form.tips.editMode') : t('form.tips.createMode')}
                 </p>
              </div>
            </div>
        </div>

      </div>
      
      {/* Upgrade Required Modal */}
      <UpgradeRequiredModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        reason={upgradeReason.reason}
        limitType={upgradeReason.limitType}
        currentLimit={upgradeReason.currentLimit}
      />
    </div>
  );
}

/**
 * Computes a new `metadata` object with shifted scheduledDates when
 * the pastor changes the series start date in edit mode. Returns
 * null when no shift is needed (no original series, no planned
 * sermons, no date change, etc.).
 *
 * Shift policy: ONLY plannedSermons with `status` undefined or
 * 'planned' AND no `draftId` are shifted. Sermons in development
 * keep their explicit dates because the pastor may have manually
 * scheduled them and a silent shift would be surprising.
 */
function computeShiftedMetadata(
    originalSeries: SermonSeriesEntity | null,
    oldStartDate: Date | undefined,
    newStartDate: Date | undefined,
): { metadata: any; shiftedCount: number; healedCount: number; deltaDays: number } | null {
    if (!originalSeries) return null;

    const planned = originalSeries.metadata?.plannedSermons ?? [];
    if (planned.length === 0) return null;

    // Two effects happen on every save:
    //   1. Shift: when start date moves by N days, planned sermons
    //      that haven't started yet move by N days too.
    //   2. Heal: every scheduledDate is normalized to local midnight
    //      via addDays(date, 0). This idempotently repairs legacy
    //      dates persisted with a non-midnight time component (the
    //      old UTC-midnight bug + the previous addDays that
    //      preserved time across shifts), which display on the wrong
    //      calendar cell in some browser timezones.
    const deltaDays =
        oldStartDate && newStartDate ? daysBetween(oldStartDate, newStartDate) : 0;

    let shiftedCount = 0;
    let healedCount = 0;
    const updatedPlanned = planned.map((p) => {
        if (!p.scheduledDate) return p;
        const isShiftable = !p.draftId && (!p.status || p.status === 'planned');
        const totalDelta = isShiftable ? deltaDays : 0;
        const original = new Date(p.scheduledDate);
        // Primero su DÍA (`fromStoredDate`): una fecha vieja a medianoche UTC
        // es su día UTC, no el día anterior local. Después el corrimiento.
        const next = addDays(fromStoredDate(original), totalDelta);

        if (totalDelta !== 0) shiftedCount++;
        else if (next.getTime() !== original.getTime()) healedCount++;

        return { ...p, scheduledDate: next };
    });

    if (shiftedCount === 0 && healedCount === 0) return null;

    return {
        metadata: { ...originalSeries.metadata, plannedSermons: updatedPlanned },
        shiftedCount,
        healedCount,
        deltaDays,
    };
}

/**
 * Computes a scheduledDate for sermon at `week` (1-indexed) given a
 * start date and frequency. Mirrors the per-week spacing logic in
 * `SeriesService.createSeriesFromPlan` so a "recalcular" rebuild
 * produces dates identical to a fresh series creation.
 *
 * Returns undefined for `flexible` (no calculated date — pastor
 * schedules manually).
 *
 * Always returns local-midnight Dates, regardless of the time
 * component on the input startDate.
 */
function computeScheduledForWeek(
    startDate: Date,
    week: number,
    freq: 'weekly' | 'biweekly' | 'monthly' | 'flexible',
): Date | undefined {
    if (freq === 'flexible') return undefined;
    const offset = Math.max(0, week - 1);
    const base = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    if (freq === 'weekly') base.setDate(base.getDate() + offset * 7);
    else if (freq === 'biweekly') base.setDate(base.getDate() + offset * 14);
    else if (freq === 'monthly') base.setMonth(base.getMonth() + offset);
    return base;
}

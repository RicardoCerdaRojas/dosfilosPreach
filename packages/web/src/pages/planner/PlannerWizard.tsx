import { ArrowLeft, ArrowRight, Book, Calendar as CalendarIcon, CheckCircle2, FileText, MessageSquare, RefreshCw, Save, Settings2, Sparkles, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownRenderer } from '@/components/canvas-chat/MarkdownRenderer';
import { PlannerLayout } from './PlannerLayout';
import { PlannerField } from './PlannerField';
import { BiblePassageViewer, BibleReference } from '@/components/bible/BiblePassageViewer';
import { useTranslation } from '@/i18n';
import { UpgradeRequiredModal } from '@/components/upgrade';
import { usePlannerWizard } from './hooks/usePlannerWizard';
import { toast } from 'sonner';

export function PlannerWizard() {
    const { t } = useTranslation('planner');
    
    const {
        // State
        step, setStep,
        loading,
        showUpgradeModal, setShowUpgradeModal,
        upgradeReason,
        resources, indexStatus,
        
        // Form Data
        strategy, setStrategy,
        topicOrBook, setTopicOrBook,
        subtopicsOrRange, setSubtopicsOrRange,
        numberOfSermons, setNumberOfSermons,
        startDate, setStartDate,
        endDate, setEndDate,
        frequency, setFrequency,
        selectedResources, setSelectedResources,
        plannerNotes, setPlannerNotes,
        
        // Generated Data
        seriesObjective, setSeriesObjective,
        proposedPlan,
        refiningSection, setRefiningSection,
        isReformulating,
        isChatOpen, setIsChatOpen,
        selectedBibleRef, setSelectedBibleRef,

        // Handlers
        handleGenerateObjective,
        handleGenerateStructure,
        handleFinalize,
        updateSermon,
        handleRefine,
        handleReformulate
    } = usePlannerWizard();

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-4 text-center space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 border-4 border-muted rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                    <Wand2 className="absolute inset-0 m-auto h-8 w-8 text-primary animate-pulse" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-semibold">
                        {step === 'strategy' || step === 'context' ? t('loading.analyzingContext') : t('loading.designingStructure')}
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        {t('loading.working')}
                    </p>
                </div>
            </div>
        );
    }

    const wizardContent = (
        <div className="w-full h-full py-8 px-4 md:px-8 lg:px-12">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
                    <Wand2 className="h-8 w-8 text-primary" />
                    {t('title')}
                </h1>
                <p className="text-muted-foreground mt-2">
                    {t('subtitle')}
                </p>
            </div>

            {/* Progress Steps */}
            <div className="flex justify-center mb-8 gap-2 overflow-x-auto">
                {[t('steps.strategy'), t('steps.context'), t('steps.objective'), t('steps.structure')].map((label, idx) => {
                    const isActive = (step === 'strategy' && idx === 0) ||
                                   (step === 'context' && idx === 1) ||
                                   (step === 'objective' && idx === 2) ||
                                   (step === 'structure' && idx === 3);
                    const isCompleted = (step === 'context' && idx < 1) ||
                                      (step === 'objective' && idx < 2) ||
                                      (step === 'structure' && idx < 3);
                    
                    return (
                        <div key={label} className={`flex items-center gap-2 text-sm whitespace-nowrap ${
                            isActive || isCompleted ? 'text-primary font-medium' : 'text-muted-foreground'
                        }`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                                isActive || isCompleted ? 'bg-primary-solid text-primary-foreground border-primary' : 'border-muted'
                            }`}>
                                {idx + 1}
                            </div>
                            {label}
                            {idx < 3 && <div className="w-8 h-px bg-muted mx-2" />}
                        </div>
                    );
                })}
            </div>

            <Card className="border-2 border-muted/50 shadow-lg">
                <CardContent className="pt-6">
                    {step === 'strategy' && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <Label className="text-lg">{t('planType.question')}</Label>
                                <RadioGroup value={strategy} onValueChange={(v: any) => setStrategy(v)} className="grid md:grid-cols-2 gap-4">
                                    <div className={`flex flex-col p-4 border-2 rounded-lg cursor-pointer hover:border-primary/50 transition-all ${strategy === 'thematic' ? 'border-primary bg-primary/5' : 'border-muted'}`} onClick={() => setStrategy('thematic')}>
                                        <RadioGroupItem value="thematic" id="thematic" className="sr-only" />
                                        <Sparkles className="h-6 w-6 mb-2 text-primary" />
                                        <span className="font-semibold">{t('planType.thematic')}</span>
                                        <span className="text-sm text-muted-foreground mt-1">
                                            {t('planType.thematicDescription')}
                                        </span>
                                    </div>
                                    <div className={`flex flex-col p-4 border-2 rounded-lg cursor-pointer hover:border-primary/50 transition-all ${strategy === 'expository' ? 'border-primary bg-primary/5' : 'border-muted'}`} onClick={() => setStrategy('expository')}>
                                        <RadioGroupItem value="expository" id="expository" className="sr-only" />
                                        <Book className="h-6 w-6 mb-2 text-primary" />
                                        <span className="font-semibold">{t('planType.expository')}</span>
                                        <span className="text-sm text-muted-foreground mt-1">
                                            {t('planType.expositoryDescription')}
                                        </span>
                                    </div>
                                </RadioGroup>
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={() => setStep('context')} size="lg">
                                    {t('buttons.next')} <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'context' && (
                        <div className="space-y-6">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="topic">
                                        {strategy === 'thematic' ? t('context.mainTheme') : t('context.biblicalBook')}
                                    </Label>
                                    <Input 
                                        id="topic" 
                                        placeholder={strategy === 'thematic' ? t('context.mainThemePlaceholder') : t('context.biblicalBookPlaceholder')}
                                        value={topicOrBook}
                                        onChange={e => setTopicOrBook(e.target.value)}
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="subtopics">
                                        {strategy === 'thematic' ? t('context.subtopics') : t('context.chapterRange')}
                                    </Label>
                                    <Input 
                                        id="subtopics" 
                                        placeholder={strategy === 'thematic' ? t('context.subtopicsPlaceholder') : t('context.chapterRangePlaceholder')}
                                        value={subtopicsOrRange}
                                        onChange={e => setSubtopicsOrRange(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="count">{t('context.sermonCount')}</Label>
                                        <Input 
                                            id="count" 
                                            type="number" 
                                            min={1} 
                                            max={52}
                                            placeholder="Auto"
                                            value={numberOfSermons}
                                            onChange={e => setNumberOfSermons(e.target.value === '' ? '' : parseInt(e.target.value))}
                                        />
                                        <p className="text-[10px] text-muted-foreground">{t('context.leaveEmptyAuto')}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="frequency">{t('context.frequency')}</Label>
                                        <Select value={frequency || 'flexible'} onValueChange={(v: any) => setFrequency(v === 'flexible' ? undefined : v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('context.selectFrequency')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="weekly">{t('context.weekly')}</SelectItem>
                                                <SelectItem value="biweekly">{t('context.biweekly')}</SelectItem>
                                                <SelectItem value="monthly">{t('context.monthly')}</SelectItem>
                                                <SelectItem value="flexible">{t('context.flexible')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="start">{t('context.startDate')}</Label>
                                        <div className="relative">
                                            <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                id="start" 
                                                type="date" 
                                                className="pl-9"
                                                value={startDate}
                                                onChange={e => setStartDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="end">{t('context.endDate')}</Label>
                                        <div className="relative">
                                            <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                id="end" 
                                                type="date" 
                                                className="pl-9"
                                                value={endDate}
                                                onChange={e => setEndDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base">{t('context.library')}</Label>
                                        <div className="flex items-center space-x-2">
                                            <Switch 
                                                id="select-all"
                                                checked={resources.length > 0 && selectedResources.length === resources.length}
                                                onCheckedChange={(checked) => {
                                                    if (checked) setSelectedResources(resources.map(r => r.id));
                                                    else setSelectedResources([]);
                                                }}
                                            />
                                            <label htmlFor="select-all" className="text-sm font-medium leading-none cursor-pointer text-muted-foreground">
                                                {t('context.selectAll')}
                                            </label>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {t('context.selectResources')}
                                    </p>
                                    {resources.length === 0 ? (
                                        <div className="text-sm text-muted-foreground italic p-4 bg-muted/30 rounded border border-dashed text-center">
                                            {t('context.noResources')}
                                        </div>
                                    ) : (
                                        <div className="grid gap-2 max-h-48 overflow-y-auto p-2 border rounded bg-muted/10">
                                            {resources.map(res => (
                                                <div key={res.id} className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id={res.id} 
                                                        checked={selectedResources.includes(res.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) setSelectedResources([...selectedResources, res.id]);
                                                            else setSelectedResources(selectedResources.filter(id => id !== res.id));
                                                        }}
                                                    />
                                                        <label htmlFor={res.id} className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2">
                                                            {res.title}
                                                            {indexStatus[res.id] && (
                                                                <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 bg-emerald-50">
                                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                                    {t('context.indexed')}
                                                                </Badge>
                                                            )}
                                                        </label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Enfoque/Notas section */}
                                <div className="space-y-3 pt-4 border-t">
                                    <div className="space-y-2">
                                        <Label htmlFor="notes" className="text-base flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4" />
                                            {t('context.focus')}
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            {t('context.focusDescription')}
                                        </p>
                                        <Textarea 
                                            id="notes"
                                            value={plannerNotes}
                                            onChange={e => setPlannerNotes(e.target.value)}
                                            placeholder={t('context.focusPlaceholder')}
                                            className="min-h-[120px] resize-y"
                                            rows={5}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4">
                                <Button variant="outline" onClick={() => setStep('strategy')}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> {t('buttons.back')}
                                </Button>
                                <div className="flex gap-2">
                                    {seriesObjective && (
                                        <Button variant="outline" onClick={() => setStep('objective')}>
                                            {t('context.continueWithCurrent')} <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button onClick={handleGenerateObjective} disabled={!topicOrBook} size="lg" className="bg-gradient-to-r from-primary to-purple-600 text-white border-0">
                                        <Wand2 className="mr-2 h-4 w-4" /> {seriesObjective ? t('context.regenerateProposal') : t('context.generateProposal')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'objective' && seriesObjective && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                                    <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
                                        <Sparkles className="h-4 w-4" /> {t('objective.assistantProposal')}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {t('objective.assistantProposalDescription')}
                                    </p>
                                    
                                    {seriesObjective.pastoralAdvice && (
                                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm space-y-3">
                                            <div className="flex gap-2 items-start">
                                                <Sparkles className="h-4 w-4 mt-1 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <span className="font-semibold block mb-2">{t('objective.expertNote')}</span>
                                                    <div className="prose prose-sm prose-amber max-w-none">
                                                        <MarkdownRenderer content={seriesObjective.pastoralAdvice} />
                                                    </div>
                                                    
                                                    {seriesObjective.suggestedSermonCount && (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm"
                                                            className="bg-white border-amber-300 hover:bg-amber-100 text-amber-900 h-8 mt-3"
                                                            onClick={() => {
                                                                setNumberOfSermons(seriesObjective.suggestedSermonCount!);
                                                                toast.success(t('objective.toastUpdated', { count: seriesObjective.suggestedSermonCount }));
                                                            }}
                                                        >
                                                            {t('objective.updateSermonCount', { count: seriesObjective.suggestedSermonCount })}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-6">
                                {refiningSection && (
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4 flex justify-between items-center">
                                        <div className="flex items-center gap-2 text-blue-800">
                                            <Sparkles className="h-5 w-5" />
                                            <span className="font-medium">{t('objective.refinementMode', { section: refiningSection })}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={handleReformulate} className="bg-white hover:bg-blue-50 text-blue-700 border-blue-200">
                                                <RefreshCw className="mr-2 h-3 w-3" /> {t('objective.askReformulation')}
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => setRefiningSection(null)} className="text-blue-700 hover:bg-blue-100 hover:text-blue-900">
                                                <X className="mr-2 h-3 w-3" /> {t('objective.exitFocusMode')}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {(!refiningSection || refiningSection === 'Título de la Serie') && (
                                    <PlannerField 
                                        title="Título de la Serie"
                                        content={seriesObjective.title}
                                        onSave={(val) => setSeriesObjective({...seriesObjective, title: val})}
                                        onRefine={() => handleRefine('Título de la Serie', seriesObjective.title)}
                                        minHeight="min-h-[60px]"
                                        isLoading={isReformulating && refiningSection === 'Título de la Serie'}
                                    />
                                )}

                                {(!refiningSection || refiningSection === 'Descripción') && (
                                    <PlannerField 
                                        title="Descripción"
                                        content={seriesObjective.description}
                                        onSave={(val) => setSeriesObjective({...seriesObjective, description: val})}
                                        onRefine={() => handleRefine('Descripción', seriesObjective.description)}
                                        isLoading={isReformulating && refiningSection === 'Descripción'}
                                    />
                                )}

                                {(!refiningSection || refiningSection === 'Objetivo General') && (
                                    <PlannerField 
                                        title="Objetivo General"
                                        content={seriesObjective.objective}
                                        onSave={(val) => setSeriesObjective({...seriesObjective, objective: val})}
                                        onRefine={() => handleRefine('Objetivo General', seriesObjective.objective)}
                                        minHeight="min-h-[150px]"
                                        isLoading={isReformulating && refiningSection === 'Objetivo General'}
                                    />
                                )}
                            </div>
                            </div>

                            <div className="flex justify-between pt-4">
                                <Button variant="outline" onClick={() => setStep('context')}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> {t('buttons.back')}
                                </Button>
                                <Button onClick={handleGenerateStructure} size="lg">
                                    {t('objective.continueToStructure')} <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'structure' && proposedPlan && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold">{t('structure.sermonStructure')}</h3>
                                <Button variant="ghost" size="sm" onClick={handleGenerateStructure}>
                                    <RefreshCw className="mr-2 h-4 w-4" /> {t('structure.regenerate')}
                                </Button>
                            </div>

                            <Tabs defaultValue="summary" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="summary" className="flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        {t('structure.tabSummary')}
                                    </TabsTrigger>
                                    <TabsTrigger value="refinement" className="flex items-center gap-2">
                                        <Settings2 className="h-4 w-4" />
                                        {t('structure.tabRefinement')}
                                    </TabsTrigger>
                                </TabsList>

                                {/* Summary View - Document Style */}
                                <TabsContent value="summary" className="mt-6">
                                    <div className="prose prose-sm max-w-none dark:prose-invert">
                                        {/* Justification Section */}
                                        {proposedPlan.structureJustification && (
                                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-5 mb-6">
                                                <div className="flex items-center gap-2 text-primary mb-3">
                                                    <Sparkles className="h-5 w-5" />
                                                    <h4 className="font-semibold text-base m-0">{t('structure.structureJustification')}</h4>
                                                </div>
                                                <div className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                                                    {proposedPlan.structureJustification}
                                                </div>
                                            </div>
                                        )}

                                        {/* Series Overview */}
                                        <div className="border-b pb-4 mb-6">
                                            <h4 className="text-lg font-semibold text-foreground mb-1">
                                                {seriesObjective?.title}
                                            </h4>
                                            <p className="text-muted-foreground text-sm">
                                                {t('structure.seriesInfo', { count: proposedPlan.sermons.length, date: startDate })}
                                            </p>
                                        </div>

                                        {/* Sermons List - Document Style */}
                                        <div className="space-y-5">
                                            {proposedPlan.sermons.map((sermon, idx) => (
                                                <div key={idx} className="group">
                                                    <div className="flex items-start gap-4">
                                                        <div className="flex-shrink-0 w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-semibold">
                                                            {idx + 1}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h5 className="font-semibold text-foreground m-0 text-base">
                                                                {sermon.title}
                                                            </h5>
                                                            {sermon.passage && (
                                                                <div className="mt-1">
                                                                    <BibleReference 
                                                                        reference={sermon.passage}
                                                                        onClick={setSelectedBibleRef}
                                                                    />
                                                                </div>
                                                            )}
                                                            {!sermon.passage && (
                                                                <span className="inline-flex items-center gap-1 text-sm text-amber-600 mt-1">
                                                                    {t('structure.noPassage')}
                                                                </span>
                                                            )}
                                                            <p className="text-muted-foreground text-sm mt-2 m-0 leading-relaxed">
                                                                {sermon.description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {idx < proposedPlan.sermons.length - 1 && (
                                                        <div className="ml-4 border-l-2 border-dashed border-muted h-4 mt-2"></div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Fuentes Consultadas Section */}
                                        {proposedPlan.citations && proposedPlan.citations.length > 0 && (
                                            <div className="mt-8 pt-6 border-t">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Book className="h-5 w-5 text-primary" />
                                                    <h4 className="font-semibold text-base text-foreground m-0">Fuentes Consultadas</h4>
                                                </div>
                                                <div className="space-y-3">
                                                    {proposedPlan.citations.map((citation, idx) => (
                                                        <div 
                                                            key={citation.id || idx}
                                                            className={`flex items-start gap-3 p-3 rounded-lg ${
                                                                citation.sourceType === 'library' 
                                                                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                                                                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                                                            }`}
                                                        >
                                                            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                                                citation.sourceType === 'library'
                                                                    ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300'
                                                                    : 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300'
                                                            }`}>
                                                                {citation.sourceType === 'library' ? '📚' : '💡'}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                                                        citation.sourceType === 'library'
                                                                            ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300'
                                                                            : 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300'
                                                                    }`}>
                                                                        {citation.sourceType === 'library' ? t('structure.sourceLibrary') : t('structure.sourceGeneral')}
                                                                    </span>
                                                                </div>
                                                                {citation.sourceType === 'library' && (
                                                                    <p className="text-sm font-medium text-foreground mt-1 m-0">
                                                                        {citation.resourceAuthor} — <em>{citation.resourceTitle}</em>
                                                                        {citation.page && <span className="text-muted-foreground"> (p. {citation.page})</span>}
                                                                    </p>
                                                                )}
                                                                {citation.text && (
                                                                    <p className="text-sm text-muted-foreground mt-1 m-0">{citation.text}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-4 italic">
                                                    {t('structure.sourcesDisclaimer')}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bible Passage Viewer */}
                                    <BiblePassageViewer 
                                        reference={selectedBibleRef}
                                        onClose={() => setSelectedBibleRef(null)}
                                    />
                                </TabsContent>

                                {/* Refinement View - Editable Fields */}
                                <TabsContent value="refinement" className="mt-6">
                                    <div className="space-y-4">
                                        {proposedPlan.sermons.map((sermon, idx) => (
                                            <Card key={idx} className="border border-muted p-4 space-y-4">
                                                <div className="flex items-center justify-between border-b pb-2">
                                                    <span className="font-semibold text-muted-foreground">Sermón {idx + 1}</span>
                                                </div>
                                                
                                                <PlannerField 
                                                    title="Título"
                                                    content={sermon.title}
                                                    onSave={(val) => updateSermon(idx, 'title', val)}
                                                    onRefine={() => handleRefine(`Sermón ${idx + 1}: Título`, sermon.title)}
                                                    minHeight="min-h-[50px]"
                                                />

                                                <PlannerField 
                                                    title="Pasaje Bíblico"
                                                    content={sermon.passage || ''}
                                                    onSave={(val) => updateSermon(idx, 'passage', val)}
                                                    onRefine={() => handleRefine(`Sermón ${idx + 1}: Pasaje Bíblico`, sermon.passage || '')}
                                                    minHeight="min-h-[40px]"
                                                />

                                                <PlannerField 
                                                    title="Descripción"
                                                    content={sermon.description}
                                                    onSave={(val) => updateSermon(idx, 'description', val)}
                                                    onRefine={() => handleRefine(`Sermón ${idx + 1}: Descripción`, sermon.description)}
                                                />
                                            </Card>
                                        ))}
                                    </div>
                                </TabsContent>
                            </Tabs>

                            <div className="flex justify-between pt-4">
                                <Button variant="outline" onClick={() => setStep('objective')}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> {t('buttons.back')}
                                </Button>
                                <Button onClick={handleFinalize} size="lg" className="bg-primary-solid text-primary-foreground">
                                    <Save className="mr-2 h-4 w-4" /> {t('structure.finalizeAndSave')}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );

    return (
        <PlannerLayout 
            context={{
                type: strategy,
                topicOrBook,
                // For chat: use ALL indexed resources (full library access for research)
                // Selected resources only affect plan generation, not chat assistance
                resources: resources.filter(r => indexStatus[r.id] === true)
            }}
            isChatOpen={isChatOpen}
            onChatOpenChange={setIsChatOpen}
        >
            {wizardContent}
            
            {/* Upgrade Required Modal */}
            <UpgradeRequiredModal
                open={showUpgradeModal}
                onOpenChange={setShowUpgradeModal}
                reason={upgradeReason.reason}
                limitType={upgradeReason.limitType}
                currentLimit={upgradeReason.currentLimit}
            />
        </PlannerLayout>
    );
}

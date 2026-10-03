import { useState } from 'react';
import { ArrowLeft, FileCheck2, Sparkles } from 'lucide-react';
import type { ExegeticalPaper } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import {
    ExtractSourceTabs,
    RubricExtractFromDocumentPanel,
    RubricExtractFromTextPanel,
    RubricSetupChooser,
} from './RubricOriginChooser';
import { rubricLabel } from './rubricLabel';

/**
 * La rúbrica, desde el encabezado del setup, junto a Encuadre y Portada.
 *
 * Cambiar de dónde sale la rúbrica estaba escondido: un texto chico bajo el
 * título del paso. Pedido del fundador (Jonás 4:5-11): un botón en la
 * botonera que abra las opciones en un modal. Dice cuál rúbrica está en uso.
 *
 * Un solo diálogo con dos vistas —elegir, extraer— en vez de dos diálogos
 * anidados: Radix los apila mal y el foco se pierde.
 */
export function PaperRubricButton({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const [open, setOpen] = useState(false);
    const [vista, setVista] = useState<'elegir' | 'texto' | 'documento'>('elegir');
    const rubric = paper.rubric;

    const abrir = (v: boolean) => {
        setOpen(v);
        if (!v) setVista('elegir');
    };

    return (
        <>
            <Button type="button" size="sm" variant="outline" onClick={() => abrir(true)} className="gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5" />
                {t('paperSetup.rubricButton.label')}
                {rubric && (
                    <span className="text-[11px] text-muted-foreground">· {rubricLabel(rubric, t)}</span>
                )}
            </Button>
            <Dialog open={open} onOpenChange={abrir}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="inline-flex items-center gap-2">
                            {vista !== 'elegir' && <Sparkles className="h-4 w-4 text-success" />}
                            {vista === 'elegir'
                                ? t('paperSetup.subSteps.rubric.chooser.title')
                                : t('paperSetup.subSteps.rubric.extract.title')}
                        </DialogTitle>
                        <DialogDescription>
                            {vista === 'elegir'
                                ? t('paperSetup.subSteps.rubric.description')
                                : t('paperSetup.subSteps.rubric.extract.subtitle')}
                        </DialogDescription>
                    </DialogHeader>
                    {vista === 'elegir' && rubric && (
                        <RubricSetupChooser
                            paper={paper}
                            rubric={rubric}
                            onPhotoOrPdf={() => setVista('documento')}
                            onPasteText={() => setVista('texto')}
                        />
                    )}
                    {vista !== 'elegir' && (
                        <div className="space-y-3">
                            <Button type="button" variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => setVista('elegir')}>
                                <ArrowLeft className="h-3.5 w-3.5" />
                                {t('paperSetup.rubricButton.back')}
                            </Button>
                            <ExtractSourceTabs
                                initialTab={vista === 'documento' ? 'document' : 'text'}
                                text={<RubricExtractFromTextPanel paper={paper} onExtracted={() => abrir(false)} />}
                                document={<RubricExtractFromDocumentPanel paper={paper} onExtracted={() => abrir(false)} />}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

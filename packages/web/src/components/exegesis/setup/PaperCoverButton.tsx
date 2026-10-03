import { useState } from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
import { hasCover, paperIsDelivered, type ExegeticalPaper } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { PaperCoverPanel } from './PaperCoverPanel';

/**
 * La portada, desde el encabezado del setup.
 *
 * Se consulta poco y se edita una vez por trabajo: en el panel lateral
 * ocupaba el espacio que el encuadre —que se consulta todo el tiempo—
 * necesita. El botón dice si ya está, para que su ausencia no se descubra al
 * exportar.
 */
export function PaperCoverButton({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const [open, setOpen] = useState(false);
    const lista = hasCover(paper.cover);

    return (
        <>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {t('paperSetup.cover.button')}
                {lista
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-label={t('paperSetup.cover.ready')} />
                    // Un estudio para predicar no se entrega: sin portada no
                    // «falta» nada (Jonás 4:5-11). El botón queda para quien
                    // quiera imprimirlo con portada igual.
                    : paperIsDelivered(paper)
                        ? <span className="text-[11px] text-warning-subtle-foreground">· {t('paperSetup.cover.missing')}</span>
                        : null}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t('paperSetup.cover.heading')}</DialogTitle>
                        <DialogDescription>{t('paperSetup.cover.description')}</DialogDescription>
                    </DialogHeader>
                    <PaperCoverPanel paper={paper} embedded />
                </DialogContent>
            </Dialog>
        </>
    );
}

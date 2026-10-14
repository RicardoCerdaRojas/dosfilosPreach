import type { ReactNode } from 'react';
import type { CitationPageKind } from '@dosfilos/domain';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { SourceViewerBody } from './SourceViewerBody';

/**
 * El libro detrás de una cita, abierto en la página citada y con la frase
 * señalada, con sitio para hojear y para el problema que se vino a
 * resolver.
 *
 * Existe porque comprobar una cita costaba cinco pasos —ir a la
 * biblioteca, buscar el libro, abrirlo, buscar la página, buscar la
 * frase— y nadie los da por costumbre. Por eso una atribución invertida a
 * un diccionario teológico sobrevivió meses en un paper: era verificable
 * en teoría y nadie la verificaba.
 *
 * La primera versión mostraba una sola hoja fija. Servía para confirmar
 * una cita buena y de nada para arreglar una mala: el verificador decía
 * «la p. 440 habla de Hifil, no de Polel» y el visor dejaba al lector en
 * la 440 sin poder ir a buscar el Polel ni ver, mientras leía, qué era lo
 * que buscaba. Por eso hojea, va a un folio, y admite un panel al lado
 * (`aside`) con el veredicto y la revisión.
 */
export interface CitationTarget {
    /** Clave de cita tal como aparece en el análisis, p. ej. "Adamson". */
    sourceKey: string;
    /**
     * Número que declara la cita. Desde las citas ancladas es la PÁGINA
     * IMPRESA cuando `pageKind` es `'printed'`; si no, la hoja del archivo.
     */
    page: number;
    /**
     * Qué es `page`. Ausente = hoja, que es lo que decían todas las citas
     * antes de la calibración. Con `'printed'` el visor convierte a hoja
     * con la calibración confirmada del libro: en Waltke-O'Connor la p. 440
     * es la hoja 458, y abrir la hoja 440 (que imprime 422) mandaba al
     * lector a otro capítulo.
     */
    pageKind?: CitationPageKind;
    /** La sección citada, en un libro sin páginas impresas (`pageKind: 'section'`). */
    locator?: string;
    /** Frase textual registrada, cuando el análisis guardó una. */
    verbatimQuote?: string | null;
    /**
     * El recurso de la biblioteca, cuando se abre el libro y no una cita: la
     * tarjeta de una fuente, la Biblioteca. Con él no hace falta un trabajo.
     */
    resourceId?: string;
    /** El nombre del libro, cuando no hay trabajo de donde sacarlo. */
    label?: string;
}

/** Lo que el visor sabe de la hoja que se está mirando, para quien la acompaña. */
export interface ViewedSheet {
    sheet: number;
    printed: string | number | null;
    /** Si es la hoja donde la cita dijo estar. */
    isAnchor: boolean;
}

export interface CitationSourceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** `null` en la Biblioteca: el libro se abre sin trabajo. */
    paperId: string | null;
    citation: CitationTarget | null;
    /**
     * Panel a la derecha del libro: el problema de la cita y su revisión.
     * Recibe la hoja que se mira para que pueda proponer «está aquí».
     */
    aside?: (viewed: ViewedSheet) => ReactNode;
    /** Botones extra del encabezado (p. ej. «volver al panel»). */
    actions?: ReactNode;
}

/** El visor ampliado: el mismo cuerpo que el panel, en una ventana grande. */
export function CitationSourceModal({ open, onOpenChange, paperId, citation, aside, actions }: CitationSourceModalProps) {
    const { t } = useTranslation('exegesis');
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!max-w-none w-[95vw] h-[92vh] p-0 flex flex-col gap-0">
                <DialogDescription className="sr-only">{t('sourceViewer.description')}</DialogDescription>
                <SourceViewerBody
                    paperId={paperId}
                    target={citation}
                    open={open}
                    layout="full"
                    aside={aside}
                    actions={actions}
                    renderTitle={title => <DialogTitle className="text-base">{title}</DialogTitle>}
                />
            </DialogContent>
        </Dialog>
    );
}

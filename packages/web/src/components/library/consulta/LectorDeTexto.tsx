import { useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FuenteDeConsulta } from '@dosfilos/infrastructure';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTextoDeSeccion } from '@/hooks/library/useTextoDeSeccion';
import { TextoConEscrituras } from './TextoConEscrituras';
import { seccionDeLaFuente } from './seccionDeLaFuente';

/**
 * Lector de un libro SIN hojas (A8c): JFB es texto convertido, no tiene PDF,
 * y el visor se quedaba «Abriendo el documento…» y citaba «hoja 1». Muestra
 * el comentario completo de la sección y su cita por sección.
 */
export function LectorDeTexto({ fuente, cita, onCerrar }: {
    fuente: FuenteDeConsulta | null;
    /** La cita de la fuente, ya rotulada: «(Jamieson, § JAS 3:17)». */
    cita: string;
    onCerrar: () => void;
}) {
    const { t } = useTranslation('library');
    const seccion = fuente ? seccionDeLaFuente(fuente) : null;
    const texto = useTextoDeSeccion(fuente?.resourceId ?? null, seccion);
    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(cita);
            toast.success(t('consult.reader.copied'));
        } catch {
            toast.error(t('consult.reader.copyFailed'));
        }
    };
    return (
        <Dialog open={!!fuente} onOpenChange={abierto => { if (!abierto) onCerrar(); }}>
            <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
                <DialogHeader className="border-b border-border px-6 py-4 text-left">
                    <DialogTitle className="font-serif text-xl">{fuente?.titulo}</DialogTitle>
                    <DialogDescription>
                        {[fuente?.autor, seccion && `§ ${seccion}`].filter(Boolean).join(' · ')}
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[55vh] overflow-y-auto px-6 py-5">
                    {texto.isLoading ? (
                        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('consult.reader.loading')}
                        </p>
                    ) : texto.isError ? (
                        <p className="text-sm text-destructive">{t('consult.reader.failed')}</p>
                    ) : texto.data ? (
                        <div className="whitespace-pre-line font-serif text-[16px] leading-[1.8] text-foreground">
                            <TextoConEscrituras texto={texto.data} />
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">{t('consult.reader.empty')}</p>
                    )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-6 py-4">
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{t('consult.reader.noPages')}</p>
                        <p className="font-serif text-base font-semibold text-foreground">{cita}</p>
                    </div>
                    <Button onClick={() => void copiar()}>
                        <Copy className="mr-2 h-4 w-4" aria-hidden />{t('consult.reader.copy')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/** El estado del lector, para la página que abre fuentes. */
export function useLectorDeTexto() {
    const [fuente, setFuente] = useState<FuenteDeConsulta | null>(null);
    return { fuente, abrir: setFuente, cerrar: () => setFuente(null) };
}

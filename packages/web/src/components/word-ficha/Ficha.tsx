import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { SECCIONES, type FichaBloque, type FichaRegistro, type FichaSeccion } from './fichaRegistro';

/**
 * El armazón de la ficha de palabra, común al hebreo y al griego. Recorre el
 * registro de bloques: el armazón no sabe qué datos hay, sólo dónde van.
 */

const visibles = <D,>(registro: FichaRegistro<D>, d: D, seccion: FichaSeccion) =>
    registro.filter(b => b.seccion === seccion && b.hay(d));

function Bloques<D>({ bloques, d, corto = false }: { bloques: readonly FichaBloque<D>[]; d: D; corto?: boolean }) {
    return (
        <>
            {bloques.map(b => {
                const C = corto ? b.Corto : b.Completo;
                return C ? <div key={b.id} data-ficha-bloque={b.id}><C d={d} /></div> : null;
            })}
        </>
    );
}

/** El encabezado: la palabra y sus insignias en una fila, la traducción debajo y en grande. */
function Encabezado<D>({ registro, d, corto }: { registro: FichaRegistro<D>; d: D; corto: boolean }) {
    const enc = visibles(registro, d, 'encabezado').filter(b => !corto || b.Corto);
    const de = (lugar: string) => enc.filter(b => (b.lugar ?? 'insignia') === lugar);
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5"><Bloques bloques={de('titulo')} d={d} corto={corto} /></div>
                <div className="flex shrink-0 flex-col items-end gap-1.5"><Bloques bloques={de('insignia')} d={d} corto={corto} /></div>
            </div>
            <div className={cn('font-extrabold leading-tight tracking-tight', corto ? 'text-lg' : 'text-2xl')}>
                <Bloques bloques={de('traduccion')} d={d} corto={corto} />
            </div>
        </div>
    );
}

/** La ficha completa: encabezado y, debajo, cada sección con lo que tenga. */
export function FichaCompleta<D>({ registro, d }: { registro: FichaRegistro<D>; d: D }) {
    const { t } = useTranslation('languageStructure');
    return (
        <div className="flex flex-col" data-testid="ficha-completa">
            <div className="border-b border-border px-6 pb-4 pt-1"><Encabezado registro={registro} d={d} corto={false} /></div>
            <div className="flex flex-col px-6 pb-6">
                {SECCIONES.filter(s => s !== 'encabezado').map((s, k, todas) => {
                    const bloques = visibles(registro, d, s);
                    if (!bloques.length) return null;
                    const ultima = todas.slice(k + 1).every(x => !visibles(registro, d, x).length);
                    return (
                        <section key={s} className={cn('flex flex-col gap-3 py-4', !ultima && 'border-b border-border')} data-ficha-seccion={s}>
                            {s !== 'acciones' && (
                                <h3 className="m-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t(`wordFicha.sections.${s}`)}</h3>
                            )}
                            <Bloques bloques={bloques} d={d} />
                        </section>
                    );
                })}
            </div>
        </div>
    );
}

/** El resumen: lo que se lee de un vistazo. En el tooltip y en la tarjeta resumen. */
export function FichaResumen<D>({ registro, d, pie }: { registro: FichaRegistro<D>; d: D; pie?: React.ReactNode }) {
    const lineas = registro.filter(b => b.seccion !== 'encabezado' && b.Corto && b.hay(d));
    return (
        <div className="flex flex-col" data-testid="ficha-resumen">
            <div className="px-4 pb-3 pt-3"><Encabezado registro={registro} d={d} corto /></div>
            {lineas.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-border bg-muted/40 px-4 py-2.5 text-[13px] leading-snug">
                    <Bloques bloques={lineas} d={d} corto />
                </div>
            )}
            {pie && <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{pie}</div>}
        </div>
    );
}

/**
 * El panel lateral con la ficha completa (en el celular ocupa el ancho).
 * Navega a la palabra anterior y siguiente sin cerrarse.
 */
export function FichaPanel<D>({
    registro, d, abierto, onCerrar, referencia, onAnterior, onSiguiente, rtl = false,
}: {
    registro: FichaRegistro<D>;
    d: D | null;
    abierto: boolean;
    onCerrar: () => void;
    /** «Génesis 2:17 · palabra 10 de 13». */
    referencia: string;
    onAnterior?: () => void;
    onSiguiente?: () => void;
    /** Hebreo: se lee de derecha a izquierda, así que «anterior» apunta a la derecha. */
    rtl?: boolean;
}) {
    const { t } = useTranslation('languageStructure');
    const boton = 'flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40';
    const Anterior = rtl ? ChevronRight : ChevronLeft;
    const Siguiente = rtl ? ChevronLeft : ChevronRight;
    return (
        <Sheet open={abierto} onOpenChange={(o) => !o && onCerrar()}>
            <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-[30rem] [&>button:last-child]:hidden" data-testid="ficha-panel">
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background px-6 pb-2 pt-5">
                    <SheetTitle className="text-xs font-semibold text-muted-foreground">{referencia}</SheetTitle>
                    <SheetDescription className="sr-only">{t('wordFicha.panelDescription')}</SheetDescription>
                    <div className="flex gap-1">
                        <button type="button" className={boton} onClick={onAnterior} disabled={!onAnterior} aria-label={t('wordFicha.previous')}><Anterior className="h-4 w-4" /></button>
                        <button type="button" className={boton} onClick={onSiguiente} disabled={!onSiguiente} aria-label={t('wordFicha.next')}><Siguiente className="h-4 w-4" /></button>
                        <button type="button" className={boton} onClick={onCerrar} aria-label={t('wordFicha.close')}><X className="h-4 w-4" /></button>
                    </div>
                </div>
                {d && <FichaCompleta registro={registro} d={d} />}
            </SheetContent>
        </Sheet>
    );
}

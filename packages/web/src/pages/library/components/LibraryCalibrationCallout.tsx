import { useNavigate } from 'react-router-dom';
import { rutaCalibracion } from '@/lib/rutaCalibracion';
import { Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import type { LibraryResourceEntity } from '@dosfilos/domain';
import { needsCalibration } from './necesitaCalibrar';

/**
 * Recursos listos que todavía no dicen qué número lleva impresa cada hoja.
 *
 * Sin esto, sus citas salen como «hoja 55» —un número del archivo PDF que no
 * existe en ningún ejemplar— y nadie puede comprobarlas contra el libro.
 *
 * POR QUÉ UN AVISO Y NO UN PASO DEL ALTA. La idea original era llevar a
 * calibrar al terminar de subir, y no se puede: la extracción es asíncrona y
 * termina minutos más tarde, cuando la persona ya cerró la pestaña. No existe
 * ese momento. Lo que sí existe es este: el recurso quedó listo y todavía no
 * tiene numeración, y eso se puede decir cuantas veces haga falta hasta que se
 * resuelva.
 *
 * Un tramo guardado con `origin: 'confirmed'` cuenta como resuelto AUNQUE no
 * tenga numeración arábiga: «este libro no lleva folios» es una respuesta, y
 * volver a preguntarla enseñaría a ignorar el aviso.
 *
 * SÓLO LOS RECIÉN EXTRAÍDOS, y eso es la diferencia entre un empujón y una
 * regañina. Medido sobre una biblioteca real: 64 de 72 recursos no tienen
 * numeración confirmada, y un banner con ese número se ignora desde el primer
 * día. En los últimos siete días eran 4. La biblioteca vieja se calibra cuando
 * hace falta —al componer, que es donde el aviso cuenta citas concretas— y no
 * desde un cartel permanente.
 */

export function LibraryCalibrationCallout({ resources }: { resources: LibraryResourceEntity[] }) {
    const { t } = useTranslation('library');
    const navigate = useNavigate();

    const pendientes = resources.filter(needsCalibration);
    if (pendientes.length === 0) return null;

    return (
        <div className="rounded-lg border border-info/30 bg-info-subtle/40 px-4 py-3 flex items-start gap-3">
            <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-info-subtle-foreground">
                    {t('calibrationCallout.title', { count: pendientes.length })}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-info-subtle-foreground/90">
                    {t('calibrationCallout.body')}
                </p>
            </div>
            <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => navigate(rutaCalibracion(pendientes[0]!.id))}
            >
                {t('calibrationCallout.action')}
            </Button>
        </div>
    );
}

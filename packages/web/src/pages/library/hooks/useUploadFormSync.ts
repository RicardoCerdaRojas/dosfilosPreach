import { useEffect, useRef } from 'react';
import { toPreflightRecord, type ModeRecommendation } from '@dosfilos/domain';
import type { UploadFormMetadata } from '../components/LibraryUploadForm';
import type { PdfPreflightState } from './usePdfPreflight';

/**
 * Lo que la pantalla de subida calcula y el formulario tiene que llevarse al
 * enviar: la recomendación de motor y el informe previo.
 *
 * Los dos se calculan en el formulario —ahí vive la lectura del PDF— y se
 * guardan en el estado de quien sube, que es el que arma el recurso.
 */
export function useUploadFormSync(
    preflight: PdfPreflightState,
    recommendation: ModeRecommendation,
    onMetadataChange: (updates: Partial<UploadFormMetadata>) => void,
): void {
    // Una recomendación FUERTE se aplica sola. Sin esto la pantalla decía
    // «elegí Por imágenes» y dejaba el otro azulejo marcado en verde: ya no se
    // contradecía en palabras, pero sí en lo que tenía seleccionado, y un
    // azulejo verde se lee como una elección hecha.
    //
    // Sólo al CAMBIAR la recomendación, no en cada render: si después de verla
    // el usuario elige lo contrario a conciencia, no se le discute.
    const ultimaAplicada = useRef<string | null>(null);
    useEffect(() => {
        const firma = `${recommendation.reasonKey}:${recommendation.recommended}`;
        if (!recommendation.strong || !recommendation.recommended) return;
        if (ultimaAplicada.current === firma) return;
        ultimaAplicada.current = firma;
        onMetadataChange({ extractionMode: recommendation.recommended });
    }, [recommendation.strong, recommendation.recommended, recommendation.reasonKey, onMetadataChange]);

    // El informe viaja con la subida para que la ficha de extracción pueda
    // decir si predijo el resultado. Mientras se lee otro archivo —o si no se
    // pudo leer— se limpia: un veredicto del PDF anterior sería peor que ninguno.
    useEffect(() => {
        onMetadataChange({
            preflight: preflight.status === 'done'
                ? toPreflightRecord(preflight.diagnosis, preflight.evidence)
                : null,
        });
    }, [preflight, onMetadataChange]);
}

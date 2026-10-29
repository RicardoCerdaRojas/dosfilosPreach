import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { exegesisService } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';
import { useTranslation } from '@/i18n';

export interface StudentReadingDraft {
    texto: string;
    setTexto: (texto: string) => void;
    /** Lo escrito coincide con lo último guardado. */
    sinCambios: boolean;
    guardando: boolean;
    /**
     * Guarda lo escrito si cambió, esperando el guardado que ya estuviera en
     * vuelo. `true` si al terminar lo guardado es lo escrito.
     */
    guardar: () => Promise<boolean>;
}

/**
 * El borrador de «Mi lectura» de un paso, compartido entre el panel que lo
 * edita y la tarjeta que genera el análisis.
 *
 * En el TP #9 (B25) se pudo generar el análisis con la lectura escrita y sin
 * guardar: el guardado al salir del campo y la generación salían a la vez, y
 * el análisis leía el trabajo antes de que la lectura llegara. Ahora la
 * tarjeta llama a `guardar()` y espera ANTES de generar: si el guardado
 * falla, no genera.
 */
export function useStudentReadingDraft({ paperId, stepId, initial }: {
    paperId: string;
    stepId: string;
    initial: string | null | undefined;
}): StudentReadingDraft {
    const { t } = useTranslation('exegesis');
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const guardada = (initial ?? '').trim();
    const [texto, setTexto] = useState(guardada);
    // Lo último guardado: el trabajo releído tarda en traerlo, y mientras tanto
    // la tarjeta no debe decir «sin guardar» ni volver a guardar lo mismo.
    const [ultimo, setUltimo] = useState(guardada);
    useEffect(() => {
        setTexto(guardada);
        setUltimo(guardada);
    }, [guardada]);
    const textoRef = useRef(texto);
    textoRef.current = texto;
    const ultimoRef = useRef(ultimo);
    ultimoRef.current = ultimo;
    const enVuelo = useRef<Promise<boolean> | null>(null);

    const mutation = useMutation({
        mutationFn: async (studentReading: string) => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.updateStepStudentReading.execute({ ownerId: user.uid, paperId, stepId, studentReading });
        },
        onSuccess: (_r, studentReading) => {
            ultimoRef.current = studentReading.trim();
            setUltimo(studentReading.trim());
            return queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
        onError: err => {
            console.error('[exegesis] save student reading failed:', err);
            toast.error(t('studentReading.saveFailed'));
        },
    });
    const { mutateAsync } = mutation;

    const guardar = useCallback(async (): Promise<boolean> => {
        // Uno a la vez: el del campo que se suelta y el de «Analizar» no se pisan.
        if (enVuelo.current) await enVuelo.current;
        const valor = textoRef.current;
        if (valor.trim() === ultimoRef.current) return true;
        const vuelo = mutateAsync(valor).then(() => true, () => false);
        enVuelo.current = vuelo;
        try {
            return await vuelo;
        } finally {
            if (enVuelo.current === vuelo) enVuelo.current = null;
        }
    }, [mutateAsync]);

    return { texto, setTexto, sinCambios: texto.trim() === ultimo, guardando: mutation.isPending, guardar };
}

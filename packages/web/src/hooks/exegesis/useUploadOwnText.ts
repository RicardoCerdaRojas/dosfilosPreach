import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { libraryService } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';

/**
 * Sube un texto escrito por el propio usuario y lo deja marcado como suyo.
 *
 * Existe porque el camino natural para enseñarle al sistema cómo escribe
 * es subir su ensayo, y sin esto había que ir a la biblioteca, subirlo
 * como un libro más, buscarlo y editarlo para marcarlo: tres pantallas
 * para un dato que ya se sabía al elegir el archivo.
 *
 * El texto se extrae como cualquier otro documento —consume páginas de
 * procesamiento— y hasta que termine no hay prosa que muestrear. La
 * interfaz lo dice en vez de dejar al usuario esperando algo que parece
 * instantáneo.
 */
export function useUploadOwnText() {
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const [progress, setProgress] = useState<number | null>(null);

    const upload = async (file: File): Promise<{ id: string; title: string }> => {
        if (!user?.uid) throw new Error('User not authenticated');
        setProgress(0);
        try {
            const titulo = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || file.name;
            const recurso = await libraryService.uploadResource(
                user.uid,
                file,
                {
                    title: titulo,
                    // El autor es él: es el punto de subir este archivo.
                    author: user.displayName ?? '',
                    // «other» y no una categoría de estudio: no es material de
                    // consulta, es prosa suya. Clasificarlo como comentario lo
                    // haría aparecer en las recomendaciones de corpus.
                    type: 'other',
                    authoredByUser: true,
                },
                p => setProgress(p),
            );
            queryClient.invalidateQueries({ queryKey: ['library'] });
            return { id: recurso.id, title: recurso.title };
        } finally {
            setProgress(null);
        }
    };

    return { upload, progress, isUploading: progress !== null };
}

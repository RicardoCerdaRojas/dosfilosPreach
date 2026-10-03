import { useEffect, useState } from 'react';
import { pastoralSeedService } from '@dosfilos/application';

export interface SeedThesis {
    /** La idea central que el pastor escribió en el Insight. */
    centralIdea?: string;
    /** El género que confirmó en el paso de contexto. */
    genre?: string;
}

/**
 * Lo que la homilética necesita de la semilla del pastor, leído de la semilla.
 *
 * `rules.pastoralSeed` sólo existe en la copia de las reglas que arma el
 * borrador (`augmentGenerationRules`): la homilética lo leía del estado del
 * asistente, donde nunca está, y la idea central de «Elige el enfoque» no
 * aparecía nunca (revisión adversarial de F3). Lo mismo el género del
 * contrato de la proposición.
 */
export function useSeedThesis(sermonId: string | null | undefined, userId: string | undefined): SeedThesis {
    const [thesis, setThesis] = useState<SeedThesis>({});
    useEffect(() => {
        if (!sermonId) return;
        let vivo = true;
        pastoralSeedService
            .getBySermonId(sermonId, { userId })
            .then(seed => {
                if (!vivo || !seed) return;
                setThesis({
                    centralIdea: seed.insight?.centralIdea?.trim() || undefined,
                    genre: seed.contextGenre?.genre || undefined,
                });
            })
            .catch(() => {});
        return () => {
            vivo = false;
        };
    }, [sermonId, userId]);
    return thesis;
}

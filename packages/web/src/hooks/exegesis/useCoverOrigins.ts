import { useMemo } from 'react';
import { coverOrigins, type CoverOrigin } from '@dosfilos/domain';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useWorkProfiles } from '@/hooks/exegesis/useWorkProfiles';

/**
 * De dónde puede sacar su portada este trabajo: los trabajos anteriores que
 * la tienen (el más reciente primero, con el «#N» ya avanzado) y los perfiles.
 */
export function useCoverOrigins(paperId: string): CoverOrigin[] {
    const { papers } = useExegesisPapers();
    const { profiles } = useWorkProfiles();
    return useMemo(() => coverOrigins(papers, profiles, paperId), [papers, profiles, paperId]);
}

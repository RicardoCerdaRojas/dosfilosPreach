import { useQuery } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
    buildExtractionRunsReport,
    type ExtractionRun,
    type ExtractionRunsReport,
} from '@/lib/extractionRunsReport';

interface Payload {
    runs: ExtractionRun[];
    titles: Record<string, string>;
    emails: Record<string, string>;
}

export interface ExtractionRunsData extends Payload {
    report: ExtractionRunsReport;
}

/**
 * Lee las fichas de extracción vía `getExtractionRuns` (super_admin) y las
 * agrega con la función pura `buildExtractionRunsReport`. Sólo lectura.
 */
export function useExtractionRuns(limit = 200) {
    return useQuery<ExtractionRunsData>({
        queryKey: ['admin', 'extractionRuns', limit],
        queryFn: async () => {
            const callable = httpsCallable<{ limit: number }, Payload>(getFunctions(), 'getExtractionRuns');
            const { data } = await callable({ limit });
            const runs = data.runs ?? [];
            return {
                runs,
                titles: data.titles ?? {},
                emails: data.emails ?? {},
                report: buildExtractionRunsReport(runs),
            };
        },
        staleTime: 60_000,
    });
}

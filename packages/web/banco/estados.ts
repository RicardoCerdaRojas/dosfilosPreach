import { buildEmptyCanonicalVerseAnalysis, type ExegeticalStep, type ExegeticalStepVersion } from '@dosfilos/domain';

/**
 * Los estados por los que pasa una tarjeta en la vida real. Al agregar una acción
 * que depende del estado, se agrega aquí el estado que la hace aparecer.
 */
const REF = { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 4, verseEnd: 4 };
const PROSA = 'Salmos 23:4 mantiene ante el peligro la confianza presente de los versículos anteriores y la concreta en provisión y comunión duraderas (Ross, A Commentary on the Psalms 1-41 (Kregel Exegetical Library), 566).';
const fecha = (dia: number) => new Date(2026, 10, dia);
const analisis = { ...buildEmptyCanonicalVerseAnalysis(REF as never), reference: REF };

const version = (id: string, parentVersionId: string | null, over: Partial<ExegeticalStepVersion> = {}) =>
    ({ id, markdown: `${PROSA} (${id})`, origin: 'generated', parentVersionId, createdAt: fecha(1), ...over }) as ExegeticalStepVersion;

const cadena = (n: number, over: Partial<ExegeticalStepVersion> = {}) =>
    Array.from({ length: n }, (_, i) => version(`v${i + 1}`, i ? `v${i}` : null, over));

const paso = (kind: string, versions: ExegeticalStepVersion[], current: number | null, accepted: number | null, over: Partial<ExegeticalStep> = {}) => ({
    id: 'paso', paperId: 'banco', kind, order: 1,
    verseRef: kind === 'verse' ? REF : null,
    state: accepted !== null && current === accepted ? 'accepted' : 'awaiting-review',
    versions,
    current: current === null ? null : versions[current - 1],
    accepted: accepted === null ? null : versions[accepted - 1],
    createdAt: fecha(1),
    updatedAt: fecha(1),
    ...over,
}) as unknown as ExegeticalStep;

const conAnalisis = { canonicalAnalysis: analisis as never };

export const ESTADOS: Record<string, ExegeticalStep> = {
    'conclusión aceptada, sin historial': paso('conclusion', cadena(1), 1, 1),
    'conclusión aceptada, con historial': paso('conclusion', cadena(3), 2, 2),
    'conclusión regenerada, en revisión': paso('conclusion', cadena(2), 2, 1),
    'conclusión en revisión, varias atrás': paso('conclusion', cadena(5), 4, 3),
    'conclusión devuelta a revisión': paso('conclusion', cadena(3), 3, null, { lastAcceptedVersionId: 'v3' }),
    'conclusión devuelta y regenerada': paso('conclusion', cadena(5), 5, null, { lastAcceptedVersionId: 'v3' }),
    'conclusión devuelta antes de este arreglo': paso('conclusion', cadena(5), 4, null),
    'introducción aceptada, con historial': paso('introduction', cadena(3), 2, 2),
    'versículo aceptado, sin prosa': paso('verse', cadena(1, { ...conAnalisis, markdown: '' }), 1, 1),
    'versículo aceptado, con prosa': paso('verse', cadena(1, conAnalisis), 1, 1),
    'versículo recompuesto': paso('verse', cadena(1, { ...conAnalisis, previousProse: { markdown: PROSA } }), 1, 1),
    'versículo recompuesto y deshecho': paso('verse', cadena(1, { ...conAnalisis, previousProse: { markdown: PROSA, undone: true, undoneAt: fecha(2) } }), 1, 1),
    'versículo con historial': paso('verse', cadena(3, conAnalisis), 2, 2),
    'versículo regenerado, en revisión': paso('verse', cadena(3, conAnalisis), 3, 2),
    'versículo sin análisis, en revisión': paso('verse', cadena(2), 2, 1),
    'versículo excluido': paso('verse', cadena(2, conAnalisis), 2, 2, { includeInDocument: false }),
    'ensamble aceptado, con historial': paso('assembly', cadena(3), 2, 2),
    'ensamble regenerado, en revisión': paso('assembly', cadena(2), 2, 1),
};

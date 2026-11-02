import {
    parseBriefQuestions,
    replaceSectionsByHeadings,
    replaceVerseSection,
    replaceVerseSectionExact,
    sectionHeadings,
    verseSectionKey,
    type BriefQuestion,
    type CanonicalVerseAnalysis,
    type ExegeticalPaper,
    type IExegeticalPaperRepository,
} from '@dosfilos/domain';

/**
 * Mete la prosa del verso en el trabajo ensamblado, en su sección.
 *
 * Devuelve `false` si no hay ensamblado o si su sección no aparece
 * —un ensamblado escrito a mano, o con otros encabezados—. Ahí el
 * llamador avisa: pegar la prosa donde caiga deja el trabajo con el
 * verso dos veces.
 */
export async function spliceVerseIntoAssembly(
    paperRepository: IExegeticalPaperRepository,
    ownerId: string,
    paper: ExegeticalPaper,
    analysis: CanonicalVerseAnalysis,
    prose: string,
    propias: ReadonlyArray<BriefQuestion>,
    enElDocumento: boolean,
): Promise<boolean> {
    const assembled = paper.assembledMarkdown?.trim();
    if (!assembled) return false;
    // Un versículo fuera del documento no tiene sección que reemplazar.
    // Buscarla igual podía encontrar la de otro.
    if (!enElDocumento) return false;

    const key = verseSectionKey(analysis, paper.displayLanguage);
    // Con preguntas, la sección se titula con ellas. Un ensamble anterior
    // a ese cambio sigue titulado con la referencia: se prueba después.
    const porPregunta = propias.length > 0
        ? replaceSectionsByHeadings(
            assembled,
            sectionHeadings({ kind: 'verse', verseRef: analysis.reference }, propias, key),
            prose,
        )
        : null;
    // Respaldo: un versículo sin preguntas, o un ensamble anterior a los
    // títulos por pregunta. Si el encuadre trae preguntas, título EXACTO:
    // un título-pregunta puede nombrar este versículo sin ser su sección
    // (ver `replaceVerseSectionExact`). Sin preguntas, el de siempre, que
    // acepta «### Santiago 1:2 — La prueba» del compositor del trabajo
    // entero.
    const hayPreguntas = parseBriefQuestions(paper.assignmentBrief, paper.passage).length > 0;
    const next = porPregunta ?? (hayPreguntas
        ? replaceVerseSectionExact(assembled, key, prose)
        : replaceVerseSection(assembled, key, prose));
    if (next === null) {
        console.warn('[ComposeVerseAcademicProseUseCase] el ensamblado no trae la sección', key);
        return false;
    }
    if (next === assembled) return true;

    await paperRepository.updatePaper(ownerId, paper.id, { assembledMarkdown: next });
    return true;
}

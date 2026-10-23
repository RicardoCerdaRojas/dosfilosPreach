import { getBookById, type BibleBookId } from '../../bible/canon/BibleCanon';
import type { PassageReference } from '../../bible/canon/passage-reference';
import type { SourceType } from '../entities/SourceType';
import type { ProjectType } from '../../entities/AIProject';
import type { BibliographyApproach, ProjectRequirement } from './projectBibliography';

/**
 * La guía de búsqueda del estado del arte (etapa 2c, versión 1): qué
 * buscar y dónde, armada con reglas fijas a partir de lo que el proyecto ya
 * sabe (los pasajes, los requisitos que no se cumplen, los tipos que
 * faltan). Sin el asistente y sin integraciones: el usuario busca en las
 * bases de la disciplina, trae el resultado por RIS y anota la búsqueda.
 * Así trabaja una revisión bibliográfica, y no se aparenta cubrir lo que el
 * servidor no puede consultar (medido: IxTheo bloquea al servidor).
 * docs/FASE_BUSCAR_LITERATURA_2026-10.md.
 */

export type GuideDatabase =
    | 'ixtheo' | 'atla' | 'google-scholar' | 'dialnet' | 'dialnet-theses' | 'bne' | 'google-books'
    | 'internet-archive' | 'hathitrust' | 'worldcat' | 'oatd' | 'proquest';

export interface GuideQuery {
    database: GuideDatabase;
    /** Lista para copiar. */
    query: string;
    /** Abre la búsqueda cargada; null cuando la base va por la biblioteca del usuario (ATLA, ProQuest). */
    url: string | null;
    /** El pasaje o el libro al que apunta, para rotularla. */
    label?: string;
    /** `perspectives`: el enfoque que busca (la pantalla lo traduce). */
    approach?: BibliographyApproach;
}

export type GuideStepKind = 'passage' | 'articles' | 'spanish' | 'older' | 'books' | 'perspectives' | 'theses';

/** Por qué aparece un paso: siempre, por un requisito que no se cumple o por un tipo que falta. */
export type GuideReason =
    | { kind: 'always' }
    | { kind: 'requirement'; requirementId: string; text: string }
    | { kind: 'type'; sourceType: SourceType }
    | { kind: 'project'; projectType: ProjectType };

export interface GuideStep {
    kind: GuideStepKind;
    reasons: GuideReason[];
    queries: GuideQuery[];
    /** `older`: el año de corte del requisito, y hasta qué año es de dominio público. */
    before?: number | null;
    publicDomainBefore?: number;
}

export interface SearchGuideInput {
    /** Los pasajes de los estudios del proyecto. */
    passages: ReadonlyArray<PassageReference>;
    /** Los libros del proyecto (de los criterios o de los estudios). */
    bibleBooks: ReadonlyArray<BibleBookId>;
    /** Los tipos que algún requisito pide y no se cumplen. */
    unmetTypes: ReadonlySet<SourceType>;
    /** Los requisitos que no se cumplen o están incompletos. */
    unmetRequirements: ReadonlyArray<ProjectRequirement>;
    /** Los enfoques que ya tiene lo aprobado. */
    presentApproaches: ReadonlySet<BibliographyApproach>;
    projectType?: ProjectType | null;
    language: 'es' | 'en';
    /** Para el dominio público; por omisión, el año actual. */
    year?: number;
}

/** Abreviaturas del SBL Handbook of Style (2.ª ed.), las que usan IxTheo, ATLA y las revistas. */
const SBL: Record<BibleBookId, string> = {
    GEN: 'Gen', EXO: 'Exod', LEV: 'Lev', NUM: 'Num', DEU: 'Deut', JOS: 'Josh', JDG: 'Judg', RUT: 'Ruth',
    '1SA': '1 Sam', '2SA': '2 Sam', '1KI': '1 Kgs', '2KI': '2 Kgs', '1CH': '1 Chr', '2CH': '2 Chr',
    EZR: 'Ezra', NEH: 'Neh', EST: 'Esth', JOB: 'Job', PSA: 'Ps', PRO: 'Prov', ECC: 'Eccl', SNG: 'Song',
    ISA: 'Isa', JER: 'Jer', LAM: 'Lam', EZK: 'Ezek', DAN: 'Dan', HOS: 'Hos', JOL: 'Joel', AMO: 'Amos',
    OBA: 'Obad', JON: 'Jonah', MIC: 'Mic', NAM: 'Nah', HAB: 'Hab', ZEP: 'Zeph', HAG: 'Hag', ZEC: 'Zech', MAL: 'Mal',
    MAT: 'Matt', MRK: 'Mark', LUK: 'Luke', JHN: 'John', ACT: 'Acts', ROM: 'Rom', '1CO': '1 Cor', '2CO': '2 Cor',
    GAL: 'Gal', EPH: 'Eph', PHP: 'Phil', COL: 'Col', '1TH': '1 Thess', '2TH': '2 Thess', '1TI': '1 Tim',
    '2TI': '2 Tim', TIT: 'Titus', PHM: 'Phlm', HEB: 'Heb', JAS: 'Jas', '1PE': '1 Pet', '2PE': '2 Pet',
    '1JN': '1 John', '2JN': '2 John', '3JN': '3 John', JUD: 'Jude', REV: 'Rev',
};

/** Términos con que la literatura nombra cada enfoque (para buscar el que falta). */
const TERMINOS_ENFOQUE: Partial<Record<BibliographyApproach, string>> = {
    'historical-critical': 'redaction OR "source criticism" OR "historical-critical"',
    'socio-rhetorical': 'rhetoric OR rhetorical OR "social-scientific"',
    'discourse-linguistic': '"discourse analysis" OR linguistic',
    'literary-narrative': 'narrative OR literary',
    'canonical-theological': '"biblical theology" OR canonical',
    'historical-grammatical': 'exegesis OR grammatical',
};
const ENFOQUES_A_BUSCAR: BibliographyApproach[] = ['historical-critical', 'socio-rhetorical', 'discourse-linguistic', 'literary-narrative', 'canonical-theological'];

// Solo lo que se busca como «comentario» o «monografía»: los léxicos, las
// gramáticas y los diccionarios están en el catálogo (Candidatas).
const TIPOS_DE_LIBRO: ReadonlySet<SourceType> = new Set(['commentary-critical', 'commentary-expository', 'theological-monograph'] as SourceType[]);

/**
 * Cómo se busca un libro entero sin ruido. «James», «Ruth», «Santiago» o
 * «Juan» solos traen personas y ciudades (medido en Dialnet: «Santiago»
 * devuelve Santiago de Compostela); el nombre con su género literario no.
 * Los libros que no están aquí no son ambiguos.
 */
const BUSQUEDA_EN: Partial<Record<BibleBookId, string>> = {
    EXO: '"Book of Exodus"', NUM: '"Book of Numbers"', JOS: '"Book of Joshua"', JDG: '"Book of Judges"', RUT: '"Book of Ruth"',
    EZR: '"Book of Ezra"', EST: '"Book of Esther"', JOB: '"Book of Job"', PRO: '"Book of Proverbs"', SNG: '"Song of Songs"',
    DAN: '"Book of Daniel"', JOL: '"Book of Joel"', AMO: '"Book of Amos"', JON: '"Book of Jonah"', MIC: '"Book of Micah"', NAM: '"Book of Nahum"',
    MAT: '"Gospel of Matthew"', MRK: '"Gospel of Mark"', LUK: '"Gospel of Luke"', JHN: '"Gospel of John"', ACT: '"Acts of the Apostles"',
    ROM: '"Epistle to the Romans" OR "Letter to the Romans"', TIT: '"Epistle to Titus" OR "Letter to Titus"',
    HEB: '"Epistle to the Hebrews" OR "Letter to the Hebrews"', JAS: '"Epistle of James" OR "Letter of James"',
    JUD: '"Epistle of Jude" OR "Letter of Jude"', REV: '"Book of Revelation"',
};
const BUSQUEDA_ES: Partial<Record<BibleBookId, string>> = {
    EXO: 'libro del Éxodo', NUM: 'libro de Números', JOS: 'libro de Josué', JDG: 'libro de los Jueces', RUT: 'libro de Rut',
    EZR: 'libro de Esdras', EST: 'libro de Ester', JOB: 'libro de Job', PRO: 'libro de los Proverbios', SNG: 'Cantar de los Cantares',
    DAN: 'libro de Daniel', JOL: 'libro de Joel', AMO: 'libro de Amós', JON: 'libro de Jonás', MIC: 'libro de Miqueas',
    MAT: 'evangelio de Mateo', MRK: 'evangelio de Marcos', LUK: 'evangelio de Lucas', JHN: 'evangelio de Juan', ACT: 'Hechos de los Apóstoles',
    ROM: 'epístola a los Romanos', TIT: 'epístola a Tito', HEB: 'epístola a los Hebreos', JAS: 'epístola de Santiago',
    JUD: 'epístola de Judas', '1PE': 'primera epístola de Pedro', '2PE': 'segunda epístola de Pedro',
    '1JN': 'primera epístola de Juan', '2JN': 'segunda epístola de Juan', '3JN': 'tercera epístola de Juan', REV: 'Apocalipsis',
    '1KI': '1 Reyes', '2KI': '2 Reyes',
};
/** El libro, listo para buscar: entre comillas en inglés (con su género si es ambiguo); en español, la frase. */
export function bookSearchName(b: BibleBookId, language: 'es' | 'en'): string {
    const libro = getBookById(b);
    if (language === 'es') return BUSQUEDA_ES[b] ?? libro?.nameEs ?? b;
    return BUSQUEDA_EN[b] ?? `"${libro?.nameEn ?? b}"`;
}

const e = encodeURIComponent;
const URLS: Record<GuideDatabase, ((q: string) => string) | null> = {
    // Medido 2026-10-23: Dialnet y Google Académico responden con resultados;
    // BNE, Internet Archive, WorldCat y Google Libros arman la página en el
    // navegador; IxTheo, HathiTrust y OATD tienen control anti-bots (en el
    // navegador pasa), y su dirección es la estándar de VuFind (supuesto).
    ixtheo: q => `https://ixtheo.de/Search/Results?lookfor=${e(q)}&type=AllFields`,
    // La búsqueda por pasaje de IxTheo (type=BibleRangeSearch, leído en
    // searches.ini de tuefind): trae lo que trata el pasaje aunque no lo cite
    // con esas palabras, los rangos que lo contienen y el capítulo. La guía
    // de DTS midió 1586 registros contra 19 en All Fields (Heb 12:18-29).
    atla: null,
    'google-scholar': q => `https://scholar.google.com/scholar?q=${e(q)}`,
    dialnet: q => `https://dialnet.unirioja.es/buscar/documentos?querysDismax.DOCUMENTAL_TODO=${e(q)}`,
    'dialnet-theses': q => `https://dialnet.unirioja.es/buscar/tesis?querysDismax.DOCUMENTAL_TODO=${e(q)}`,
    bne: q => `https://catalogo.bne.es/discovery/search?query=any,contains,${e(q)}&vid=34BNE_INST:CATALOGO`,
    'google-books': q => `https://www.google.com/search?tbm=bks&q=${e(q)}`,
    'internet-archive': q => `https://archive.org/search?query=${e(q)}`,
    hathitrust: q => `https://catalog.hathitrust.org/Search/Home?lookfor=${e(q)}&type=all`,
    worldcat: q => `https://search.worldcat.org/search?q=${e(q)}`,
    oatd: q => `https://oatd.org/oatd/search?q=${e(q)}`,
    proquest: null,
};
const consulta = (database: GuideDatabase, query: string, label?: string, extra: Partial<GuideQuery> = {}): GuideQuery =>
    ({ database, query, url: URLS[database]?.(query) ?? null, ...(label ? { label } : {}), ...extra });
/** IxTheo por pasaje: una sola forma, el nombre en inglés con dos puntos (así la documenta la guía de DTS). */
const ixtheoPasaje = (p: PassageReference, label: string): GuideQuery => {
    const query = `${getBookById(p.bookId)?.nameEn ?? SBL[p.bookId]} ${rango(p)}`;
    return { database: 'ixtheo', query, url: `https://ixtheo.de/Search/Results?lookfor=${e(query)}&type=BibleRangeSearch`, label };
};

/** El pasaje como se escribe: «4:1-10», «4», «4:13–5:6». */
function rango(p: PassageReference): string {
    if (p.verseStart == null) return p.chapterEnd !== p.chapterStart ? `${p.chapterStart}-${p.chapterEnd}` : `${p.chapterStart}`;
    if (p.chapterEnd !== p.chapterStart) return `${p.chapterStart}:${p.verseStart}-${p.chapterEnd}:${p.verseEnd ?? ''}`.replace(/:$/, '');
    return p.verseEnd != null && p.verseEnd !== p.verseStart ? `${p.chapterStart}:${p.verseStart}-${p.verseEnd}` : `${p.chapterStart}:${p.verseStart}`;
}

/**
 * Las formas en que la literatura cita un pasaje: la abreviatura del SBL,
 * el nombre en inglés y, para quien estudia en español, el nombre en
 * español. «Jas 4:1-10», «James 4:1-10», «Santiago 4:1-10».
 */
export function passageForms(p: PassageReference, language: 'es' | 'en'): string[] {
    const libro = getBookById(p.bookId);
    const r = rango(p);
    const nombres = [SBL[p.bookId], libro?.nameEn, language === 'es' ? libro?.nameEs : null].filter((x): x is string => !!x);
    const formas = nombres.map(n => `${n} ${r}`);
    // En español se cita con coma entre capítulo y versículo: «Santiago 4,1-10».
    if (language === 'es' && libro && r.includes(':')) formas.push(`${libro.nameEs} ${r.replace(/:/g, ',')}`);
    return [...new Set(formas)];
}

const unidas = (formas: string[]) => formas.map(f => `"${f}"`).join(' OR ');
const nombre = (b: BibleBookId, language: 'es' | 'en') => (language === 'es' ? getBookById(b)?.nameEs : getBookById(b)?.nameEn) ?? b;

/**
 * Los pasos de la guía, en orden de uso. Siempre está el del pasaje en
 * IxTheo (la base abierta de la disciplina); los demás aparecen por lo que
 * falta: artículos, obras en español, obras antiguas, comentarios y
 * monografías, enfoques que no están, tesis.
 */
export function searchGuide(input: SearchGuideInput): GuideStep[] {
    const { passages, bibleBooks, unmetTypes, unmetRequirements, presentApproaches, projectType, language } = input;
    // La investigación es el tipo `study` (CREATABLE_PROJECT_TYPES).
    const investigacion = projectType === 'study';
    const en = (b: BibleBookId) => bookSearchName(b, 'en');
    const libros = [...new Set([...bibleBooks, ...passages.map(p => p.bookId)])];
    if (libros.length === 0) return [];
    // Un pasaje sin capítulo vale como su libro.
    const conCapitulo = passages.filter(p => Number.isInteger(p.chapterStart) && p.chapterStart > 0);
    const pasajes = [...new Map(conCapitulo.map(p => [`${p.bookId}|${rango(p)}`, p])).values()].slice(0, 8);
    const porRequisito = (pred: (r: ProjectRequirement) => boolean): GuideReason[] =>
        unmetRequirements.filter(pred).map(r => ({ kind: 'requirement', requirementId: r.id, text: r.text }));
    const pasos: GuideStep[] = [];

    // 1 · El pasaje (o el libro) en IxTheo y Google Académico.
    const delPasaje: GuideQuery[] = pasajes.length
        ? pasajes.flatMap(p => {
            const label = `${nombre(p.bookId, language)} ${rango(p)}`;
            return [ixtheoPasaje(p, label), consulta('google-scholar', unidas(passageForms(p, language)), label)];
        })
        : libros.flatMap(b => [consulta('ixtheo', en(b), nombre(b, language))]);
    pasos.push({ kind: 'passage', reasons: [{ kind: 'always' }], queries: delPasaje });

    // 2 · Artículos de revista: ATLA y NTA por la biblioteca, Google Académico.
    const razonesArticulos: GuideReason[] = [
        ...(unmetTypes.has('journal-article') ? [{ kind: 'type', sourceType: 'journal-article' } as GuideReason] : []),
        ...porRequisito(r => r.kind === 'quantity' && r.sourceType === 'journal-article'),
    ];
    if (razonesArticulos.length || investigacion) {
        const reasons = razonesArticulos.length ? razonesArticulos : [{ kind: 'project', projectType: 'study' } as GuideReason];
        pasos.push({
            kind: 'articles', reasons,
            queries: (pasajes.length ? pasajes : []).map(p => consulta('atla', unidas(passageForms(p, 'en')), `${nombre(p.bookId, language)} ${rango(p)}`))
                .concat(libros.map(b => consulta('atla', en(b), nombre(b, language))))
                .slice(0, 6),
        });
    }

    // 3 · En español: Dialnet, la BNE y Google Libros.
    if (language === 'es') {
        pasos.push({
            kind: 'spanish', reasons: [{ kind: 'always' }],
            queries: libros.flatMap(b => {
                const n = bookSearchName(b, 'es');
                const label = nombre(b, 'es');
                return [consulta('dialnet', n, label), consulta('bne', `${n} comentario`, label), consulta('google-books', `${n} comentario`, label)];
            }),
        });
    }

    // 4 · Obras antiguas: lo anterior a 1929 suele ser de dominio público.
    const epocas = unmetRequirements.filter(r => r.kind === 'date-range' && r.before);
    if (epocas.length) {
        pasos.push({
            kind: 'older', reasons: porRequisito(r => r.kind === 'date-range' && !!r.before),
            before: Math.min(...epocas.map(r => r.before!)),
            // En EE. UU. es de dominio público lo publicado hace más de 95 años.
            publicDomainBefore: (input.year ?? new Date().getFullYear()) - 95,
            queries: libros.flatMap(b => {
                const q = `${en(b)} commentary`;
                return [consulta('internet-archive', q, nombre(b, language)), consulta('hathitrust', q, nombre(b, language))];
            }),
        });
    }

    // 5 · Comentarios y monografías que faltan: dónde hay un ejemplar.
    const libroQueFalta = [...unmetTypes].filter(t => TIPOS_DE_LIBRO.has(t));
    if (libroQueFalta.length) {
        pasos.push({
            kind: 'books', reasons: libroQueFalta.map(sourceType => ({ kind: 'type', sourceType })),
            queries: libros.flatMap(b => {
                const q = `${en(b)} commentary`;
                return [consulta('worldcat', q, nombre(b, language)), consulta('google-books', q, nombre(b, language))];
            }),
        });
    }

    // 6 · Enfoques que no están: una consulta por enfoque.
    const opuestos = porRequisito(r => r.kind === 'perspectives');
    if (opuestos.length) {
        const faltan = ENFOQUES_A_BUSCAR.filter(a => !presentApproaches.has(a)).slice(0, 3);
        pasos.push({
            kind: 'perspectives', reasons: opuestos,
            queries: libros.slice(0, 2).flatMap(b => faltan.map(a => consulta('google-scholar', `(${en(b)}) AND (${TERMINOS_ENFOQUE[a]})`, nombre(b, language), { approach: a }))),
        });
    }

    // 7 · Tesis: en una investigación.
    if (investigacion) {
        pasos.push({
            kind: 'theses', reasons: [{ kind: 'project', projectType: 'study' }],
            queries: libros.flatMap(b => [
                consulta('oatd', en(b), nombre(b, language)),
                consulta('proquest', en(b), nombre(b, language)),
                ...(language === 'es' ? [consulta('dialnet-theses', bookSearchName(b, 'es'), nombre(b, language))] : []),
            ]),
        });
    }
    return pasos;
}

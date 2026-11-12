/**
 * U3c (revisión del profesor 2026-11, Stg 2:10 «ἐν ἑνί»): el SENTIDO de una
 * preposición griega según Louw y Nida (Greek-English Lexicon of the NT Based
 * on Semantic Domains, vol. 1, UBS 1988). MACULA trae el código (89.5); esto
 * dice qué significa: el dominio y, para los que usan las preposiciones, el
 * subdominio («89 Relaciones › Especificación, 89.4–89.7»).
 *
 * Del libro sólo se toman el número, el rango y el nombre corto del dominio y
 * del subdominio, con la página donde empieza el dominio (su «Outline of
 * Subdomains» está en esa página). El texto de las entradas no entra al repo.
 * Medido (2026-11-12): de 10.877 preposiciones del NT, 9.323 traen código; los
 * dominios 89, 90, 84, 83, 67, 13, 63 y 78 cubren el 97 %.
 */

export interface LouwNidaDomain {
    readonly n: number;
    readonly en: string;
    readonly es: string;
    /** Página impresa donde empieza el dominio (vol. 1). */
    readonly page: number;
}

export interface LouwNidaSubdomain {
    readonly domain: number;
    /** Primer y último número de entrada del subdominio. */
    readonly from: number;
    readonly to: number;
    readonly en: string;
    readonly es: string;
}

const D = (n: number, en: string, es: string, page: number): LouwNidaDomain => ({ n, en, es, page });

export const LOUW_NIDA_DOMAINS: readonly LouwNidaDomain[] = [
    D(1, 'Geographical Objects and Features', 'objetos y rasgos geográficos', 1), D(2, 'Natural Substances', 'sustancias naturales', 19),
    D(3, 'Plants', 'plantas', 28), D(4, 'Animals', 'animales', 37), D(5, 'Foods and Condiments', 'alimentos y condimentos', 48),
    D(6, 'Artifacts', 'artefactos', 53), D(7, 'Constructions', 'construcciones', 81), D(8, 'Body, Body Parts, and Body Products', 'el cuerpo y sus partes', 93),
    D(9, 'People', 'personas', 104), D(10, 'Kinship Terms', 'parentesco', 111),
    D(11, 'Groups and Classes of Persons and Members of Such Groups and Classes', 'grupos y clases de personas', 121),
    D(12, 'Supernatural Beings and Powers', 'seres y poderes sobrenaturales', 136), D(13, 'Be, Become, Exist, Happen', 'ser, llegar a ser, existir, suceder', 149),
    D(14, 'Physical Events and States', 'sucesos y estados físicos', 166), D(15, 'Linear Movement', 'movimiento lineal', 181),
    D(16, 'Non-Linear Movement', 'movimiento no lineal', 212), D(17, 'Stances and Events Related to Stances', 'posturas', 215),
    D(18, 'Attachment', 'sujeción', 220), D(19, 'Physical Impact', 'impacto físico', 222), D(20, 'Violence, Harm, Destroy, Kill', 'violencia, daño, destrucción', 228),
    D(21, 'Danger, Risk, Safe, Save', 'peligro, seguridad, salvación', 238), D(22, 'Trouble, Hardship, Relief, Favorable Circumstances', 'dificultad y alivio', 242),
    D(23, 'Physiological Processes and States', 'procesos y estados fisiológicos', 248), D(24, 'Sensory Events and States', 'sucesos de los sentidos', 277),
    D(25, 'Attitudes and Emotions', 'actitudes y emociones', 288), D(26, 'Psychological Faculties', 'facultades psicológicas', 320),
    D(27, 'Learn', 'aprender', 325), D(28, 'Know', 'conocer', 334), D(29, 'Memory and Recall', 'memoria', 346), D(30, 'Think', 'pensar', 349),
    D(31, 'Hold a View, Believe, Trust', 'opinar, creer, confiar', 365), D(32, 'Understand', 'entender', 380), D(33, 'Communication', 'comunicación', 388),
    D(34, 'Association', 'asociación', 446), D(35, 'Help, Care For', 'ayudar, cuidar', 458), D(36, 'Guide, Discipline, Follow', 'guiar, disciplinar, seguir', 465),
    D(37, 'Control, Rule', 'control, gobierno', 472), D(38, 'Punish, Reward', 'castigar, recompensar', 489), D(39, 'Hostility, Strife', 'hostilidad, contienda', 492),
    D(40, 'Reconciliation, Forgiveness', 'reconciliación, perdón', 502), D(41, 'Behavior and Related States', 'conducta', 504), D(42, 'Perform, Do', 'hacer, realizar', 511),
    D(43, 'Agriculture', 'agricultura', 516), D(44, 'Animal Husbandry, Fishing', 'ganadería, pesca', 518), D(45, 'Building, Constructing', 'construir', 519),
    D(46, 'Household Activities', 'tareas de la casa', 520), D(47, 'Activities Involving Liquids or Masses', 'líquidos y masas', 522),
    D(48, 'Activities Involving Cloth', 'tela', 524), D(49, 'Activities Involving Clothing and Adorning', 'vestido y adorno', 525),
    D(50, 'Contests and Play', 'competencias y juego', 528), D(51, 'Festivals', 'fiestas', 529), D(52, 'Funerals and Burial', 'funerales', 530),
    D(53, 'Religious Activities', 'actividades religiosas', 531), D(54, 'Maritime Activities', 'navegación', 546), D(55, 'Military Activities', 'actividades militares', 549),
    D(56, 'Courts and Legal Procedures', 'tribunales', 552), D(57, 'Possess, Transfer, Exchange', 'poseer, transferir, intercambiar', 558),
    D(58, 'Nature, Class, Example', 'naturaleza, clase, ejemplo', 585), D(59, 'Quantity', 'cantidad', 595), D(60, 'Number', 'número', 603),
    D(61, 'Sequence', 'secuencia', 610), D(62, 'Arrange, Organize', 'ordenar', 612), D(63, 'Whole, Unite, Part, Divide', 'todo y parte', 613),
    D(64, 'Comparison', 'comparación', 617), D(65, 'Value', 'valor', 620), D(66, 'Proper, Improper', 'apropiado, impropio', 627), D(67, 'Time', 'tiempo', 628),
    D(68, 'Aspect', 'aspecto', 655), D(69, 'Affirmation, Negation', 'afirmación, negación', 665), D(70, 'Real, Unreal', 'real, irreal', 667),
    D(71, 'Mode', 'modo', 668), D(72, 'True, False', 'verdadero, falso', 673), D(73, 'Genuine, Phony', 'genuino, falso', 675),
    D(74, 'Able, Capable', 'capacidad', 676), D(75, 'Adequate, Qualified', 'idoneidad', 679), D(76, 'Power, Force', 'poder, fuerza', 680),
    D(77, 'Ready, Prepared', 'preparado', 683), D(78, 'Degree', 'grado', 684), D(79, 'Features of Objects', 'rasgos de los objetos', 694),
    D(80, 'Space', 'espacio', 707), D(81, 'Spacial Dimensions', 'dimensiones espaciales', 708), D(82, 'Spacial Orientations', 'orientaciones espaciales', 711),
    D(83, 'Spacial Positions', 'posiciones en el espacio', 712), D(84, 'Spacial Extensions', 'extensiones en el espacio', 721),
    D(85, 'Existence in Space', 'existencia en el espacio', 724), D(86, 'Weight', 'peso', 733), D(87, 'Status', 'condición social', 734),
    D(88, 'Moral and Ethical Qualities and Related Behavior', 'cualidades morales', 742), D(89, 'Relations', 'relaciones', 777), D(90, 'Case', 'caso', 796),
    D(91, 'Discourse Markers', 'marcadores del discurso', 811), D(92, 'Discourse Referentials', 'referentes del discurso', 813),
    D(93, 'Names of Persons and Places', 'nombres de personas y lugares', 818),
];

const S = (domain: number, from: number, to: number, en: string, es: string): LouwNidaSubdomain => ({ domain, from, to, en, es });

/** Los subdominios de los dominios que usan las preposiciones (su «Outline of Subdomains»). */
export const LOUW_NIDA_SUBDOMAINS: readonly LouwNidaSubdomain[] = [
    S(13, 1, 47, 'State', 'estado'), S(13, 48, 68, 'Change of State', 'cambio de estado'), S(13, 69, 103, 'Exist', 'existir'), S(13, 104, 163, 'Happen', 'suceder'),
    S(63, 1, 4, 'Whole', 'todo'), S(63, 5, 8, 'Unite', 'unir'), S(63, 9, 12, 'Mix', 'mezclar'), S(63, 13, 20, 'Part', 'parte'),
    S(63, 21, 22, 'Remnant', 'remanente'), S(63, 23, 27, 'Divide', 'dividir'), S(63, 28, 31, 'Separate', 'separar'),
    S(67, 1, 16, 'Other Points of Time', 'momento, ocasión, a menudo'), S(67, 17, 64, 'Before, Long Ago, Now, At the Same Time, When, About, After', 'antes, ahora, al mismo tiempo, cuando, después'),
    S(67, 65, 72, 'Beginning, End', 'comienzo, fin'), S(67, 73, 77, 'Daybreak, Midday, Midnight, Late', 'amanecer, mediodía, medianoche'),
    S(67, 78, 117, 'Always, Eternal, Old, Young', 'duración del tiempo'),
    S(67, 118, 135, 'Duration of Time with Reference to Some Point of Time: Until, Delay, Still, From', 'duración hasta o desde un punto: «hasta», «desde»'),
    S(67, 136, 141, 'Duration of Time with Reference to Some Unit of Time: During, In, While, Throughout', 'duración dentro de una unidad: «durante», «mientras»'),
    S(67, 142, 162, 'Indefinite Units of Time', 'unidades indefinidas de tiempo'), S(67, 163, 200, 'Week, Day, Hour', 'semana, día, hora'), S(67, 201, 208, 'Yesterday, Next Day', 'ayer, hoy, mañana'),
    S(78, 1, 27, 'Much, Little', 'mucho, poco'), S(78, 28, 39, 'More Than, Less Than', 'más que, menos que'), S(78, 40, 43, 'About, Approximately, Almost', 'aproximadamente, casi'),
    S(78, 44, 50, 'Completely, Enough', 'completamente, suficiente'), S(78, 51, 53, 'Marked Extent of Degree', 'hasta, tanto como'),
    S(83, 1, 4, 'Here, There', 'aquí, allí'), S(83, 5, 8, 'Where, Somewhere, Everywhere', 'dónde, en todas partes'), S(83, 9, 17, 'Among, Between, In, Inside', 'entre, en, dentro de'),
    S(83, 18, 22, 'Around, About, Outside', 'alrededor, fuera'), S(83, 23, 32, 'At, Beside, Near, Far', 'en, junto a, cerca, lejos'),
    S(83, 33, 41, 'In Front Of, Face To Face, In Back Of, Behind', 'delante, cara a cara, detrás'), S(83, 42, 45, 'Opposite, Over Against, Across From', 'enfrente'),
    S(83, 46, 47, 'On, Upon, On the Surface Of', 'sobre, encima de'), S(83, 48, 54, 'Above, Below', 'arriba, abajo'), S(83, 55, 56, 'Beyond, On the Other Side Of', 'más allá, al otro lado'),
    S(84, 1, 15, 'Extension From a Source', 'desde un origen'), S(84, 16, 28, 'Extension To a Goal', 'hacia una meta'), S(84, 29, 33, 'Extension Along a Path', 'a lo largo de un camino'),
    S(89, 1, 1, 'Relation', 'relación'), S(89, 2, 2, 'Dependency', 'dependencia'), S(89, 3, 3, 'Derivation', 'derivación'),
    S(89, 4, 7, 'Specification', 'especificación: «con respecto a», «en cuanto a»'), S(89, 8, 11, 'Relations Involving Correspondence', 'correspondencia'),
    S(89, 12, 14, 'Basis', 'fundamento'), S(89, 15, 38, 'Cause and/or Reason', 'causa o razón'), S(89, 39, 54, 'Result', 'resultado'), S(89, 55, 64, 'Purpose', 'finalidad'),
    S(89, 65, 70, 'Condition', 'condición'), S(89, 71, 75, 'Concession', 'concesión'), S(89, 76, 78, 'Means', 'medio'), S(89, 79, 80, 'Attendant Circumstances', 'circunstancia que acompaña'),
    S(89, 81, 86, 'Manner', 'modo'), S(89, 87, 89, 'Sequential Addition', 'adición en secuencia'), S(89, 90, 91, 'Distribution', 'distribución'), S(89, 92, 104, 'Addition', 'adición'),
    S(89, 105, 105, 'Linkage', 'enlace'), S(89, 106, 106, 'Equivalence', 'equivalencia'), S(89, 107, 119, 'Association', 'asociación: «con»'), S(89, 120, 122, 'Dissociation', 'separación: «sin»'),
    S(89, 123, 123, 'Combinative Relation', 'combinación'), S(89, 124, 138, 'Contrast', 'contraste'), S(89, 139, 140, 'Alternative Relation', 'alternativa'),
    S(89, 141, 142, 'Substance', 'sustancia'), S(89, 143, 143, 'Mediation', 'mediación'),
    S(90, 1, 7, 'Agent', 'agente'), S(90, 8, 13, 'Instrument', 'instrumento'), S(90, 14, 16, 'Source of Event or Activity', 'origen de la acción'),
    S(90, 17, 19, 'Responsibility', 'responsabilidad'), S(90, 20, 20, 'Viewpoint Participant', 'punto de vista: «para», «a los ojos de»'), S(90, 21, 28, 'Content', 'contenido: «acerca de»'),
    S(90, 29, 30, 'Guarantor Participant with Oaths', 'garante de un juramento: «por»'), S(90, 31, 35, 'Opposition', 'oposición: «contra»'), S(90, 36, 42, 'Benefaction', 'beneficio: «a favor de»'),
    S(90, 43, 44, 'Reason Participant', 'participante como razón'), S(90, 45, 50, 'Agent of a Numerable Event', 'agente de un suceso'),
    S(90, 51, 55, 'Agent in a Causative Role Marked by Verbs', 'agente causativo'), S(90, 56, 84, 'Experiencer', 'quien experimenta'), S(90, 85, 97, 'To Cause to Experience', 'hacer experimentar'),
];

export interface LouwNidaSense {
    readonly code: string;
    readonly domain: LouwNidaDomain;
    readonly subdomain?: LouwNidaSubdomain;
}

/** «89.5» → dominio 89 Relaciones, subdominio Especificación. Un código que no se entiende, nada. */
export function louwNidaSense(code: string): LouwNidaSense | undefined {
    const m = /^(\d{1,2})\.(\d{1,3})$/.exec(code.trim());
    if (!m) return undefined;
    const n = Number(m[1]), e = Number(m[2]);
    const domain = LOUW_NIDA_DOMAINS.find(d => d.n === n);
    if (!domain) return undefined;
    const subdomain = LOUW_NIDA_SUBDOMAINS.find(s => s.domain === n && e >= s.from && e <= s.to);
    return { code: `${n}.${e}`, domain, ...(subdomain ? { subdomain } : {}) };
}

/** Los sentidos de una palabra («89.25 89.77»: MACULA deja dos lecturas). */
export function louwNidaSenses(ln: string | undefined): LouwNidaSense[] {
    return (ln ?? '').split(/\s+/).filter(Boolean).map(louwNidaSense).filter((s): s is LouwNidaSense => !!s);
}

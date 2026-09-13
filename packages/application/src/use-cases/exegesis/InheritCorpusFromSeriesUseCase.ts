import {
    proponerCorpusHeredado,
    type IExegeticalPaperRepository,
    type PropuestaDeHerencia,
    type ProjectSource,
} from '@dosfilos/domain';

/**
 * Trae a un trabajo el corpus que ya se armó en otro de su misma serie.
 *
 * Un plan de predicación recorre un libro en pericopas, y las fuentes que
 * sirven para una sirven casi siempre para la siguiente. Medido sobre un plan
 * real de Jonás: el trabajo de 2:1-11 tenía once fuentes y el de 3:1-10
 * arrancaba con cero, compartiendo `seriesId`.
 *
 * LOS FRAGMENTOS NO VIAJAN. Se hereda qué libro es, cómo está clasificado, con
 * qué rol y bajo qué clave se cita. Los excerpts se extraen contra un pasaje
 * concreto: traer los de Jonás 2 a Jonás 3 metería citas que no vienen al caso.
 * Por eso las fuentes llegan listas para extraer, no extraídas.
 *
 * Qué heredar lo decide `proponerCorpusHeredado`, que es puro y está probado
 * aparte. Acá se buscan los hermanos, se le dice qué libros siguen vivos en la
 * biblioteca, y se escriben las fuentes.
 */

/**
 * Lo único que hace falta de la biblioteca: qué libros tiene el usuario. Se
 * declara acá, angosto, en vez de depender del repositorio entero.
 */
export interface LectorDeBiblioteca {
    findByUserId(userId: string): Promise<ReadonlyArray<{ id: string }>>;
}

export class InheritCorpusFromSeriesUseCase {
    constructor(
        private readonly paperRepository: IExegeticalPaperRepository,
        private readonly biblioteca: LectorDeBiblioteca,
    ) { }

    /**
     * Qué se podría heredar, sin escribir nada.
     *
     * Se consulta al abrir el paso del corpus, así que devuelve `null` en
     * silencio cuando no hay nada que ofrecer: una tarjeta vacía enseñaría a
     * ignorar el aviso cuando sí tenga algo.
     */
    async proponer(ownerId: string, paperId: string): Promise<PropuestaDeHerencia | null> {
        if (!ownerId || !paperId) return null;

        const actual = await this.paperRepository.getPaper(ownerId, paperId);
        if (!actual?.seriesId) return null;

        const [todos, recursos] = await Promise.all([
            this.paperRepository.listPapers(ownerId),
            this.biblioteca.findByUserId(ownerId),
        ]);
        // Sin el conjunto de libros vivos la propuesta ofrecería los borrados:
        // en la serie real de Jonás, una de once fuentes apunta a un recurso
        // que ya no está, y sólo se nota al intentar citarlo.
        return proponerCorpusHeredado(actual, todos, new Set(recursos.map(r => r.id)));
    }

    /**
     * Escribe las fuentes propuestas en el trabajo actual.
     *
     * Se vuelve a proponer en vez de confiar en lo que mandó la pantalla: entre
     * que se mostró la tarjeta y que alguien la aceptó pudo agregarse una
     * fuente a mano, y adjuntarla de nuevo dejaría el mismo libro dos veces en
     * el corpus.
     */
    async aplicar(input: {
        ownerId: string;
        paperId: string;
        /** Qué recursos traer. Vacío o ausente significa todos los propuestos. */
        soloEstos?: ReadonlyArray<string>;
    }): Promise<ProjectSource[]> {
        const { ownerId, paperId } = input;
        if (!ownerId || !paperId) throw new Error('InheritCorpusFromSeries: ownerId y paperId requeridos');

        const propuesta = await this.proponer(ownerId, paperId);
        if (!propuesta) return [];

        const pedidos = input.soloEstos?.length ? new Set(input.soloEstos) : null;
        const aTraer = propuesta.fuentes.filter(f => !pedidos || pedidos.has(f.sourceLibraryResourceId));

        const paper = await this.paperRepository.getPaper(ownerId, paperId);
        if (!paper) return [];
        let orden = paper.sources.length;

        const creadas: ProjectSource[] = [];
        // En serie y no en paralelo. El `order` lo fija el llamador —el
        // repositorio escribe el que se le pasa— así que se lleva la cuenta
        // acá; y cada `addSource` reescribe el arreglo entero de fuentes
        // dentro de una transacción, de modo que en paralelo se pelearían por
        // el mismo documento.
        for (const f of aTraer) {
            creadas.push(await this.paperRepository.addSource(ownerId, paperId, {
                // El corpus del origen, no uno nuevo: el texto ya está ingerido
                // y volver a subirlo cobraría cuota por el mismo libro.
                corpusId: f.corpusId,
                sourceType: f.sourceType,
                chosenRole: f.chosenRole,
                displayLabel: f.displayLabel,
                citationKey: f.citationKey,
                order: orden++,
                mode: 'full-document',
                // Llega SIN fragmentos: hay que extraerlos contra este pasaje.
                excerpts: [],
                excerptSelectionMode: null,
                excerptRecipe: null,
                sourceLibraryResourceId: f.sourceLibraryResourceId,
                // Sin extraer todavía, así que sin huella: el tablero la lee
                // para decidir si los fragmentos quedaron viejos, y una huella
                // inventada le haría decir que están al día.
                extractedAt: null,
                extractionFingerprint: null,
            }));
        }
        return creadas;
    }
}

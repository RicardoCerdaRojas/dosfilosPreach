import {
    MODEL_FAST,
    keepOnlyWhatIsWritten,
    proposeIsbn,
    readableRegionsOf,
    type BibliographicData,
    type ReadableRegions,
} from '@dosfilos/domain';
import { FirebaseLibraryRepository } from '../firebase/FirebaseLibraryRepository';
import { runLlmPrompt } from '../llm/callableLlm';
import { withGeminiRetry } from './geminiRetry';

export interface CoverBibliographyResult {
    /** Lo que el libro dice, ya filtrado. Puede venir vacío. */
    data: BibliographicData;
    /** Lo que el modelo propuso y el texto no respaldaba. */
    discarded: ReadonlyArray<keyof BibliographicData>;
    /** `false` cuando el libro todavía no tiene texto extraído. */
    hasText: boolean;
    /**
     * Por qué camino se recortó el texto.
     *
     * `letras` es el de respaldo —el libro no trae marcas de hoja— y deja
     * pasar el prefacio. Viaja para que se pueda ver en producción cuántas
     * lecturas caen ahí: si mañana el extractor cambiara la marca, caerían
     * todas y sin esto no se notaría.
     */
    origin: 'hojas' | 'letras';
}

/**
 * Lee la ficha bibliográfica de la página de créditos del propio ejemplar.
 *
 * POR QUÉ ESTE CAMINO Y NO UNA BÚSQUEDA. La bibliografía describe EL
 * EJEMPLAR que se usó, y las páginas que se citan son las de esa tirada.
 * Una búsqueda encuentra *una* edición, no necesariamente la que está en
 * el estante; traer su año es peor que dejar el hueco, porque el hueco se
 * ve y el año equivocado no. El PDF, en cambio, es el ejemplar.
 *
 * POR QUÉ EL MODELO Y NO UN PATRÓN. La página de créditos no tiene forma
 * fija: cambia por editorial, por idioma y por década. Lo que sí es fijo
 * es la comprobación, y esa no la hace el modelo: `keepOnlyWhatIsWritten`
 * descarta todo campo que no aparezca en el texto que se le entregó. El
 * modelo sabe de memoria que a Ross lo publicó Kregel y lo diría aunque el
 * PDF no lo dijera; ese acierto de memoria es indistinguible de un
 * invento, así que no se acepta sin respaldo.
 *
 * El texto sale de `textContent`, que es el ARRANQUE del libro —el
 * extractor lo corta a 800 KB—, y los créditos viven justo ahí.
 *
 * LO QUE NO SE MANDA NO SE COPIA. Al modelo le llegan dos tramos y nada
 * más: la portada y la página de créditos. El prefacio se queda fuera
 * porque cita otros libros con su ciudad, su editorial y su año; un
 * ejemplar de Ross cuyo prefacio cita a Brueggemann devolvía la ficha de
 * Brueggemann, completa y con el rótulo «del libro».
 */
export async function readBibliographyFromCover(
    resourceId: string,
    modelName: string = MODEL_FAST,
    library: FirebaseLibraryRepository = new FirebaseLibraryRepository(),
    ejecutarPrompt: EjecutarPrompt = pedirleAlModelo,
): Promise<CoverBibliographyResult> {
    const resource = (await library.findById(resourceId)) as {
        textContent?: string;
        title?: string;
        author?: string;
    } | null;

    const regiones = readableRegionsOf(resource?.textContent ?? '');
    if (regiones.cover.length < MINIMO_PARA_INTENTAR) {
        return { data: {}, discarded: [], hasText: false, origin: regiones.origin };
    }
    console.log('[CoverBibliography] leyendo', {
        resourceId,
        origin: regiones.origin,
        cover: regiones.cover.length,
        credits: regiones.credits.length,
    });

    const raw = await ejecutarPrompt(
        buildCoverPrompt(regiones, resource?.title, resource?.author),
        modelName,
    );

    const { data, discarded } = keepOnlyWhatIsWritten(parseCoverJson(raw), regiones);
    const isbn = proposeIsbn(`${regiones.cover}\n${regiones.credits}`);
    if (isbn) data.isbn = isbn;

    return { data, discarded, hasText: true, origin: regiones.origin };
}

/** El paso que habla con el modelo, aparte para poder probar el resto. */
export type EjecutarPrompt = (prompt: string, modelName: string) => Promise<string>;

const pedirleAlModelo: EjecutarPrompt = (prompt, modelName) => withGeminiRetry(
    () => runLlmPrompt({
        feature: 'exegesis.readBibliography',
        model: modelName,
        system: INSTRUCCION,
        prompt,
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 2048,
    }),
    // Tres intentos y no cinco: el callable ya reintenta del lado del
    // servidor, y cinco por cinco son veinticinco llamadas al modelo por un
    // clic. Leer una portada no es una operación que valga esa cuenta.
    { contextLabel: 'CoverBibliographyReader', maxAttempts: 3 },
);

/** Bajo esto no hay portada que leer: es un libro sin texto extraído. */
const MINIMO_PARA_INTENTAR = 200;

const INSTRUCCION = [
    'Eres un transcriptor de páginas de créditos. No eres un investigador.',
    '',
    'Recibes el ARRANQUE de un libro escaneado: portada, portadilla, página',
    'legal y a veces el índice. Devuelves los datos de publicación que estén',
    'IMPRESOS en ese fragmento.',
    '',
    'REGLAS, en orden de importancia:',
    '1. Copia. No completes de memoria. Si el fragmento no dice la ciudad,',
    '   la editorial o el año, deja el campo vacío. Un campo vacío es una',
    '   respuesta correcta; un dato que no está impreso es un error.',
    '2. No traduzcas ni normalices: copia tal como está escrito, con sus',
    '   acentos y su idioma.',
    '3. La ciudad es solo la ciudad («Grand Rapids», no «Grand Rapids,',
    '   Michigan 49501»), y tiene que aparecer así en el fragmento.',
    '4. El año es el del copyright o el de la edición que se tiene delante.',
    '   Si hay varios, el de esta edición.',
    '5. No inventes el ISBN: ese campo no existe aquí.',
    '6. La página legal puede nombrar OTROS libros, y esos no son este:',
    '   el bloque de permisos de la versión bíblica citada («las citas',
    '   bíblicas son de…», «Copyright © … por Bíblica») y el «título',
    '   original» de una traducción, con la imprenta del original. El pie',
    '   de imprenta que se pide es el de ESTE ejemplar: el de la edición',
    '   que se tiene delante, no el de la obra de la que se tradujo.',
    '',
    'Devuelve SOLO un objeto JSON con estas claves, en texto plano y sin',
    'comentarios: author, authorSorted, title, subtitle, shortTitle, volume,',
    'volumeTitle, series, edition, translator, editor, city, publisher, year.',
    'Todas de tipo texto. Lo que no esté impreso va como cadena vacía.',
    '',
    '«authorSorted» es el mismo nombre para ordenar alfabéticamente («Ross,',
    'Allen P.») y «shortTitle» es el título recortado para las notas',
    'siguientes: los dos salen de reordenar o recortar lo que ya copiaste.',
].join('\n');

export function buildCoverPrompt(regiones: ReadableRegions, title?: string, author?: string): string {
    return [
        // El título y el autor del archivo se dan como PISTA y se dice que lo
        // son: los escribió quien subió el libro, muchas veces es el nombre
        // del archivo, y no son la portada.
        'Título con que este libro está guardado en la biblioteca (es una',
        `pista de quien lo subió, no la portada): ${title ?? '—'}`,
        `Autor con que está guardado: ${author ?? '—'}`,
        '',
        'PRIMERAS HOJAS (de aquí salen autor, título, subtítulo, volumen y colección):',
        '---',
        regiones.cover,
        '---',
        '',
        regiones.credits
            ? 'PÁGINA DE CRÉDITOS (de aquí salen ciudad, editorial, año, edición, traductor y editor):'
            : 'Este ejemplar NO trae página de créditos: deja vacíos la ciudad, la editorial y el año.',
        ...(regiones.credits ? ['---', regiones.credits, '---'] : []),
    ].join('\n');
}

/**
 * El JSON de la respuesta, tolerante con las vallas de markdown.
 *
 * Un fallo de formato devuelve `null` y el llamador se queda sin
 * propuesta, que es el mismo resultado que un libro sin créditos.
 */
export function parseCoverJson(raw: string): BibliographicData | null {
    const limpio = (raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    try {
        const parsed: unknown = JSON.parse(limpio);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return parsed as BibliographicData;
    } catch (err) {
        console.warn('[CoverBibliography] el modelo no devolvió JSON legible', err);
        return null;
    }
}

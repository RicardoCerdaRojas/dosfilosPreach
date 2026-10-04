/**
 * Las secciones del sermón viven en el dominio desde A7 (fase Púlpito
 * premium): eran una copia a mano de la web y los slugs anclan las marcas
 * entre plataformas. Este archivo sólo re-exporta, para no tocar a cada
 * pantalla que las importa.
 */
export {
    extractSectionsWithBody,
    slugifyHeader,
    tokenizeCitations,
    type InlineToken,
    type SermonSection,
} from '@dosfilos/domain';

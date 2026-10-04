import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

/**
 * Cómo se lee el markdown de un SERMÓN en la web: una sola lista, para el
 * detalle, las vistas previas y el púlpito web.
 *
 * `remark-breaks` aplica `LINE_BREAK_RULE` (dominio): un salto que el pastor
 * puso dentro de un párrafo se ve como salto. El markdown estándar lo lee
 * como espacio, y así se pegaba «A nivel institucional Hace muchos años…».
 * Es la misma regla del atril y de Word/PDF; la prueba con los casos
 * compartidos (`LINE_BREAK_FIXTURES`) ata a los tres.
 */
export const SERMON_REMARK_PLUGINS = [remarkGfm, remarkBreaks];

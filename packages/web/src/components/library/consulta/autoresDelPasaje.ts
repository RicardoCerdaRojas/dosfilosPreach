import type { FuenteDeConsulta } from '@dosfilos/infrastructure';
import { apellidoDelAutor } from '../apellidoDelAutor';
import { paginaDeCita } from './paginaDeCita';
import type { EtiquetarFuente } from './citasDeRespuesta';

export interface AutorDelPasaje {
    autor: string;
    paginas: Array<{ etiqueta: string; fuente: FuenteDeConsulta }>;
}

/**
 * U6: quiénes tratan el pasaje en esta respuesta y en qué páginas, en el
 * orden de sus fragmentos (el del reordenador: el más pertinente primero),
 * que no siempre es el de los párrafos. Un autor con dos libros queda junto;
 * una página citada dos veces, una vez.
 */
export function autoresDelPasaje(fuentes: ReadonlyArray<FuenteDeConsulta>, etiquetar: EtiquetarFuente): AutorDelPasaje[] {
    const porAutor = new Map<string, AutorDelPasaje>();
    for (const f of [...fuentes].sort((a, b) => a.n - b.n)) {
        const autor = apellidoDelAutor(f.autor) || f.titulo;
        const grupo = porAutor.get(autor) ?? { autor, paginas: [] };
        const etiqueta = paginaDeCita(etiquetar(f));
        if (!grupo.paginas.some(p => p.etiqueta === etiqueta && p.fuente.resourceId === f.resourceId)) grupo.paginas.push({ etiqueta, fuente: f });
        porAutor.set(autor, grupo);
    }
    return [...porAutor.values()];
}
